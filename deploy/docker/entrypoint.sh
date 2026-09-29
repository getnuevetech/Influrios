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

if [ -f ./prisma/schema.prisma ] && [ -x ./node_modules/.bin/prisma ]; then
  echo "==> prisma db push"
  ./node_modules/.bin/prisma db push --skip-generate || echo "WARN: prisma db push failed (continuing)"
fi

echo "==> Starting Next.js (standalone) on :${PORT:-3000}"
exec node server.js
