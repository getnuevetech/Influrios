#!/usr/bin/env bash
# Phase M E2 — collect SMTP mail job evidence on the host.
# Uses Docker Postgres (no tsx / host prisma generate).
#
# Usage (from /var/www/influrios):
#   npm run staging:e2-smtp-evidence
#   bash scripts/staging-e2-smtp-evidence.sh
#
# After Admin → Mail test send / verify / retry, re-run to print job ids + SMTP accept lines.
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

echo "Influrios Phase M E2 SMTP evidence"
echo
echo "When: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found on PATH. Run this on the Lightsail host where Compose runs."
  exit 1
fi
if ! docker compose ps postgres --status running >/dev/null 2>&1; then
  echo "ERROR: postgres container is not running. Start the Compose stack, then retry."
  exit 1
fi

SQL=$(cat <<'SQL'
SELECT kind, id, status,
  COALESCE(NULLIF("lastError", ''), '—') AS last_error,
  COALESCE(
    NULLIF(payload->>'smtpResponse', ''),
    NULLIF(payload->>'externalId', ''),
    '—'
  ) AS smtp_or_external,
  to_char("updatedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
FROM (
  SELECT DISTINCT ON (kind) *
  FROM "Job"
  WHERE kind IN ('mail_test', 'verification_email', 'claim_verification_email')
  ORDER BY kind, "updatedAt" DESC
) latest
ORDER BY kind;
SQL
)

echo "| Kind | Job id | Status | SMTP / external | Updated |"
echo "|------|--------|--------|-----------------|---------|"

mapfile -t ROWS < <(docker compose exec -T postgres psql -U "${PGUSER}" -d "${PGDB}" -v ON_ERROR_STOP=1 -At -F '|' -c "${SQL}")

have_success=0
have_failed=0
if [[ ${#ROWS[@]} -eq 0 ]]; then
  echo "| (none) | — | — | — | — |"
else
  for row in "${ROWS[@]}"; do
    [[ -z "${row}" ]] && continue
    IFS='|' read -r kind id status last_error smtp updated <<<"${row}"
    echo "| ${kind} | ${id} | ${status} | ${smtp} | ${updated} |"
    if [[ "${status}" == "succeeded" ]]; then
      have_success=1
    fi
    if [[ "${status}" == "failed" ]]; then
      have_failed=1
    fi
  done
fi

echo
echo "Operator checklist (fill docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md):"
echo "  1. Admin → Mail: SMTP Ready, send test invite to your inbox"
echo "  2. Complete account/claim verify (verification_email or claim_verification_email)"
echo "  3. Break SMTP password → confirm a failed job → fix → Retry from Admin → Jobs"
echo "  4. Re-run this script; paste succeeded job id + SMTP accept line, and failed→succeeded retry id"
echo

if [[ "${have_success}" -eq 0 ]]; then
  echo "No succeeded mail jobs yet. Send a test from /admin/mail first."
  exit 1
fi

echo "At least one succeeded mail job is present. Confirm inbox delivery + retry drill for full E2."
if [[ "${have_failed}" -eq 0 ]]; then
  echo "Note: no failed mail job in the latest-per-kind set — still run the intentional fail→retry drill."
fi
