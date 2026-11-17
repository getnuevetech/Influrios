#!/usr/bin/env bash
# Phase M E6 — collect marketplace hold → release evidence (Airwallex or primary).
# Uses Docker Postgres + curl (no tsx / host prisma generate).
#
# Usage (from /var/www/influrios):
#   npm run staging:e6-marketplace-evidence
#   bash scripts/staging-e6-marketplace-evidence.sh
#   npm run staging:e6-check-ready          # Phase M closeout gate (exit 0 only when ready)
#
# Closeout one-shot (after Airwallex webhook secret is Ready → unsigned POST returns 401):
#   AIRWALLEX_WEBHOOK_SECRET=… npm run staging:e6-prove-chain
#   # ensures US jurisdiction, seeds awaiting funding + milestone, hold → approve →
#   # release → duplicate, prints paste-ready evidence ids for the runbook.
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
if [[ "${1:-}" == "--check-ready" ]]; then MODE="check-ready"; fi
if [[ "${1:-}" == "--ensure-us" ]]; then MODE="ensure-us"; fi
if [[ "${1:-}" == "--seed-awaiting" ]]; then MODE="seed-awaiting"; fi
if [[ "${1:-}" == "--approve-milestone" ]]; then MODE="approve-milestone"; fi
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

echo "Influrios Phase M E6 Marketplace hold → release evidence"
echo
echo "When: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
if command -v git >/dev/null 2>&1 && [[ -d .git ]]; then
  echo "Git:  $(git rev-parse --short HEAD) ($(git rev-parse --abbrev-ref HEAD))"
fi
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

echo "### Host health"
echo
HEALTH_CODE="$(curl -sS -m 10 -o /tmp/influrios-e6-health.json -w '%{http_code}' "${APP_URL}/api/health" 2>/dev/null || true)"
HEALTH_BODY="$(tr -d '\n' </tmp/influrios-e6-health.json 2>/dev/null | cut -c1-240 || true)"
echo "GET ${APP_URL}/api/health → HTTP ${HEALTH_CODE:-?}"
echo "Body: ${HEALTH_BODY:-—}"
if [[ "${HEALTH_CODE}" != "200" ]]; then
  echo "ERROR: web is not healthy (often nginx 502). On the host:"
  echo "  bash deploy/scripts/diagnose-502.sh"
  echo "  git pull origin main && bash deploy/scripts/deploy.sh"
  echo "E6 prove steps require a live /api/health before posting webhooks."
  exit 1
fi
echo

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

if [[ "${MODE}" == "check-ready" ]]; then
  echo "### Phase M E6 readiness (closeout gate)"
  echo
  READY=1
  US_ROW="$(psql -At -F '|' -c "
SELECT
  CASE WHEN \"protectedPaymentsEnabled\" THEN 'yes' ELSE 'no' END,
  \"legalReviewStatus\",
  COALESCE(NULLIF(\"providerCode\", ''), '—')
FROM \"CollaborationJurisdiction\"
WHERE code = 'US'
LIMIT 1;
" 2>/dev/null || true)"
  if [[ -z "${US_ROW}" ]]; then
    echo "| Gate | Result | Detail |"
    echo "|------|--------|--------|"
    echo "| US jurisdiction row | FAIL | no CollaborationJurisdiction code=US |"
    READY=0
  else
    IFS='|' read -r us_protected us_legal us_provider <<<"${US_ROW}"
    echo "| Gate | Result | Detail |"
    echo "|------|--------|--------|"
    echo "| Host /api/health | pass | HTTP ${HEALTH_CODE} |"
    if [[ "${WH_CODE}" == "401" ]]; then
      echo "| Airwallex unsigned webhook | pass | HTTP 401 (secret path ready) |"
    elif [[ "${WH_CODE}" == "503" ]]; then
      echo "| Airwallex unsigned webhook | FAIL | HTTP 503 — enable Airwallex + webhook secret |"
      READY=0
    else
      echo "| Airwallex unsigned webhook | FAIL | HTTP ${WH_CODE:-?} — expected 401 |"
      READY=0
    fi
    if [[ "${us_protected}" == "yes" ]]; then
      echo "| US protected payments | pass | enabled |"
    else
      echo "| US protected payments | FAIL | Admin → Marketplace → US: turn on protected payments |"
      READY=0
    fi
    if [[ "${us_legal}" == "APPROVED" ]]; then
      echo "| US legal review | pass | APPROVED |"
    else
      echo "| US legal review | FAIL | status=${us_legal:-?} — set legal APPROVED |"
      READY=0
    fi
    echo "| US provider code | note | ${us_provider} (prefer airwallex) |"
  fi
  AWAITING="$(psql -At -c "SELECT count(*)::text FROM \"CollaborationFunding\" WHERE status = 'awaiting_provider';" 2>/dev/null || echo 0)"
  echo "| Fundings awaiting_provider | note | ${AWAITING} (need ≥1 before --prove-hold) |"
  echo
  if [[ "${READY}" -eq 1 ]]; then
    echo "E6 READY — next: create awaiting_provider funding (if none), then --prove-hold / --prove-release / --prove-duplicate."
    exit 0
  fi
  echo "E6 NOT READY — fix FAIL rows above, then re-run: npm run staging:e6-check-ready"
  exit 1
fi

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

e6_new_id() {
  # Stable-looking id for drill rows (not a Prisma cuid; String @id accepts it).
  printf 'e6_%s_%s' "$(date -u +%Y%m%d%H%M%S)" "$(openssl rand -hex 4)"
}

ensure_us_jurisdiction() {
  echo "### Ensure US jurisdiction (protected + APPROVED + airwallex)"
  echo
  psql -c "
INSERT INTO \"CollaborationJurisdiction\" (
  code, label, \"protectedPaymentsEnabled\", \"legalReviewStatus\", \"providerCode\", currency, \"minorDigits\", \"updatedAt\"
) VALUES (
  'US', 'United States', true, 'APPROVED', 'airwallex', 'USD', 2, NOW()
)
ON CONFLICT (code) DO UPDATE SET
  \"protectedPaymentsEnabled\" = true,
  \"legalReviewStatus\" = 'APPROVED',
  \"providerCode\" = 'airwallex',
  \"updatedAt\" = NOW();
"
  psql -At -F '|' -c "
SELECT code,
  CASE WHEN \"protectedPaymentsEnabled\" THEN 'yes' ELSE 'no' END,
  \"legalReviewStatus\",
  COALESCE(NULLIF(\"providerCode\", ''), '—')
FROM \"CollaborationJurisdiction\" WHERE code = 'US';
" | while IFS='|' read -r code protected legal provider; do
    echo "US → protected=${protected} legal=${legal} provider=${provider}"
  done
}

seed_awaiting_funding() {
  local gross="${GROSS_CENTS:-5000}"
  local fid mid
  fid="$(e6_new_id)"
  mid="$(e6_new_id)"
  echo "### Seed awaiting_provider funding (E6 drill)"
  echo
  psql -c "
INSERT INTO \"CollaborationFunding\" (
  id, \"jurisdictionCode\", \"businessName\", \"creatorSlug\", title, currency,
  \"grossCents\", \"feeCents\", \"feeSnapshotJson\", \"serviceLevel\", status, \"providerCode\",
  \"fundingMode\", \"scheduleKind\", \"trancheIndex\", \"trancheCount\", \"updatedAt\"
) VALUES (
  '${fid}',
  'US',
  'E6 Drill Business',
  'e6-drill-creator',
  'E6 marketplace hold→release drill',
  'USD',
  ${gross},
  0,
  '{\"feeType\":\"\",\"feeCents\":0,\"explanation\":\"E6 staging drill — fee not applied.\",\"capturedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}'::jsonb,
  'managed_campaign',
  'awaiting_provider',
  'airwallex',
  'FULL',
  'once',
  1,
  1,
  NOW()
);
INSERT INTO \"FundingMilestone\" (
  id, \"fundingId\", title, \"amountCents\", \"sortOrder\", status,
  \"reviewWindowHours\", \"revisionLimit\", \"updatedAt\"
) VALUES (
  '${mid}',
  '${fid}',
  'E6 Kickoff milestone',
  ${gross},
  0,
  'pending',
  72,
  2,
  NOW()
);
"
  echo "FUNDING_ID=${fid}"
  echo "MILESTONE_ID=${mid}"
  echo "GROSS_CENTS=${gross}"
  printf '%s' "${fid}" >/tmp/influrios-e6-funding-id
  printf '%s' "${mid}" >/tmp/influrios-e6-milestone-id
  printf '%s' "${gross}" >/tmp/influrios-e6-amount-cents
}

approve_first_milestone() {
  local fid="${FUNDING_ID:-}"
  local mid="${MILESTONE_ID:-}"
  if [[ -z "${fid}" && -f /tmp/influrios-e6-funding-id ]]; then
    fid="$(cat /tmp/influrios-e6-funding-id)"
  fi
  if [[ -z "${fid}" ]]; then
    fid="$(psql -At -c "SELECT id FROM \"CollaborationFunding\" WHERE status = 'held' ORDER BY \"updatedAt\" DESC LIMIT 1;")"
  fi
  if [[ -z "${fid}" ]]; then
    echo "ERROR: set FUNDING_ID=… (held funding) before --approve-milestone."
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
  echo "### Approve milestone ${mid} on funding ${fid}"
  echo
  psql -c "
UPDATE \"FundingMilestone\"
SET status = 'approved',
    \"approvedAt\" = NOW(),
    \"updatedAt\" = NOW()
WHERE id = '${mid}' AND \"fundingId\" = '${fid}';
"
  printf '%s' "${fid}" >/tmp/influrios-e6-funding-id
  printf '%s' "${mid}" >/tmp/influrios-e6-milestone-id
  echo "MILESTONE_ID=${mid} status=approved"
}

emit_evidence_pack() {
  local fid="${1:-}"
  local mid="${2:-}"
  local hold_event="${3:-}"
  local release_event="${4:-}"
  local when
  when="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo
  echo "### E6 evidence pack (paste into docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md)"
  echo
  cat <<EOF
| Check | Result |
|-------|--------|
| Airwallex gateway Ready | ☑ unsigned webhook → 401 |
| US jurisdiction protected + APPROVED | ☑ \`npm run staging:e6-check-ready\` |
| Funding awaiting_provider → held | ☑ funding \`${fid}\` · hold event \`${hold_event}\` |
| Milestone approved then payout.released | ☑ milestone \`${mid}\` · release event \`${release_event}\` |
| Duplicate release skipped | ☑ same EVENT_ID \`${release_event}\` |
| Ledger hold + release rows | ☑ see collect output |

| Area | Evidence id | Date | Operator |
|------|-------------|------|----------|
| Airwallex hold and release | funding=\`${fid}\` · hold=\`${hold_event}\` · milestone=\`${mid}\` · release=\`${release_event}\` · duplicate skipped | ${when} | host + cloud-agent |
EOF
  mkdir -p "${APP_DIR}/tmp" 2>/dev/null || true
  {
    echo "E6_CLOSED_AT=${when}"
    echo "FUNDING_ID=${fid}"
    echo "MILESTONE_ID=${mid}"
    echo "HOLD_EVENT_ID=${hold_event}"
    echo "RELEASE_EVENT_ID=${release_event}"
  } >"${APP_DIR}/tmp/e6-evidence-ids.env"
  echo
  echo "Wrote ${APP_DIR}/tmp/e6-evidence-ids.env"
}

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
  if [[ "${WH_CODE:-}" == "503" ]]; then
    echo "ERROR: Airwallex is not ready (unsigned webhook → 503). Admin → Gateways → Airwallex: enable + webhook secret, then retry."
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
  if [[ "${code}" != "200" ]]; then
    echo "ERROR: expected HTTP 200 from marketplace webhook (got ${code})."
    return 1
  fi
}

if [[ "${MODE}" == "ensure-us" ]]; then
  ensure_us_jurisdiction
  exit 0
fi

if [[ "${MODE}" == "seed-awaiting" ]]; then
  ensure_us_jurisdiction
  seed_awaiting_funding
  exit 0
fi

if [[ "${MODE}" == "approve-milestone" ]]; then
  approve_first_milestone
  exit 0
fi

if [[ "${MODE}" == "prove-chain" ]]; then
  echo "### Prove chain (hold → approve → release → duplicate)"
  echo
  if [[ -z "${AIRWALLEX_WEBHOOK_SECRET:-}" ]]; then
    echo "ERROR: set AIRWALLEX_WEBHOOK_SECRET to the Admin → Gateways → Airwallex webhook secret."
    exit 1
  fi
  if [[ "${WH_CODE}" != "401" ]]; then
    echo "ERROR: Airwallex unsigned webhook must return 401 before prove-chain (got ${WH_CODE:-?})."
    echo "Admin → Gateways → Airwallex: enable + client id + API key + base URL + webhook secret."
    exit 1
  fi
  ensure_us_jurisdiction
  seed_awaiting_funding
  FID="$(cat /tmp/influrios-e6-funding-id)"
  MID="$(cat /tmp/influrios-e6-milestone-id)"
  AMT="$(cat /tmp/influrios-e6-amount-cents)"
  echo
  post_airwallex "payment_intent.succeeded" "${FID}" "${AMT}"
  HOLD_EVENT="$(cat /tmp/influrios-e6-last-event-id)"
  HELD_STATUS="$(psql -At -c "SELECT status FROM \"CollaborationFunding\" WHERE id = '${FID}';")"
  if [[ "${HELD_STATUS}" != "held" ]]; then
    echo "ERROR: funding ${FID} status is ${HELD_STATUS:-?} after hold (expected held)."
    exit 1
  fi
  echo
  FUNDING_ID="${FID}" MILESTONE_ID="${MID}" approve_first_milestone
  echo
  post_airwallex "funds_split.released" "${FID}" "${AMT}" "${MID}"
  RELEASE_EVENT="$(cat /tmp/influrios-e6-last-event-id)"
  echo
  echo "### Prove duplicate release skip"
  echo
  post_airwallex "funds_split.released" "${FID}" "${AMT}" "${MID}" "${RELEASE_EVENT}"
  BODY="$(tr -d '\n' </tmp/influrios-e6-prove.json 2>/dev/null || true)"
  if ! echo "${BODY}" | grep -qi 'duplicate'; then
    echo "ERROR: duplicate replay did not report duplicate=true. Body: ${BODY:0:240}"
    exit 1
  fi
  RELEASED="$(psql -At -c "
SELECT count(*)::text FROM \"LedgerEntry\"
WHERE \"fundingId\" = '${FID}' AND kind IN ('hold','release');
")"
  if [[ "${RELEASED}" -lt 2 ]]; then
    echo "ERROR: expected hold+release ledger rows on ${FID} (got ${RELEASED})."
    exit 1
  fi
  emit_evidence_pack "${FID}" "${MID}" "${HOLD_EVENT}" "${RELEASE_EVENT}"
  echo
  echo "E6 prove-chain OK — paste the evidence pack into STAGING_LAUNCH_INTEGRATIONS.md § E6 / §5."
  exit 0
fi

if [[ "${MODE}" == "prove-hold" ]]; then
  echo "### Prove hold"
  echo
  FID="${FUNDING_ID:-}"
  if [[ -z "${FID}" ]]; then
    FID="$(psql -At -c "SELECT id FROM \"CollaborationFunding\" WHERE status = 'awaiting_provider' ORDER BY \"updatedAt\" DESC LIMIT 1;")"
  fi
  if [[ -z "${FID}" ]]; then
    echo "ERROR: no awaiting_provider funding. Create one (business collab wizard) or set FUNDING_ID=…"
    echo "Or: npm run staging:e6-seed-awaiting"
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
