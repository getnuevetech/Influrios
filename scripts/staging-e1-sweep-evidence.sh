#!/usr/bin/env bash
# Phase M E1 — collect sweep-clock evidence on the host.
# Uses Docker Postgres (no tsx, no host-side prisma generate).
#
# Usage (from /var/www/influrios):
#   npm run staging:e1-sweep-evidence
#   bash scripts/staging-e1-sweep-evidence.sh
#   CRON_SECRET=... APP_URL=https://influrios.com bash scripts/staging-e1-sweep-evidence.sh --tick
#
# Does not mark Phase M complete.
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "${APP_DIR}"

if [[ ! -f .env ]]; then
  echo "ERROR: .env missing in ${APP_DIR}"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

PGUSER="${POSTGRES_USER:-influrios}"
PGDB="${POSTGRES_DB:-influrios}"
APP_URL="${APP_URL:-${NEXT_PUBLIC_APP_URL:-http://127.0.0.1:3000}}"
APP_URL="${APP_URL%/}"

echo "Influrios Phase M E1 sweep evidence"
echo
echo "When: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo

if [[ "${1:-}" == "--tick" ]]; then
  if [[ -z "${CRON_SECRET:-}" ]]; then
    echo "ERROR: --tick requires CRON_SECRET"
    exit 1
  fi
  echo "Tick POST ${APP_URL}/api/cron/sweeps"
  curl -sS -X POST \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    "${APP_URL}/api/cron/sweeps" | head -c 400
  echo
  echo
fi

if ! docker compose ps postgres --status running >/dev/null 2>&1; then
  echo "ERROR: postgres container is not running. Start the Compose stack, then retry."
  exit 1
fi

SQL=$(cat <<'SQL'
SELECT kind,
  COALESCE(
    (SELECT id FROM "Job" j2
      WHERE j2.kind = k.kind AND j2.status = 'succeeded'
      ORDER BY j2."updatedAt" DESC LIMIT 1),
    '—'
  ) AS succeeded_id,
  COALESCE(
    (SELECT to_char(j2."updatedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      FROM "Job" j2
      WHERE j2.kind = k.kind AND j2.status = 'succeeded'
      ORDER BY j2."updatedAt" DESC LIMIT 1),
    '—'
  ) AS succeeded_at,
  COALESCE(
    (SELECT status FROM "Job" j3
      WHERE j3.kind = k.kind
      ORDER BY j3."createdAt" DESC LIMIT 1),
    'never'
  ) AS latest_status
FROM (VALUES
  ('milestone_auto_approval'),
  ('recurring_cycle_sweep')
) AS k(kind)
ORDER BY kind;
SQL
)

echo "| Kind | Succeeded job id | Succeeded at | Latest status |"
echo "|------|------------------|--------------|---------------|"

# -A: unaligned, -t: tuples only, -F|: field separator
mapfile -t ROWS < <(docker compose exec -T postgres psql -U "${PGUSER}" -d "${PGDB}" -v ON_ERROR_STOP=1 -At -F '|' -c "${SQL}")

missing=0
for row in "${ROWS[@]}"; do
  [[ -z "${row}" ]] && continue
  IFS='|' read -r kind sid sat latest <<<"${row}"
  echo "| ${kind} | ${sid} | ${sat} | ${latest} |"
  if [[ "${sid}" == "—" ]]; then
    missing=$((missing + 1))
  fi
done

echo
if [[ "${missing}" -gt 0 ]]; then
  echo "Missing succeeded rows. On the host confirm:"
  echo "  crontab -l | grep sweep-cron"
  echo "  */5 * * * * CRON_SECRET=… APP_URL=https://influrios.com /var/www/influrios/deploy/scripts/sweep-cron.sh"
  echo "Then wait one interval or re-run with --tick."
  exit 1
fi

echo "E1 job ids present. Paste them into docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md."
echo "Crontab install is still an operator checkbox if not verified."
