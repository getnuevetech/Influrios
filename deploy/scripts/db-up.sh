#!/usr/bin/env bash
# Start Influrios Postgres (Docker) and wait until healthy.
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "${APP_DIR}"

if [[ ! -f .env ]]; then
  echo "ERROR: .env missing. Copy .env.example → .env and set POSTGRES_PASSWORD / DATABASE_URL."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found. Install Docker first (see docs/deploy/FRESH_SERVER_SETUP.md)."
  exit 1
fi

echo "==> Starting Postgres container"
docker compose up -d postgres

echo "==> Waiting for Postgres healthy…"
for i in $(seq 1 60); do
  status="$(docker compose ps --format json postgres 2>/dev/null | head -1 || true)"
  if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-influrios}" -d "${POSTGRES_DB:-influrios}" >/dev/null 2>&1; then
    echo "OK: Postgres is ready"
    docker compose ps postgres
    exit 0
  fi
  # Fallback health via docker inspect
  if docker inspect --format='{{.State.Health.Status}}' influrios-postgres 2>/dev/null | grep -q healthy; then
    echo "OK: Postgres is healthy"
    exit 0
  fi
  sleep 1
done

echo "ERROR: Postgres did not become ready in time. Check: docker compose logs postgres"
exit 1
