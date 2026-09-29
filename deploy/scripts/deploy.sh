#!/usr/bin/env bash
# Influrios — build & restart on AWS Lightsail
# Run from the app root (or set APP_DIR). Requires .env with DATABASE_URL.
set -euo pipefail

APP_DIR="${APP_DIR:-$(pwd)}"
cd "${APP_DIR}"

if [[ ! -f .env ]]; then
  echo "ERROR: ${APP_DIR}/.env missing. Copy .env.example and set DATABASE_URL."
  exit 1
fi

echo "==> Install dependencies"
npm ci

echo "==> Prisma generate + migrate"
npx prisma generate
npx prisma migrate deploy 2>/dev/null || npx prisma db push

echo "==> Seed (idempotent upserts)"
npm run db:seed || true

echo "==> Build Next.js"
npm run build

echo "==> Restart PM2"
if [[ -f deploy/pm2/ecosystem.config.cjs ]]; then
  pm2 startOrReload deploy/pm2/ecosystem.config.cjs --update-env
else
  pm2 startOrReload ecosystem.config.cjs --update-env 2>/dev/null \
    || pm2 start npm --name influrios -- start
fi
pm2 save

echo "==> Health check"
sleep 2
curl -fsS "http://127.0.0.1:3000" >/dev/null && echo "OK: app responding on :3000" || echo "WARN: app not responding yet — check: pm2 logs influrios"
