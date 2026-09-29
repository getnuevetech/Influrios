#!/usr/bin/env bash
# Influrios — build & restart via Docker Compose (no PM2)
# Run from the app root. Requires .env with POSTGRES_* and NEXT_PUBLIC_APP_URL.
set -euo pipefail

APP_DIR="${APP_DIR:-$(pwd)}"
cd "${APP_DIR}"

if [[ ! -f .env ]]; then
  echo "ERROR: ${APP_DIR}/.env missing. Copy .env.example and set POSTGRES_PASSWORD + NEXT_PUBLIC_APP_URL."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found. Run bash deploy/scripts/setup-lightsail.sh first."
  exit 1
fi

# Stop legacy PM2 process if present (migrating off PM2)
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete influrios >/dev/null 2>&1 || true
  pm2 save >/dev/null 2>&1 || true
fi

echo "==> Ensure swap (avoids Next.js webpack OOM on small Lightsail)"
if [[ "$(id -u)" -eq 0 ]]; then
  bash deploy/scripts/ensure-swap.sh || true
else
  sudo bash deploy/scripts/ensure-swap.sh || true
fi

echo "==> Build & start containers (postgres + web)"
docker compose up -d --build postgres
bash deploy/scripts/db-up.sh
docker compose up -d --build web

echo "==> Wait for web healthy on :3000"
ok=0
for _ in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:3000" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done

if [[ "$ok" -ne 1 ]]; then
  echo "ERROR: web not responding on :3000"
  docker compose ps
  docker compose logs --tail=80 web
  exit 1
fi

echo "OK: app responding on :3000"
curl -fsSI "http://127.0.0.1/" | head -5 || true
docker compose ps

echo
echo "Optional seed (from host against published Postgres port):"
echo "  npm ci && npx prisma db push && npm run db:seed"
echo "  (DATABASE_URL in .env should use 127.0.0.1 for host-side tools)"
