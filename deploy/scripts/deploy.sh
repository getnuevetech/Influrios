#!/usr/bin/env bash
# Influrios — build & restart on AWS Lightsail
# Run from the app root (or set APP_DIR). Requires .env with DATABASE_URL.
# Starts Docker Postgres if not already running.
set -euo pipefail

APP_DIR="${APP_DIR:-$(pwd)}"
cd "${APP_DIR}"

if [[ ! -f .env ]]; then
  echo "ERROR: ${APP_DIR}/.env missing. Copy .env.example and set POSTGRES_* / DATABASE_URL."
  exit 1
fi

# Load POSTGRES_* for health checks (ignore comment/blank lines)
set -a
# shellcheck disable=SC1091
source .env
set +a

echo "==> Ensure Docker Postgres is up"
if command -v docker >/dev/null 2>&1; then
  bash deploy/scripts/db-up.sh
else
  echo "WARNING: docker not found — assuming DATABASE_URL points to an external DB"
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
echo "DB: docker compose ps postgres"
