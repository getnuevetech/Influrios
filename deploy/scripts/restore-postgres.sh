#!/usr/bin/env bash
# Restore Influrios Postgres from a gzip dump (Phase N).
# Stops the web container first so nothing writes mid-restore.
#
# Usage: bash deploy/scripts/restore-postgres.sh /var/backups/influrios/influrios-YYYYMMDD-HHMMSS.sql.gz
set -euo pipefail

DUMP="${1:-}"
if [[ -z "${DUMP}" || ! -f "${DUMP}" ]]; then
  echo "Usage: bash deploy/scripts/restore-postgres.sh <dump.sql.gz>"
  exit 1
fi

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "${APP_DIR}"

if [[ ! -f .env ]]; then
  echo "ERROR: .env missing."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

PGUSER="${POSTGRES_USER:-influrios}"
PGDB="${POSTGRES_DB:-influrios}"

echo "==> Stopping web (keeps postgres up)"
docker compose stop web || true

echo "==> Recreating empty database ${PGDB}"
docker compose exec -T postgres psql -U "${PGUSER}" -d postgres -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${PGDB}' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "${PGDB}";
CREATE DATABASE "${PGDB}" OWNER "${PGUSER}";
SQL

echo "==> Restoring ${DUMP}"
gunzip -c "${DUMP}" | docker compose exec -T postgres psql -U "${PGUSER}" -d "${PGDB}" -v ON_ERROR_STOP=1

echo "==> Applying migrations"
docker compose run --rm --no-deps web npx prisma migrate deploy

echo "==> Starting web"
docker compose up -d web

echo "==> Health check"
sleep 3
if curl -fsS "http://127.0.0.1:3000/api/health" >/dev/null; then
  echo "OK: /api/health is green"
else
  echo "WARN: /api/health did not return 200 yet — check: docker compose logs -f web"
  exit 1
fi
