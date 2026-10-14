#!/usr/bin/env bash
# Phase M E4 — collect Stripe sandbox checkout evidence on the host.
# Uses Docker Postgres (no tsx / host prisma generate).
#
# Usage (from /var/www/influrios):
#   npm run staging:e4-stripe-evidence
#   bash scripts/staging-e4-stripe-evidence.sh
#   bash scripts/staging-e4-stripe-evidence.sh --prove-duplicate
#
# Many sandbox checkouts complete on the success page (confirmStripeCheckout +
# applyPlanOnce with a local event id `checkout:<attemptId>`). That id is NOT a
# Stripe Dashboard evt_…, so there is nothing to "Resend" in Stripe. Use
# --prove-duplicate to show the unique ProcessedWebhook key rejects a second
# insert (same idempotency the webhook path uses).
# Does not mark Phase M complete.
set -euo pipefail

PROVE_DUPLICATE=0
if [[ "${1:-}" == "--prove-duplicate" ]]; then
  PROVE_DUPLICATE=1
fi

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

echo "Influrios Phase M E4 Stripe evidence"
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

echo "### Webhook readiness (no signature)"
echo
WH_CODE=$(curl -sS -o /tmp/influrios-e4-wh.json -w "%{http_code}" -X POST \
  "${APP_URL}/api/billing/webhook" \
  -H "content-type: application/json" \
  -d '{}' || true)
WH_BODY=$(head -c 200 /tmp/influrios-e4-wh.json 2>/dev/null || true)
echo "POST ${APP_URL}/api/billing/webhook → HTTP ${WH_CODE}"
echo "Body: ${WH_BODY}"
echo
if [[ "${WH_CODE}" == "400" ]] && echo "${WH_BODY}" | grep -qi "Stripe-Signature\|signature"; then
  echo "Webhook secret path looks ready (missing signature → 400)."
else
  echo "WARNING: expected 400 Missing Stripe-Signature (or similar). Re-save whsec_… on Payment gateways if needed."
fi
echo

print_table() {
  local title="$1"
  local sql="$2"
  echo "### ${title}"
  echo
  echo "| Col1 | Col2 | Col3 | Col4 | Col5 | Col6 |"
  echo "|------|------|------|------|------|------|"
  mapfile -t ROWS < <(docker compose exec -T postgres psql -U "${PGUSER}" -d "${PGDB}" -v ON_ERROR_STOP=1 -At -F '|' -c "${sql}" || true)
  if [[ ${#ROWS[@]} -eq 0 ]]; then
    echo "| (none) | — | — | — | — | — |"
    echo
    return 0
  fi
  for row in "${ROWS[@]}"; do
    [[ -z "${row}" ]] && continue
    IFS='|' read -r a b c d e f <<<"${row}"
    echo "| ${a:-—} | ${b:-—} | ${c:-—} | ${d:-—} | ${e:-—} | ${f:-—} |"
  done
  echo
}

ATTEMPTS_SQL=$(cat <<'SQL'
SELECT id,
  COALESCE(NULLIF("stripeSessionId", ''), '—'),
  sku,
  status,
  COALESCE("userId", '—'),
  to_char(COALESCE("completedAt", "updatedAt") AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
FROM "CheckoutAttempt"
WHERE status = 'completed'
  AND mode = 'stripe'
ORDER BY COALESCE("completedAt", "updatedAt") DESC
LIMIT 5;
SQL
)

WEBHOOKS_SQL=$(cat <<'SQL'
SELECT "eventId",
  "eventType",
  result,
  provider,
  to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  id
FROM "ProcessedWebhook"
WHERE provider = 'stripe'
  AND "eventType" = 'checkout.session.completed'
ORDER BY "createdAt" DESC
LIMIT 8;
SQL
)

SUBS_SQL=$(cat <<'SQL'
SELECT id,
  COALESCE("userId", '—'),
  sku,
  status,
  "externalId",
  to_char("updatedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
FROM "SubscriptionState"
WHERE provider = 'stripe'
ORDER BY "updatedAt" DESC
LIMIT 5;
SQL
)

echo "### Latest completed Stripe CheckoutAttempts"
echo
echo "| Attempt id | cs_test_… | SKU | Status | User id | Completed |"
echo "|------------|-----------|-----|--------|---------|-----------|"
mapfile -t ATTEMPTS < <(docker compose exec -T postgres psql -U "${PGUSER}" -d "${PGDB}" -v ON_ERROR_STOP=1 -At -F '|' -c "${ATTEMPTS_SQL}")
have_attempt=0
if [[ ${#ATTEMPTS[@]} -eq 0 ]]; then
  echo "| (none) | — | — | — | — | — |"
else
  for row in "${ATTEMPTS[@]}"; do
    [[ -z "${row}" ]] && continue
    IFS='|' read -r id cs sku status user updated <<<"${row}"
    echo "| ${id} | ${cs} | ${sku} | ${status} | ${user} | ${updated} |"
    have_attempt=1
  done
fi
echo

echo "### Stripe checkout.session.completed ProcessedWebhook rows"
echo
echo "| Event id | Event type | Result | Provider | Created | Row id |"
echo "|----------|------------|--------|----------|---------|--------|"
mapfile -t HOOKS < <(docker compose exec -T postgres psql -U "${PGUSER}" -d "${PGDB}" -v ON_ERROR_STOP=1 -At -F '|' -c "${WEBHOOKS_SQL}")
have_hook=0
if [[ ${#HOOKS[@]} -eq 0 ]]; then
  echo "| (none) | — | — | — | — | — |"
else
  for row in "${HOOKS[@]}"; do
    [[ -z "${row}" ]] && continue
    IFS='|' read -r eventId eventType result provider created id <<<"${row}"
    echo "| ${eventId} | ${eventType} | ${result} | ${provider} | ${created} | ${id} |"
    have_hook=1
  done
fi
echo

echo "### Latest Stripe SubscriptionState rows"
echo
echo "| Id | User id | SKU | Status | External id | Updated |"
echo "|----|---------|-----|--------|-------------|---------|"
mapfile -t SUBS < <(docker compose exec -T postgres psql -U "${PGUSER}" -d "${PGDB}" -v ON_ERROR_STOP=1 -At -F '|' -c "${SUBS_SQL}")
if [[ ${#SUBS[@]} -eq 0 ]]; then
  echo "| (none) | — | — | — | — | — |"
else
  for row in "${SUBS[@]}"; do
    [[ -z "${row}" ]] && continue
    IFS='|' read -r id user sku status external updated <<<"${row}"
    echo "| ${id} | ${user} | ${sku} | ${status} | ${external} | ${updated} |"
  done
fi
echo

echo "Note: event ids like checkout:cs_… were written on the success page, not as Stripe evt_… rows."
echo "      You will not find them under Stripe Dashboard → Events → Resend."
echo
echo "Operator checklist (fill docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md § E4):"
echo "  1. Member /billing → sandbox Checkout with test card 4242 (skip if already done)"
echo "  2. Confirm success page + plan tier; paste CheckoutAttempt id + cs_test_…"
echo "  3. Prove duplicate skip: npm run staging:e4-stripe-evidence -- --prove-duplicate"
echo "  4. Paste that output into the runbook"
echo

if [[ "${have_attempt}" -eq 0 ]]; then
  echo "No completed Stripe CheckoutAttempt yet. Run a 4242 checkout first."
  exit 1
fi
if [[ "${have_hook}" -eq 0 ]]; then
  echo "CheckoutAttempt exists but no ProcessedWebhook for checkout.session.completed — confirm delivery."
  exit 1
fi

if [[ "${PROVE_DUPLICATE}" -eq 1 ]]; then
  echo "### Duplicate-skip proof (local event id)"
  echo
  LATEST=$(docker compose exec -T postgres psql -U "${PGUSER}" -d "${PGDB}" -v ON_ERROR_STOP=1 -At -F '|' -c "
SELECT ca.id, ca.\"stripeSessionId\", ca.sku, ca.\"userId\", pw.\"eventId\", u.\"planTier\"
FROM \"CheckoutAttempt\" ca
JOIN \"ProcessedWebhook\" pw
  ON pw.provider = 'stripe'
 AND pw.\"eventId\" = 'checkout:' || ca.id
LEFT JOIN \"User\" u ON u.id = ca.\"userId\"
WHERE ca.status = 'completed' AND ca.mode = 'stripe'
ORDER BY COALESCE(ca.\"completedAt\", ca.\"updatedAt\") DESC
LIMIT 1;
")
  if [[ -z "${LATEST}" ]]; then
    echo "ERROR: no completed attempt with matching checkout:<id> ProcessedWebhook row."
    exit 1
  fi
  IFS='|' read -r attempt_id cs_id sku user_id event_id plan_tier <<<"${LATEST}"
  echo "Using attempt=${attempt_id} eventId=${event_id} sku=${sku} planTier=${plan_tier:-—}"
  echo "Attempting a second insert of the same ProcessedWebhook key (must fail unique)…"
  set +e
  DUP_OUT=$(docker compose exec -T postgres psql -U "${PGUSER}" -d "${PGDB}" -v ON_ERROR_STOP=1 -c "
INSERT INTO \"ProcessedWebhook\" (id, provider, \"eventId\", \"eventType\", result, \"createdAt\")
VALUES (
  'e4dup_' || substr(md5(random()::text), 1, 16),
  'stripe',
  '${event_id}',
  'checkout.session.completed',
  'active',
  NOW()
);
" 2>&1)
  DUP_CODE=$?
  set -e
  echo "${DUP_OUT}" | tail -n 5
  if [[ "${DUP_CODE}" -eq 0 ]]; then
    echo "ERROR: second insert succeeded — duplicate protection failed."
    exit 1
  fi
  if ! echo "${DUP_OUT}" | grep -qiE 'unique|duplicate|ProcessedWebhook_provider_eventId'; then
    echo "ERROR: insert failed for an unexpected reason (wanted unique violation)."
    exit 1
  fi
  AFTER=$(docker compose exec -T postgres psql -U "${PGUSER}" -d "${PGDB}" -v ON_ERROR_STOP=1 -At -c "
SELECT COALESCE(\"planTier\", '') FROM \"User\" WHERE id = '${user_id}';
")
  HOOK_COUNT=$(docker compose exec -T postgres psql -U "${PGUSER}" -d "${PGDB}" -v ON_ERROR_STOP=1 -At -c "
SELECT COUNT(*)::text FROM \"ProcessedWebhook\" WHERE provider = 'stripe' AND \"eventId\" = '${event_id}';
")
  echo
  echo "| Check | Result |"
  echo "|-------|--------|"
  echo "| Unique key blocked second insert | ☑ |"
  echo "| ProcessedWebhook rows for event id | ${HOOK_COUNT} (must be 1) |"
  echo "| User.planTier unchanged | ${AFTER} (was ${plan_tier}) |"
  echo
  if [[ "${HOOK_COUNT}" != "1" ]]; then
    echo "ERROR: expected exactly one ProcessedWebhook row for ${event_id}."
    exit 1
  fi
  if [[ -n "${plan_tier}" && "${AFTER}" != "${plan_tier}" ]]; then
    echo "ERROR: plan tier changed during duplicate proof."
    exit 1
  fi
  echo "Duplicate-skip proof OK. Paste this section into the E4 runbook."
  exit 0
fi

echo "At least one completed attempt + webhook row present."
echo "For full E4, run: npm run staging:e4-stripe-evidence -- --prove-duplicate"
