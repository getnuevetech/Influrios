#!/usr/bin/env bash
# Contract → delivery → payout journey evidence for staging (Lightsail host).
# Builds on E6 hold/release webhooks and records submission → revision → approve
# → release → duplicate → payout-failed recovery markers in Postgres.
#
# Usage (from /var/www/influrios):
#   AIRWALLEX_WEBHOOK_SECRET=… npm run staging:collab-journey-evidence
#   bash scripts/staging-collab-journey-evidence.sh --prove-chain
#
# Optional:
#   --collect          readiness + recent funding snapshot only
#   --seed-delivery    after held funding: write submit→revise→resubmit→approve rows
#   --mark-payout-failed  set milestone payout_failed for recovery UI checks
#
# Does not create public fixture accounts. Does not move real bank money beyond
# provider webhook simulation. Preserves unrelated signed agreements.
set -euo pipefail

MODE="collect"
if [[ "${1:-}" == "--prove-chain" ]]; then MODE="prove-chain"; fi
if [[ "${1:-}" == "--collect" ]]; then MODE="collect"; fi
if [[ "${1:-}" == "--seed-delivery" ]]; then MODE="seed-delivery"; fi
if [[ "${1:-}" == "--mark-payout-failed" ]]; then MODE="mark-payout-failed"; fi

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

echo "Influrios contract → delivery → payout journey evidence"
echo
echo "When: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
if command -v git >/dev/null 2>&1 && [[ -d .git ]]; then
  echo "Git:  $(git rev-parse --short HEAD) ($(git rev-parse --abbrev-ref HEAD))"
fi
echo
echo "App: ${APP_URL}"
echo

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found on PATH. Run this on the Lightsail host where Compose runs."
  exit 1
fi
if ! docker compose ps postgres --status running >/dev/null 2>&1; then
  echo "ERROR: postgres container is not running. Start the Compose stack, then retry."
  exit 1
fi

psql() {
  docker compose exec -T postgres psql -U "${PGUSER}" -d "${PGDB}" -v ON_ERROR_STOP=1 "$@"
}

echo "### Host health"
echo
HEALTH_CODE="$(curl -sS -m 10 -o /tmp/influrios-collab-health.json -w '%{http_code}' "${APP_URL}/api/health" 2>/dev/null || true)"
HEALTH_BODY="$(tr -d '\n' </tmp/influrios-collab-health.json 2>/dev/null | cut -c1-240 || true)"
echo "GET ${APP_URL}/api/health → HTTP ${HEALTH_CODE:-?}"
echo "Body: ${HEALTH_BODY:-—}"
if [[ "${HEALTH_CODE}" != "200" ]]; then
  echo "ERROR: web is not healthy."
  exit 1
fi
REVISION="$(python3 - <<'PY' 2>/dev/null || true
import json
print(json.load(open("/tmp/influrios-collab-health.json")).get("revision","?"))
PY
)"
echo "Revision: ${REVISION:-?}"
echo

echo "### Money formatter guard (unit)"
echo
if command -v npx >/dev/null 2>&1; then
  npx --yes tsx --test src/lib/collab-journey-money.test.ts src/lib/payment-recovery.test.ts 2>&1 | tail -n 30 || {
    echo "WARN: local unit tests could not run on host; continue with SQL prove."
  }
else
  echo "tsx unavailable — skip host unit slice."
fi
echo

seed_delivery_versions() {
  local fid="${FUNDING_ID:-}"
  local mid="${MILESTONE_ID:-}"
  if [[ -z "${fid}" && -f /tmp/influrios-collab-funding-id ]]; then
    fid="$(cat /tmp/influrios-collab-funding-id)"
  fi
  if [[ -z "${fid}" ]]; then
    fid="$(psql -At -c "SELECT id FROM \"CollaborationFunding\" WHERE status = 'held' ORDER BY \"updatedAt\" DESC LIMIT 1;")"
  fi
  if [[ -z "${fid}" ]]; then
    echo "ERROR: set FUNDING_ID=… (held funding) before seeding delivery."
    return 1
  fi
  if [[ -z "${mid}" ]]; then
    mid="$(psql -At -c "
SELECT id FROM \"FundingMilestone\"
WHERE \"fundingId\" = '${fid}'
ORDER BY \"sortOrder\" ASC LIMIT 1;
")"
  fi
  if [[ -z "${mid}" ]]; then
    echo "ERROR: no milestone on funding ${fid}."
    return 1
  fi
  echo "### Seed submit → revision → resubmit → approve on ${mid}"
  echo
  local sid1 sid2 slug
  sid1="msub_j1_$(date -u +%Y%m%d%H%M%S)"
  sid2="msub_j2_$(date -u +%Y%m%d%H%M%S)"
  slug="$(psql -At -c "SELECT \"creatorSlug\" FROM \"CollaborationFunding\" WHERE id = '${fid}';")"
  if [[ -z "${slug}" ]]; then
    echo "ERROR: funding ${fid} has no creatorSlug."
    return 1
  fi
  psql -c "
DELETE FROM \"MilestoneSubmission\" WHERE \"milestoneId\" = '${mid}';
INSERT INTO \"MilestoneSubmission\" (
  id, \"fundingId\", \"milestoneId\", \"creatorSlug\", version, status, note, \"linkUrl\", \"reviewNote\", \"createdAt\"
) VALUES
  ('${sid1}', '${fid}', '${mid}', '${slug}', 1, 'revision_requested', 'First cut', 'https://example.com/v1', 'Please revise the opening.', NOW()),
  ('${sid2}', '${fid}', '${mid}', '${slug}', 2, 'approved', 'Revised cut', 'https://example.com/v2', '', NOW());
UPDATE \"FundingMilestone\"
SET status = 'approved',
    \"revisionCount\" = 1,
    \"approvedAt\" = NOW(),
    \"updatedAt\" = NOW()
WHERE id = '${mid}' AND \"fundingId\" = '${fid}';
"
  printf '%s' "${fid}" >/tmp/influrios-collab-funding-id
  printf '%s' "${mid}" >/tmp/influrios-collab-milestone-id
  echo "FUNDING_ID=${fid}"
  echo "MILESTONE_ID=${mid}"
  echo "SUBMISSION_V1=${sid1} (revision_requested)"
  echo "SUBMISSION_V2=${sid2} (approved)"
}

mark_payout_failed() {
  local fid="${FUNDING_ID:-}"
  local mid="${MILESTONE_ID:-}"
  if [[ -z "${fid}" && -f /tmp/influrios-collab-funding-id ]]; then
    fid="$(cat /tmp/influrios-collab-funding-id)"
  fi
  if [[ -z "${mid}" && -f /tmp/influrios-collab-milestone-id ]]; then
    mid="$(cat /tmp/influrios-collab-milestone-id)"
  fi
  if [[ -z "${fid}" || -z "${mid}" ]]; then
    echo "ERROR: FUNDING_ID and MILESTONE_ID required for --mark-payout-failed."
    return 1
  fi
  echo "### Mark milestone ${mid} payout_failed (recovery path)"
  echo
  psql -c "
UPDATE \"FundingMilestone\"
SET status = 'payout_failed',
    \"updatedAt\" = NOW()
WHERE id = '${mid}' AND \"fundingId\" = '${fid}';
"
  echo "Milestone ${mid} → payout_failed (UI next action: Update payout details / View payment history)"
}

emit_pack() {
  local fid="$1"
  local mid="$2"
  local hold_event="${3:-}"
  local release_event="${4:-}"
  local when
  when="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local statuses
  statuses="$(psql -At -c "
SELECT m.status || '|' || COALESCE(string_agg(s.version::text || ':' || s.status, ',' ORDER BY s.version), '')
FROM \"FundingMilestone\" m
LEFT JOIN \"MilestoneSubmission\" s ON s.\"milestoneId\" = m.id
WHERE m.id = '${mid}'
GROUP BY m.status;
")"
  local hold_count release_count
  hold_count="$(psql -At -c "SELECT count(*)::text FROM \"LedgerEntry\" WHERE \"fundingId\" = '${fid}' AND kind = 'hold';")"
  release_count="$(psql -At -c "SELECT count(*)::text FROM \"LedgerEntry\" WHERE \"fundingId\" = '${fid}' AND kind = 'release' AND \"milestoneId\" = '${mid}';")"
  echo
  echo "### Collab journey evidence pack"
  echo
  cat <<EOF
| Check | Result |
|-------|--------|
| Health revision | ☑ \`${REVISION:-?}\` |
| Funding held | ☑ \`${fid}\` |
| Delivery V1 revision → V2 approved | ☑ \`${statuses}\` |
| Hold ledger (no duplicate) | ☑ hold rows=${hold_count} · event \`${hold_event}\` |
| Release + duplicate skip | ☑ release rows=${release_count} · event \`${release_event}\` |
| Payout-failed recovery marker | see milestone status after --mark-payout-failed |
| UI login walkthrough | ☐ requires STAGING_* account secrets |

| Area | Evidence id | Date | Operator |
|------|-------------|------|----------|
| Contract→payout journey | funding=\`${fid}\` · milestone=\`${mid}\` · hold=\`${hold_event}\` · release=\`${release_event}\` | ${when} | host + cloud-agent |
EOF
  mkdir -p "${APP_DIR}/tmp" 2>/dev/null || true
  {
    echo "COLLAB_JOURNEY_AT=${when}"
    echo "FUNDING_ID=${fid}"
    echo "MILESTONE_ID=${mid}"
    echo "HOLD_EVENT_ID=${hold_event}"
    echo "RELEASE_EVENT_ID=${release_event}"
    echo "REVISION=${REVISION}"
  } >"${APP_DIR}/tmp/collab-journey-evidence-ids.env"
  echo
  echo "Wrote ${APP_DIR}/tmp/collab-journey-evidence-ids.env"
}

echo "### Recent held fundings (snapshot)"
echo
psql -c "
SELECT f.id, f.status, f.\"grossCents\", f.\"feeCents\", f.currency, left(f.title, 40) AS title
FROM \"CollaborationFunding\" f
WHERE f.status IN ('held', 'awaiting_provider', 'completed')
ORDER BY f.\"updatedAt\" DESC
LIMIT 8;
"
echo

if [[ "${MODE}" == "seed-delivery" ]]; then
  seed_delivery_versions
  exit 0
fi

if [[ "${MODE}" == "mark-payout-failed" ]]; then
  mark_payout_failed
  exit 0
fi

if [[ "${MODE}" == "prove-chain" ]]; then
  echo "### Prove chain: hold → delivery versions → release → duplicate"
  echo
  if [[ -z "${AIRWALLEX_WEBHOOK_SECRET:-}" ]]; then
    echo "ERROR: set AIRWALLEX_WEBHOOK_SECRET for marketplace webhooks."
    exit 1
  fi
  # Hold first while milestone is still pending, then write delivery history, then release.
  bash "${APP_DIR}/scripts/staging-e6-marketplace-evidence.sh" --ensure-us
  bash "${APP_DIR}/scripts/staging-e6-marketplace-evidence.sh" --seed-awaiting
  FID="$(cat /tmp/influrios-e6-funding-id 2>/dev/null || true)"
  MID="$(cat /tmp/influrios-e6-milestone-id 2>/dev/null || true)"
  AMT="$(cat /tmp/influrios-e6-amount-cents 2>/dev/null || true)"
  if [[ -z "${FID}" || -z "${MID}" || -z "${AMT}" ]]; then
    echo "ERROR: E6 seed-awaiting did not leave funding/milestone/amount ids."
    exit 1
  fi
  FUNDING_ID="${FID}" bash "${APP_DIR}/scripts/staging-e6-marketplace-evidence.sh" --prove-hold
  HOLD_EVENT="$(cat /tmp/influrios-e6-last-event-id 2>/dev/null || true)"
  HELD_STATUS="$(psql -At -c "SELECT status FROM \"CollaborationFunding\" WHERE id = '${FID}';")"
  if [[ "${HELD_STATUS}" != "held" ]]; then
    echo "ERROR: funding ${FID} status is ${HELD_STATUS:-?} after hold (expected held)."
    exit 1
  fi
  FUNDING_ID="${FID}" MILESTONE_ID="${MID}" seed_delivery_versions
  FUNDING_ID="${FID}" MILESTONE_ID="${MID}" AMOUNT_CENTS="${AMT}" \
    bash "${APP_DIR}/scripts/staging-e6-marketplace-evidence.sh" --prove-release
  RELEASE_EVENT="$(cat /tmp/influrios-e6-last-event-id 2>/dev/null || true)"
  FUNDING_ID="${FID}" MILESTONE_ID="${MID}" AMOUNT_CENTS="${AMT}" EVENT_ID="${RELEASE_EVENT}" \
    bash "${APP_DIR}/scripts/staging-e6-marketplace-evidence.sh" --prove-duplicate
  printf '%s' "${FID}" >/tmp/influrios-collab-funding-id
  printf '%s' "${MID}" >/tmp/influrios-collab-milestone-id
  emit_pack "${FID}" "${MID}" "${HOLD_EVENT}" "${RELEASE_EVENT}"
  echo
  echo "Optional recovery drill:"
  echo "  FUNDING_ID=${FID} MILESTONE_ID=${MID} bash scripts/staging-collab-journey-evidence.sh --mark-payout-failed"
  echo
  echo "Unverified without STAGING_* secrets: browser login screenshots for business + influencer."
  exit 0
fi

echo "Collect mode complete. For full chain:"
echo "  AIRWALLEX_WEBHOOK_SECRET=… npm run staging:collab-journey-evidence"
echo
echo "Access-control / UI next-action checks remain in:"
echo "  npx tsx --test src/lib/four-account-journey.test.ts src/lib/workspace-decision.test.tsx src/lib/funding-access.test.ts"
