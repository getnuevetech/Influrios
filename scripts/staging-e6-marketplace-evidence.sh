#!/usr/bin/env bash
# Phase M E6 — collect marketplace hold → release evidence (Airwallex or primary).
# Uses Docker Postgres + curl (no tsx / host prisma generate).
#
# Usage (from /var/www/influrios):
#   npm run staging:e6-marketplace-evidence
#   bash scripts/staging-e6-marketplace-evidence.sh
#
# Optional prove (posts signed webhooks; needs a funding in awaiting_provider):
#   FUNDING_ID=… AIRWALLEX_WEBHOOK_SECRET=… bash scripts/staging-e6-marketplace-evidence.sh --prove-hold
#   FUNDING_ID=… MILESTONE_ID=… AIRWALLEX_WEBHOOK_SECRET=… AMOUNT_CENTS=… \
#     bash scripts/staging-e6-marketplace-evidence.sh --prove-release
#   Same env + --prove-duplicate to replay the last release event id (expects duplicate).
#
# Prefer Airwallex (exit-table row). Primary Influrios signature works if MARKETPLACE_WEBHOOK_SECRET
# is set and x-influrios-provider=primary (see scripts/marketplace-webhook-fixture.ts).
#
# Does not mark Phase M complete.
set -euo pipefail

MODE="collect"
if [[ "${1:-}" == "--prove-hold" ]]; then MODE="prove-hold"; fi
if [[ "${1:-}" == "--prove-release" ]]; then MODE="prove-release"; fi
if [[ "${1:-}" == "--prove-duplicate" ]]; then MODE="prove-duplicate"; fi

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

echo "Influrios Phase M E6 Marketplace hold → release evidence"
echo
echo "When: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo
echo "Webhook: ${APP_URL}/api/marketplace/webhook"
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

hmac_hex() {
  local body="$1"
  local secret="$2"
  printf '%s' "${body}" | openssl dgst -sha256 -hmac "${secret}" | awk '{print $NF}'
}

echo "### Webhook readiness (no signature)"
echo
WH_CODE="$(
  curl -sS -m 15 -o /tmp/influrios-e6-wh.json -w '%{http_code}' -X POST \
    "${APP_URL}/api/marketplace/webhook" \
    -H "content-type: application/json" \
    -H "x-influrios-provider: airwallex" \
    -d '{"id":"probe","name":"payment_intent.succeeded","data":{"object":{"amount":1,"metadata":{"fundingId":"x"}}}}' \
    2>/dev/null || true
)"
WH_BODY="$(tr -d '\n' </tmp/influrios-e6-wh.json 2>/dev/null | cut -c1-200 || true)"
echo "POST …/api/marketplace/webhook (airwallex, unsigned) → HTTP ${WH_CODE:-?}"
echo "Body: ${WH_BODY:-—}"
case "${WH_CODE}" in
  401) echo "Airwallex webhook secret path looks ready (bad/missing signature → 401)." ;;
  503) echo "Airwallex not ready — Admin → Gateways → Airwallex: enable + client id + API key + base URL + webhook secret." ;;
  *) echo "Note: expected 401 (signature) or 503 (not ready). Fix gateways if this is unexpected." ;;
esac
echo

echo "### Payment / marketplace providers"
echo
echo "| Kind | Code | Enabled | Secret | Webhook |"
echo "|------|------|---------|--------|---------|"
mapfile -t PROVS < <(psql -At -F '|' -c "
SELECT
  kind,
  code,
  CASE WHEN enabled THEN 'yes' ELSE 'no' END,
  CASE
    WHEN \"secretCipher\" IS NULL OR length(trim(\"secretCipher\")) = 0 THEN 'missing'
    ELSE 'saved'
  END,
  CASE
    WHEN \"webhookCipher\" IS NULL OR length(trim(\"webhookCipher\")) = 0 THEN 'missing'
    ELSE 'saved'
  END
FROM \"IntegrationProvider\"
WHERE (kind = 'payment' AND code = 'airwallex')
   OR (kind = 'marketplace')
ORDER BY kind, code;
")
if [[ ${#PROVS[@]} -eq 0 ]]; then
  echo "| (none) | — | — | — | — |"
else
  for row in "${PROVS[@]}"; do
    IFS='|' read -r kind code enabled secret webhook <<<"${row}"
    echo "| ${kind} | ${code} | ${enabled} | ${secret} | ${webhook} |"
  done
fi
echo

echo "### Jurisdictions (prefer US protected payments)"
echo
echo "| Code | Label | Protected | Legal | Provider |"
echo "|------|-------|-----------|-------|----------|"
mapfile -t JURS < <(psql -At -F '|' -c "
SELECT
  code,
  label,
  CASE WHEN \"protectedPaymentsEnabled\" THEN 'yes' ELSE 'no' END,
  \"legalReviewStatus\",
  COALESCE(NULLIF(\"providerCode\", ''), '—')
FROM \"CollaborationJurisdiction\"
ORDER BY code;
")
if [[ ${#JURS[@]} -eq 0 ]]; then
  echo "| (none) | — | — | — | — |"
else
  for row in "${JURS[@]}"; do
    IFS='|' read -r code label protected legal provider <<<"${row}"
    echo "| ${code} | ${label} | ${protected} | ${legal} | ${provider} |"
  done
fi
echo

echo "### Recent CollaborationFunding"
echo
echo "| Funding id | Status | Jurisdiction | Gross | Provider | Title | Updated |"
echo "|------------|--------|--------------|-------|----------|-------|---------|"
mapfile -t FUNDS < <(psql -At -F '|' -c "
SELECT
  id,
  status,
  \"jurisdictionCode\",
  \"grossCents\"::text,
  COALESCE(NULLIF(\"providerCode\", ''), '—'),
  left(replace(title, '|', '/'), 40),
  to_char(\"updatedAt\" AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
FROM \"CollaborationFunding\"
ORDER BY \"updatedAt\" DESC
LIMIT 8;
")
if [[ ${#FUNDS[@]} -eq 0 ]]; then
  echo "| (none) | — | — | — | — | — | — |"
else
  for row in "${FUNDS[@]}"; do
    IFS='|' read -r id status jur gross provider title updated <<<"${row}"
    echo "| ${id} | ${status} | ${jur} | ${gross} | ${provider} | ${title} | ${updated} |"
  done
fi
echo

echo "### Milestones (latest fundings)"
echo
echo "| Milestone id | Funding id | Status | Amount | Title |"
echo "|--------------|------------|--------|--------|-------|"
mapfile -t MS < <(psql -At -F '|' -c "
SELECT
  m.id,
  m.\"fundingId\",
  m.status,
  m.\"amountCents\"::text,
  left(replace(m.title, '|', '/'), 32)
FROM \"FundingMilestone\" m
JOIN \"CollaborationFunding\" f ON f.id = m.\"fundingId\"
ORDER BY f.\"updatedAt\" DESC, m.\"sortOrder\" ASC
LIMIT 12;
")
if [[ ${#MS[@]} -eq 0 ]]; then
  echo "| (none) | — | — | — | — |"
else
  for row in "${MS[@]}"; do
    IFS='|' read -r mid fid status amount title <<<"${row}"
    echo "| ${mid} | ${fid} | ${status} | ${amount} | ${title} |"
  done
fi
echo

echo "### Marketplace ProcessedWebhook (recent)"
echo
echo "| Provider | Event id | Type | Result | Created |"
echo "|----------|----------|------|--------|---------|"
mapfile -t WH < <(psql -At -F '|' -c "
SELECT
  provider,
  left(\"eventId\", 48),
  \"eventType\",
  result,
  to_char(\"createdAt\" AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
FROM \"ProcessedWebhook\"
WHERE provider LIKE 'marketplace:%'
ORDER BY \"createdAt\" DESC
LIMIT 10;
")
if [[ ${#WH[@]} -eq 0 ]]; then
  echo "| (none) | — | — | — | — |"
else
  for row in "${WH[@]}"; do
    IFS='|' read -r provider eid etype result created <<<"${row}"
    echo "| ${provider} | ${eid} | ${etype} | ${result} | ${created} |"
  done
fi
echo

echo "### Ledger entries (recent holds / releases)"
echo
echo "| Funding id | Kind | Amount | Provider | Event id |"
echo "|------------|------|--------|----------|----------|"
mapfile -t LED < <(psql -At -F '|' -c "
SELECT
  \"fundingId\",
  kind,
  \"amountCents\"::text,
  COALESCE(provider, '—'),
  left(COALESCE(\"eventId\", '—'), 40)
FROM \"LedgerEntry\"
ORDER BY \"createdAt\" DESC
LIMIT 10;
")
if [[ ${#LED[@]} -eq 0 ]]; then
  echo "| (none) | — | — | — | — |"
else
  for row in "${LED[@]}"; do
    IFS='|' read -r fid kind amount provider eid <<<"${row}"
    echo "| ${fid} | ${kind} | ${amount} | ${provider} | ${eid} |"
  done
fi
echo

post_airwallex() {
  local name="$1"
  local funding_id="$2"
  local amount="$3"
  local milestone_id="${4:-}"
  local event_id="${5:-}"
  local secret="${AIRWALLEX_WEBHOOK_SECRET:-}"
  if [[ -z "${secret}" ]]; then
    echo "ERROR: set AIRWALLEX_WEBHOOK_SECRET to the same value saved on Admin → Gateways → Airwallex."
    return 1
  fi
  if [[ -z "${event_id}" ]]; then
    event_id="e6_${name//./_}_$(date -u +%Y%m%d%H%M%S)_${RANDOM}"
  fi
  local meta
  if [[ -n "${milestone_id}" ]]; then
    meta="\"fundingId\":\"${funding_id}\",\"milestoneId\":\"${milestone_id}\""
  else
    meta="\"fundingId\":\"${funding_id}\""
  fi
  local body
  body="$(printf '{"id":"%s","name":"%s","data":{"object":{"id":"obj_%s","amount":%s,"metadata":{%s}}}}' \
    "${event_id}" "${name}" "${event_id}" "${amount}" "${meta}")"
  local sig
  sig="$(hmac_hex "${body}" "${secret}")"
  echo "POST Airwallex ${name} eventId=${event_id} funding=${funding_id} amount=${amount} milestone=${milestone_id:-—}"
  local code
  code="$(
    curl -sS -m 30 -o /tmp/influrios-e6-prove.json -w '%{http_code}' -X POST \
      "${APP_URL}/api/marketplace/webhook" \
      -H "content-type: application/json" \
      -H "x-influrios-provider: airwallex" \
      -H "x-airwallex-signature: ${sig}" \
      -d "${body}" || true
  )"
  echo "→ HTTP ${code} $(tr -d '\n' </tmp/influrios-e6-prove.json | cut -c1-240)"
  echo "${event_id}" >/tmp/influrios-e6-last-event-id
  echo "${code}" >/tmp/influrios-e6-last-http
}

if [[ "${MODE}" == "prove-hold" ]]; then
  echo "### Prove hold"
  echo
  FID="${FUNDING_ID:-}"
  if [[ -z "${FID}" ]]; then
    FID="$(psql -At -c "SELECT id FROM \"CollaborationFunding\" WHERE status = 'awaiting_provider' ORDER BY \"updatedAt\" DESC LIMIT 1;")"
  fi
  if [[ -z "${FID}" ]]; then
    echo "ERROR: no awaiting_provider funding. Create one (business collab wizard) or set FUNDING_ID=…"
    exit 1
  fi
  GROSS="$(psql -At -c "SELECT \"grossCents\"::text FROM \"CollaborationFunding\" WHERE id = '${FID}';")"
  post_airwallex "payment_intent.succeeded" "${FID}" "${GROSS}"
  echo
  echo "Re-run without flags to collect held status + ledger hold row."
  exit 0
fi

if [[ "${MODE}" == "prove-release" ]]; then
  echo "### Prove release"
  echo
  FID="${FUNDING_ID:-}"
  MID="${MILESTONE_ID:-}"
  AMT="${AMOUNT_CENTS:-}"
  if [[ -z "${FID}" ]]; then
    FID="$(psql -At -c "SELECT id FROM \"CollaborationFunding\" WHERE status = 'held' ORDER BY \"updatedAt\" DESC LIMIT 1;")"
  fi
  if [[ -z "${FID}" ]]; then
    echo "ERROR: no held funding. Run --prove-hold first or set FUNDING_ID=…"
    exit 1
  fi
  if [[ -z "${MID}" ]]; then
    MID="$(psql -At -c "
SELECT id FROM \"FundingMilestone\"
WHERE \"fundingId\" = '${FID}'
  AND status IN ('approved','release_scheduled','release_requested','payout_failed')
ORDER BY \"sortOrder\" ASC LIMIT 1;
")"
  fi
  if [[ -z "${MID}" ]]; then
    echo "ERROR: no approved milestone on funding ${FID}."
    echo "Approve a milestone in the collab UI (or set MILESTONE_ID=… after status is approved)."
    exit 1
  fi
  if [[ -z "${AMT}" ]]; then
    AMT="$(psql -At -c "SELECT (\"amountCents\" - \"refundedCents\")::text FROM \"FundingMilestone\" WHERE id = '${MID}';")"
  fi
  post_airwallex "funds_split.released" "${FID}" "${AMT}" "${MID}"
  echo
  echo "Re-run without flags to collect released ledger + ProcessedWebhook rows."
  exit 0
fi

if [[ "${MODE}" == "prove-duplicate" ]]; then
  echo "### Prove duplicate release skip"
  echo
  LAST_EVENT="$(cat /tmp/influrios-e6-last-event-id 2>/dev/null || true)"
  EVENT_ID="${EVENT_ID:-${LAST_EVENT}}"
  FID="${FUNDING_ID:-}"
  MID="${MILESTONE_ID:-}"
  AMT="${AMOUNT_CENTS:-}"
  if [[ -z "${EVENT_ID}" || -z "${FID}" || -z "${MID}" || -z "${AMT}" ]]; then
    echo "ERROR: set EVENT_ID (or re-run --prove-release first), FUNDING_ID, MILESTONE_ID, AMOUNT_CENTS."
    exit 1
  fi
  post_airwallex "funds_split.released" "${FID}" "${AMT}" "${MID}" "${EVENT_ID}"
  BODY="$(tr -d '\n' </tmp/influrios-e6-prove.json 2>/dev/null || true)"
  if echo "${BODY}" | grep -qi 'duplicate'; then
    echo "Duplicate skipped (ProcessedWebhook unique)."
  else
    echo "Note: response should include duplicate=true / applied=false. Check ProcessedWebhook count for this event id."
  fi
  exit 0
fi

echo "Operator checklist (fill docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md § E6 / §5):"
echo "  1. Admin → Gateways → Airwallex: enable + client id + API key + demo base URL + webhook secret"
echo "  2. US jurisdiction protected payments APPROVED (Admin → Marketplace)"
echo "  3. Create a collaboration funding that lands in awaiting_provider"
echo "  4. AIRWALLEX_WEBHOOK_SECRET=… FUNDING_ID=… npm run staging:e6-marketplace-evidence -- --prove-hold"
echo "  5. Approve first milestone in the collab UI"
echo "  6. FUNDING_ID=… MILESTONE_ID=… AMOUNT_CENTS=… AIRWALLEX_WEBHOOK_SECRET=… \\"
echo "       npm run staging:e6-marketplace-evidence -- --prove-release"
echo "  7. Same env + EVENT_ID=… --prove-duplicate"
echo "  8. Re-run this script; paste funding id, held/released, duplicate skip"
echo

HELD_COUNT="$(psql -At -c "SELECT count(*)::text FROM \"CollaborationFunding\" WHERE status IN ('held','released','partially_released','completed');" 2>/dev/null || echo 0)"
WH_COUNT="$(psql -At -c "SELECT count(*)::text FROM \"ProcessedWebhook\" WHERE provider LIKE 'marketplace:%' AND \"eventType\" IN ('funding.held','payout.released');" 2>/dev/null || echo 0)"

if [[ "${WH_CODE}" == "503" ]]; then
  echo "Airwallex gateway is not ready yet."
  exit 1
fi

if [[ "${HELD_COUNT}" == "0" && "${WH_COUNT}" == "0" ]]; then
  echo "No hold/release evidence yet — create a funding and run --prove-hold / --prove-release."
  exit 0
fi

echo "Marketplace evidence present. Paste funding id + held/released + duplicate into the E6 runbook."
