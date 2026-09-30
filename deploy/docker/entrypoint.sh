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

if [ -f ./prisma/schema.prisma ] && [ -x ./node_modules/.bin/prisma ]; then
  echo "==> prisma migrate deploy"
  if ! ./node_modules/.bin/prisma migrate deploy; then
    echo "WARN: migrate deploy failed (existing db push databases hit this). Syncing with db push."
    ./node_modules/.bin/prisma db push --skip-generate || echo "WARN: prisma db push failed (continuing)"
  fi
fi

echo "==> Starting Next.js (standalone) on :${PORT:-3000}"
exec su-exec nextjs node server.js
