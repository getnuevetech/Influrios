#!/usr/bin/env bash
# Phase M E8 — recurring tranche evidence (collect + optional prove).
# Uses Docker Postgres + curl (no tsx / host prisma generate).
#
# Usage (from /var/www/influrios):
#   npm run staging:e8-recurring-evidence
#   bash scripts/staging-e8-recurring-evidence.sh
#   CRON_SECRET=… npm run staging:e8-prove-chain
#
# Prove path: seed 3-occurrence series → SQL-hold tranche 1 (hold 2d ago) →
# cron sweep opens tranche 2 → stop series → second sweep does not open tranche 3.
#
# Does not mark Phase M complete.
set -euo pipefail

MODE="collect"
if [[ "${1:-}" == "--prove-chain" ]]; then MODE="prove-chain"; fi

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

psql() {
  docker compose exec -T postgres psql -U "${PGUSER}" -d "${PGDB}" -v ON_ERROR_STOP=1 "$@"
}

echo "Influrios Phase M E8 Recurring tranche evidence"
echo
echo "When: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
if command -v git >/dev/null 2>&1 && [[ -d .git ]]; then
  echo "Git:  $(git rev-parse --short HEAD) ($(git rev-parse --abbrev-ref HEAD))"
fi
echo
echo "App: ${APP_URL}"
echo "Mode: ${MODE}"
echo

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found on PATH. Run this on the Lightsail host where Compose runs."
  exit 1
fi
if ! docker compose ps postgres --status running >/dev/null 2>&1; then
  echo "ERROR: postgres container is not running. Start the Compose stack, then retry."
  exit 1
fi

echo "### Host health"
echo
HEALTH_CODE="$(curl -sS -m 10 -o /tmp/influrios-e8-health.json -w '%{http_code}' "${APP_URL}/api/health" 2>/dev/null || true)"
HEALTH_BODY="$(tr -d '\n' </tmp/influrios-e8-health.json 2>/dev/null | cut -c1-240 || true)"
echo "GET ${APP_URL}/api/health → HTTP ${HEALTH_CODE:-?}"
echo "Body: ${HEALTH_BODY:-—}"
if [[ "${HEALTH_CODE}" != "200" ]]; then
  echo "ERROR: health is not 200. Fix the app before collecting E8 evidence."
  exit 1
fi
echo

echo "### Recurring series snapshot"
echo
echo "| Schedule id | Tranches | Stopped | Latest status | Interval | Title |"
echo "|-------------|----------|---------|---------------|----------|-------|"
mapfile -t SERIES < <(psql -At -F '|' -c "
SELECT
  COALESCE(NULLIF(\"scheduleId\", ''), '—'),
  count(*)::text,
  bool_or(\"seriesStopped\")::text,
  string_agg(status || '#' || \"trancheIndex\"::text, ', ' ORDER BY \"trancheIndex\"),
  max(\"intervalDays\")::text,
  left(max(replace(title, '|', '/')), 40)
FROM \"CollaborationFunding\"
WHERE \"scheduleKind\" = 'recurring'
GROUP BY \"scheduleId\"
ORDER BY max(\"updatedAt\") DESC
LIMIT 8;
")
if [[ ${#SERIES[@]} -eq 0 ]]; then
  echo "| (none) | — | — | — | — | — |"
else
  for row in "${SERIES[@]}"; do
    IFS='|' read -r sid count stopped statuses interval title <<<"${row}"
    echo "| ${sid} | ${count} | ${stopped} | ${statuses} | ${interval} | ${title} |"
  done
fi
echo

echo "### Succeeded recurring_cycle_sweep jobs"
echo
echo "| Job id | Updated |"
echo "|--------|---------|"
mapfile -t SWEEPS < <(psql -At -F '|' -c "
SELECT id, to_char(\"updatedAt\" AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
FROM \"Job\"
WHERE kind = 'recurring_cycle_sweep' AND status = 'succeeded'
ORDER BY \"updatedAt\" DESC
LIMIT 5;
")
if [[ ${#SWEEPS[@]} -eq 0 ]]; then
  echo "| (none) | — |"
else
  for row in "${SWEEPS[@]}"; do
    IFS='|' read -r jid updated <<<"${row}"
    echo "| ${jid} | ${updated} |"
  done
fi
echo

echo "### Paste checklist (E8)"
echo
echo "| Check | Evidence |"
echo "|-------|----------|"
echo "| Tranche 1 held | funding id + hold event id |"
echo "| Sweep opens tranche 2 | scheduleId + tranche 2 id · status awaiting_provider |"
echo "| Stop blocks tranche 3 | seriesStopped=true · still 2 rows after later sweep |"
echo "| Payments UI | schedule label + Stop later tranches on business payment detail |"
echo "| Host script | npm run staging:e8-recurring-evidence |"
echo

if [[ "${MODE}" != "prove-chain" ]]; then
  echo "Collect-only complete. For the prove path:"
  echo "  CRON_SECRET=… npm run staging:e8-prove-chain"
  exit 0
fi

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "ERROR: prove-chain needs CRON_SECRET for the sweep tick."
  exit 1
fi

e8_id() {
  printf 'e8_%s_%s' "$(date -u +%Y%m%d%H%M%S)" "$(openssl rand -hex 4)"
}

SCHEDULE_ID="$(e8_id)"
FUNDING_ID="$(e8_id)"
MILESTONE_ID="$(e8_id)"
HOLD_ENTRY_ID="$(e8_id)_hold"
HOLD_EVENT="e8_hold_${FUNDING_ID}"
TITLE="E8 recurring prove ${SCHEDULE_ID}"
GROSS=15000
FEE=1200
CAPTURED="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "### Ensure US + recurring settings + charge switch"
echo
psql -c "
INSERT INTO \"CollaborationJurisdiction\" (
  code, label, \"protectedPaymentsEnabled\", \"legalReviewStatus\", \"providerCode\", currency, \"minorDigits\", \"updatedAt\"
) VALUES (
  'US', 'United States', true, 'APPROVED', 'airwallex', 'USD', 2, NOW()
)
ON CONFLICT (code) DO UPDATE SET
  \"protectedPaymentsEnabled\" = true,
  \"fullPrefundingEnabled\" = true,
  \"stagedPrefundingEnabled\" = true,
  \"recurringFundingEnabled\" = true,
  \"legalReviewStatus\" = 'APPROVED',
  \"updatedAt\" = NOW();

UPDATE \"MarketplaceSettings\"
SET \"stagedFundingEnabled\" = true,
    \"recurringFundingEnabled\" = true,
    \"recurringIntervalDays\" = 1,
    \"updatedAt\" = NOW()
WHERE id = 'default';

INSERT INTO \"PaymentChargeSwitch\" (key, enabled, \"updatedAt\")
VALUES ('recurring_collection', true, NOW())
ON CONFLICT (key) DO UPDATE SET enabled = true, \"updatedAt\" = NOW();
" >/dev/null

echo "### Seed tranche 1 held (interval already due)"
echo
psql -c "
INSERT INTO \"CollaborationFunding\" (
  id, \"jurisdictionCode\", \"businessName\", \"creatorSlug\", title, currency,
  \"grossCents\", \"feeCents\", \"feeSnapshotJson\", \"serviceLevel\", status, \"providerCode\",
  \"fundingMode\", \"scheduleId\", \"scheduleKind\", \"trancheIndex\", \"trancheCount\",
  \"intervalDays\", \"seriesStopped\", \"updatedAt\"
) VALUES (
  '${FUNDING_ID}',
  'US',
  'E8 Drill Business',
  'e8-drill-creator',
  '${TITLE}',
  'USD',
  ${GROSS},
  ${FEE},
  '{\"feeType\":\"\",\"feeCents\":${FEE},\"explanation\":\"E8 staging drill.\",\"capturedAt\":\"${CAPTURED}\"}'::jsonb,
  'contracted',
  'held',
  'primary',
  'RECURRING',
  '${SCHEDULE_ID}',
  'recurring',
  1,
  3,
  1,
  false,
  NOW()
);

INSERT INTO \"FundingMilestone\" (
  id, \"fundingId\", title, \"amountCents\", \"sortOrder\", status,
  \"reviewWindowHours\", \"revisionLimit\", \"updatedAt\"
) VALUES (
  '${MILESTONE_ID}',
  '${FUNDING_ID}',
  'E8 Delivery',
  ${GROSS},
  0,
  'pending',
  72,
  2,
  NOW()
);

INSERT INTO \"LedgerEntry\" (
  id, \"fundingId\", kind, \"amountCents\", provider, \"eventId\", \"createdAt\"
) VALUES (
  '${HOLD_ENTRY_ID}',
  '${FUNDING_ID}',
  'hold',
  ${GROSS},
  'primary',
  '${HOLD_EVENT}',
  NOW() - INTERVAL '2 days'
);
" >/dev/null

echo "Seeded schedule ${SCHEDULE_ID} tranche1 ${FUNDING_ID} hold ${HOLD_EVENT}"
echo

echo "### Sweep tick (open tranche 2)"
echo
TICK1="$(curl -sS -m 60 -X POST -H "Authorization: Bearer ${CRON_SECRET}" "${APP_URL}/api/cron/sweeps" || true)"
echo "Tick 1: ${TICK1:0:400}"
echo
sleep 3

COUNT_AFTER="$(psql -At -c "SELECT count(*)::text FROM \"CollaborationFunding\" WHERE \"scheduleId\" = '${SCHEDULE_ID}';")"
T2_ID="$(psql -At -c "SELECT id FROM \"CollaborationFunding\" WHERE \"scheduleId\" = '${SCHEDULE_ID}' AND \"trancheIndex\" = 2 LIMIT 1;" || true)"
T2_STATUS="$(psql -At -c "SELECT COALESCE(status, '') FROM \"CollaborationFunding\" WHERE id = '${T2_ID}';" 2>/dev/null || true)"
echo "Series row count after sweep: ${COUNT_AFTER}"
echo "Tranche 2 id: ${T2_ID:-—} status: ${T2_STATUS:-—}"
echo

echo "### Stop series"
echo
psql -c "
UPDATE \"CollaborationFunding\"
SET \"seriesStopped\" = true, \"updatedAt\" = NOW()
WHERE \"scheduleId\" = '${SCHEDULE_ID}' AND \"scheduleKind\" = 'recurring';
UPDATE \"LedgerEntry\"
SET \"createdAt\" = NOW() - INTERVAL '10 days'
WHERE id = '${HOLD_ENTRY_ID}';
" >/dev/null

echo "### Sweep tick after stop (must not open tranche 3)"
echo
TICK2="$(curl -sS -m 60 -X POST -H "Authorization: Bearer ${CRON_SECRET}" "${APP_URL}/api/cron/sweeps" || true)"
echo "Tick 2: ${TICK2:0:400}"
echo
sleep 3

FINAL_COUNT="$(psql -At -c "SELECT count(*)::text FROM \"CollaborationFunding\" WHERE \"scheduleId\" = '${SCHEDULE_ID}';")"
STOPPED="$(psql -At -c "SELECT bool_and(\"seriesStopped\")::text FROM \"CollaborationFunding\" WHERE \"scheduleId\" = '${SCHEDULE_ID}';")"
T3="$(psql -At -c "SELECT id FROM \"CollaborationFunding\" WHERE \"scheduleId\" = '${SCHEDULE_ID}' AND \"trancheIndex\" = 3 LIMIT 1;" || true)"
SWEEP_JOB="$(psql -At -c "SELECT id FROM \"Job\" WHERE kind = 'recurring_cycle_sweep' AND status = 'succeeded' ORDER BY \"updatedAt\" DESC LIMIT 1;" || true)"
STATUS1="$(psql -At -c "SELECT status FROM \"CollaborationFunding\" WHERE id = '${FUNDING_ID}';")"

mkdir -p tmp
cat > tmp/e8-evidence-ids.env <<EOF
E8_SCHEDULE_ID=${SCHEDULE_ID}
E8_TRANCHE1_ID=${FUNDING_ID}
E8_TRANCHE1_HOLD_EVENT=${HOLD_EVENT}
E8_TRANCHE2_ID=${T2_ID:-}
E8_TRANCHE2_STATUS=${T2_STATUS:-}
E8_SERIES_COUNT=${FINAL_COUNT}
E8_SERIES_STOPPED=${STOPPED}
E8_TRANCHE3_ID=${T3:-}
E8_SWEEP_JOB=${SWEEP_JOB:-}
E8_WHEN=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

echo "### E8 evidence pack"
echo
echo "| Field | Value |"
echo "|-------|-------|"
echo "| scheduleId | ${SCHEDULE_ID} |"
echo "| tranche 1 funding id | ${FUNDING_ID} |"
echo "| tranche 1 hold event | ${HOLD_EVENT} |"
echo "| tranche 1 status | ${STATUS1} |"
echo "| tranche 2 funding id | ${T2_ID:-—} |"
echo "| tranche 2 status | ${T2_STATUS:-—} |"
echo "| seriesStopped | ${STOPPED} |"
echo "| series row count | ${FINAL_COUNT} |"
echo "| tranche 3 id | ${T3:-—(none)} |"
echo "| latest recurring_cycle_sweep job | ${SWEEP_JOB:-—} |"
echo
echo "Wrote tmp/e8-evidence-ids.env"
echo

OK=1
if [[ "${FINAL_COUNT}" -lt 2 ]]; then
  echo "FAIL: expected ≥2 series rows after first sweep (got ${FINAL_COUNT})"
  OK=0
fi
if [[ "${STOPPED}" != "t" ]]; then
  echo "FAIL: seriesStopped should be true (got ${STOPPED})"
  OK=0
fi
if [[ -n "${T3}" ]]; then
  echo "FAIL: tranche 3 should not exist (got ${T3})"
  OK=0
fi

if [[ "${OK}" -eq 1 ]]; then
  echo "E8 prove-chain OK — paste the table into docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md"
  exit 0
fi

echo "E8 prove-chain incomplete — see FAIL lines above."
exit 1
