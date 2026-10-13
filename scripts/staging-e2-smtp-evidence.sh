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
#
# Retry model (see src/lib/jobs.ts):
#   - Transient failures auto-requeue up to MAX_ATTEMPTS=3 (60s backoff).
#   - After 3 failures the job is status=failed.
#   - Admin → Jobs "Retry" is the operator recovery after credentials are fixed
#     (resets attempts and re-queues a terminal-failed job). E2 needs that path.
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

print_job_table() {
  local title="$1"
  local sql="$2"
  echo "### ${title}"
  echo
  echo "| Kind | Job id | Status | Attempts | Last error / SMTP | Updated |"
  echo "|------|--------|--------|----------|-------------------|---------|"
  mapfile -t ROWS < <(docker compose exec -T postgres psql -U "${PGUSER}" -d "${PGDB}" -v ON_ERROR_STOP=1 -At -F '|' -c "${sql}")
  if [[ ${#ROWS[@]} -eq 0 ]]; then
    echo "| (none) | — | — | — | — | — |"
    echo
    return 0
  fi
  for row in "${ROWS[@]}"; do
    [[ -z "${row}" ]] && continue
    IFS='|' read -r kind id status attempts detail updated <<<"${row}"
    echo "| ${kind} | ${id} | ${status} | ${attempts} | ${detail} | ${updated} |"
    if [[ "${status}" == "succeeded" ]]; then
      have_success=1
    fi
    if [[ "${status}" == "failed" ]]; then
      have_failed=1
    fi
  done
  echo
}

have_success=0
have_failed=0

LATEST_SQL=$(cat <<'SQL'
SELECT kind, id, status, attempts,
  COALESCE(
    NULLIF(payload->>'smtpResponse', ''),
    NULLIF(payload->>'externalId', ''),
    NULLIF("lastError", ''),
    '—'
  ) AS detail,
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

FAILED_SQL=$(cat <<'SQL'
SELECT kind, id, status, attempts,
  COALESCE(NULLIF("lastError", ''), '—') AS detail,
  to_char("updatedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
FROM "Job"
WHERE kind IN ('mail_test', 'verification_email', 'claim_verification_email')
  AND status = 'failed'
ORDER BY "updatedAt" DESC
LIMIT 5;
SQL
)

print_job_table "Latest mail job per kind" "${LATEST_SQL}"
print_job_table "Recent failed mail jobs (need Admin Retry after fix)" "${FAILED_SQL}"

echo "Retry model:"
echo "  - Failures auto-requeue up to 3 attempts (~60s apart)."
echo "  - Wait until status is failed (not queued/running) before fixing SMTP."
echo "  - Then Admin → Jobs → Retry (operator recovery). That is the E2 drill."
echo
echo "Operator checklist (fill docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md):"
echo "  1. Admin → Mail: SMTP Ready, send test invite to your inbox"
echo "  2. Complete account/claim verify (verification_email or claim_verification_email)"
echo "  3. Break SMTP password → wait for failed (3 auto attempts) → fix → Admin Retry"
echo "  4. Re-run this script; paste succeeded job id + SMTP line, and failed→retried id"
echo

if [[ "${have_success}" -eq 0 ]]; then
  echo "No succeeded mail jobs yet. Send a test from /admin/mail first."
  exit 1
fi

echo "At least one succeeded mail job is present. Confirm inbox delivery + retry drill for full E2."
if [[ "${have_failed}" -eq 0 ]]; then
  echo "Note: no failed mail job found — still run the intentional fail→Admin Retry drill."
  echo "Tip: leave the bad password in place for ~3 minutes so auto-retries exhaust to failed."
fi
