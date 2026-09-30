#!/bin/sh
set -eu

echo "==> Waiting for Postgres at postgres:5432..."
i=0
until node -e "require('net').connect(5432,'postgres',()=>process.exit(0)).on('error',()=>process.exit(1))" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "ERROR: database not reachable"
    exit 1
  fi
  sleep 1
done
echo "OK: Postgres port open"

mkdir -p /app/data /app/public/uploads/banners
chown -R nextjs:nodejs /app/data /app/public/uploads

# Compose interpolates POSTGRES_PASSWORD raw. Rebuild the URL so @ : / # ? in
# the password cannot make Prisma throw on every short-link lookup.
case "${DATABASE_URL:-}" in
  postgresql://*@postgres:5432/*|postgres://*@postgres:5432/*)
    if [ -n "${POSTGRES_PASSWORD:-}" ]; then
      export DATABASE_URL="$(node <<'NODE'
const user = encodeURIComponent(process.env.POSTGRES_USER || "influrios");
const password = encodeURIComponent(process.env.POSTGRES_PASSWORD || "");
const db = encodeURIComponent(process.env.POSTGRES_DB || "influrios");
process.stdout.write(`postgresql://${user}:${password}@postgres:5432/${db}?schema=public`);
NODE
)"
      echo "OK: DATABASE_URL rebuilt for host postgres"
    fi
    ;;
esac

prisma_cli() {
  if [ -x ./node_modules/.bin/prisma ]; then
    ./node_modules/.bin/prisma "$@"
    return
  fi
  if [ -f ./node_modules/prisma/build/index.js ]; then
    node ./node_modules/prisma/build/index.js "$@"
    return
  fi
  echo "ERROR: prisma CLI is missing from this image"
  exit 1
}

short_links_ready() {
  node <<'NODE'
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
prisma.shortLinkDomain
  .findFirst()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (error) => {
    const code = error && error.code ? error.code : error && error.name ? error.name : "unknown";
    console.error("ShortLinkDomain check failed:", code);
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
NODE
}

if [ ! -f ./prisma/schema.prisma ]; then
  echo "ERROR: prisma schema missing from this image"
  exit 1
fi

echo "==> prisma migrate deploy"
if ! prisma_cli migrate deploy; then
  echo "WARN: migrate deploy failed (existing db push databases hit this). Syncing with db push."
  if ! prisma_cli db push --skip-generate; then
    echo "ERROR: prisma db push failed. Refusing to serve short links without the schema."
    exit 1
  fi
fi

echo "==> checking ShortLinkDomain"
ready=0
attempt=0
while [ "$attempt" -lt 5 ]; do
  attempt=$((attempt + 1))
  if short_links_ready; then
    ready=1
    break
  fi
  sleep 2
done

if [ "$ready" -ne 1 ]; then
  echo "WARN: ShortLinkDomain is not readable. Retrying db push."
  if ! prisma_cli db push --skip-generate || ! short_links_ready; then
    echo "ERROR: ShortLinkDomain is still missing. Refusing to start."
    exit 1
  fi
fi
echo "OK: ShortLinkDomain is readable"

echo "==> Starting Next.js (standalone) on :${PORT:-3000}"
exec su-exec nextjs node server.js
