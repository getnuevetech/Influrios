#!/usr/bin/env bash
# Dump Influrios Postgres to a gzip file (Phase N).
# Usage: bash deploy/scripts/backup-postgres.sh
set -euo pipefail

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
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/influrios}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${BACKUP_ROOT}/influrios-${STAMP}.sql.gz"

mkdir -p "${BACKUP_ROOT}"

if ! docker compose ps postgres --status running >/dev/null 2>&1; then
  echo "ERROR: postgres container is not running. Start with: bash deploy/scripts/db-up.sh"
  exit 1
fi

echo "==> Dumping ${PGDB} as ${PGUSER} → ${OUT}"
docker compose exec -T postgres pg_dump -U "${PGUSER}" "${PGDB}" | gzip -c > "${OUT}"
ls -lh "${OUT}"

# Keep 14 days by default
find "${BACKUP_ROOT}" -name 'influrios-*.sql.gz' -type f -mtime +14 -delete 2>/dev/null || true
echo "OK: backup written. Restore with: bash deploy/scripts/restore-postgres.sh ${OUT}"
