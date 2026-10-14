#!/usr/bin/env bash
# Phase M E3 — collect one social OAuth evidence on the host.
# Uses Docker Postgres (no tsx / host prisma generate).
#
# Usage (from /var/www/influrios):
#   npm run staging:e3-social-evidence
#   bash scripts/staging-e3-social-evidence.sh
#
# Operator path:
#   1. Admin → Social: enable ONE network (YouTube or Instagram preferred)
#   2. Register {APP}/api/social/callback on the provider app
#   3. Creator dashboard → connect that network → consent → OAuth
#   4. Re-run this script; paste connection + SocialAccount ids into the runbook
#
# Metric gate: followers AND likes must both be present before PROVIDER_SYNCED write.
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

echo "Influrios Phase M E3 Social OAuth evidence"
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

psql() {
  docker compose exec -T postgres psql -U "${PGUSER}" -d "${PGDB}" -v ON_ERROR_STOP=1 "$@"
}

echo "### Callback readiness"
echo
echo "GET ${APP_URL}/api/social/callback (no code/state → redirect to dashboard with error)"
# Do not follow redirects; Docker HOSTNAME=0.0.0.0 must not appear in Location.
HEADERS="$(curl -sS -m 15 -D - -o /dev/null "${APP_URL}/api/social/callback" 2>/dev/null || true)"
CALLBACK_CODE="$(printf '%s\n' "${HEADERS}" | awk 'NR==1 {print $2; exit}')"
LOCATION="$(printf '%s\n' "${HEADERS}" | tr -d '\r' | awk -F': ' 'tolower($1)=="location"{print $2; exit}')"
echo "HTTP ${CALLBACK_CODE:-?} Location: ${LOCATION:-—}"
if [[ "${LOCATION}" == *"0.0.0.0"* ]]; then
  echo "ERROR: callback redirects to 0.0.0.0 — set NEXT_PUBLIC_APP_URL to the public https origin and redeploy."
elif [[ "${LOCATION}" == *"/dashboard"* ]]; then
  echo "Callback route is reachable (redirects to dashboard without inventing metrics)."
else
  echo "Note: unexpected callback response — confirm the app is up and NEXT_PUBLIC_APP_URL matches."
fi
echo

echo "### Social network providers (Admin → Social)"
echo
echo "| Code | Name | Enabled | Client id set | Secret status |"
echo "|------|------|---------|---------------|---------------|"
mapfile -t NETS < <(psql -At -F '|' -c "
SELECT
  code,
  name,
  CASE WHEN enabled THEN 'yes' ELSE 'no' END,
  CASE WHEN \"publicKey\" IS NOT NULL AND length(trim(\"publicKey\")) > 0 THEN 'yes' ELSE 'no' END,
  CASE
    WHEN \"secretCipher\" IS NULL OR length(trim(\"secretCipher\")) = 0 THEN 'missing'
    ELSE 'saved'
  END
FROM \"IntegrationProvider\"
WHERE kind = 'social'
ORDER BY code;
")
if [[ ${#NETS[@]} -eq 0 ]]; then
  echo "| (none) | — | — | — | — |"
else
  for row in "${NETS[@]}"; do
    IFS='|' read -r code name enabled clientid secret <<<"${row}"
    echo "| ${code} | ${name} | ${enabled} | ${clientid} | ${secret} |"
  done
fi
echo

READY_COUNT="$(psql -At -c "
SELECT count(*)::text
FROM \"IntegrationProvider\"
WHERE kind = 'social'
  AND enabled = true
  AND \"publicKey\" IS NOT NULL AND length(trim(\"publicKey\")) > 0
  AND \"secretCipher\" IS NOT NULL AND length(trim(\"secretCipher\")) > 0;
")"
echo "Ready networks (enabled + client id + secret): ${READY_COUNT}"
echo

echo "### Latest SocialConnection rows"
echo
echo "| Id | Platform | Status | Consented | Last synced | Last error | Updated |"
echo "|----|----------|--------|-----------|-------------|------------|---------|"
mapfile -t CONNS < <(psql -At -F '|' -c "
SELECT
  id,
  platform::text,
  status,
  CASE WHEN \"consentedAt\" IS NULL THEN '—' ELSE to_char(\"consentedAt\" AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') END,
  CASE WHEN \"lastSyncedAt\" IS NULL THEN '—' ELSE to_char(\"lastSyncedAt\" AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') END,
  COALESCE(left(replace(replace(coalesce(\"lastError\", '—'), E'\\n', ' '), '|', '/'), 60), '—'),
  to_char(\"updatedAt\" AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
FROM \"SocialConnection\"
ORDER BY \"updatedAt\" DESC
LIMIT 8;
")
if [[ ${#CONNS[@]} -eq 0 ]]; then
  echo "| (none) | — | — | — | — | — | — |"
else
  for row in "${CONNS[@]}"; do
    IFS='|' read -r id platform status consented synced err updated <<<"${row}"
    echo "| ${id} | ${platform} | ${status} | ${consented} | ${synced} | ${err} | ${updated} |"
  done
fi
echo

echo "### PROVIDER_SYNCED SocialAccount rows (both metrics required)"
echo
echo "| Id | Platform | Handle | Followers | Likes | Source | Refreshed |"
echo "|----|----------|--------|-----------|-------|--------|-----------|"
mapfile -t ACCS < <(psql -At -F '|' -c "
SELECT
  id,
  platform::text,
  handle,
  COALESCE(followers::text, 'null'),
  COALESCE(likes::text, 'null'),
  source::text,
  CASE WHEN \"refreshedAt\" IS NULL THEN '—' ELSE to_char(\"refreshedAt\" AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') END
FROM \"SocialAccount\"
WHERE source = 'PROVIDER_SYNCED'
ORDER BY \"refreshedAt\" DESC NULLS LAST
LIMIT 8;
")
if [[ ${#ACCS[@]} -eq 0 ]]; then
  echo "| (none yet) | — | — | — | — | — | — |"
else
  for row in "${ACCS[@]}"; do
    IFS='|' read -r id platform handle followers likes source refreshed <<<"${row}"
    echo "| ${id} | ${platform} | ${handle} | ${followers} | ${likes} | ${source} | ${refreshed} |"
  done
fi
echo

LIVE_BOTH="$(psql -At -c "
SELECT count(*)::text
FROM \"SocialAccount\"
WHERE source = 'PROVIDER_SYNCED'
  AND followers IS NOT NULL
  AND likes IS NOT NULL;
")"
PARTIAL="$(psql -At -c "
SELECT count(*)::text
FROM \"SocialAccount\"
WHERE source = 'PROVIDER_SYNCED'
  AND (followers IS NULL OR likes IS NULL);
")"

echo "### Metric gate"
echo
echo "| Check | Result |"
echo "|-------|--------|"
echo "| PROVIDER_SYNCED with both followers + likes | ${LIVE_BOTH} |"
echo "| PROVIDER_SYNCED missing a metric (must be 0) | ${PARTIAL} |"
echo

echo "Operator checklist (fill docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md § E3 / §4):"
echo "  1. Admin → Social: enable one network; register ${APP_URL}/api/social/callback"
echo "  2. Creator /dashboard → Connect → consent → complete OAuth"
echo "  3. Confirm redirect lands on /dashboard without error"
echo "  4. Re-run this script; paste SocialConnection id + SocialAccount id (both metrics)"
echo "  5. If the network returned only one metric, expect status=error / no PROVIDER_SYNCED write"
echo

if [[ "${READY_COUNT}" == "0" ]]; then
  echo "No ready social network yet — finish Admin → Social before creator consent."
  exit 0
fi

if [[ "${LIVE_BOTH}" == "0" ]]; then
  echo "No live synced account with both metrics yet — complete creator OAuth for full E3."
  exit 0
fi

if [[ "${PARTIAL}" != "0" ]]; then
  echo "WARNING: found PROVIDER_SYNCED rows missing a metric — that violates the metric gate."
  exit 1
fi

echo "At least one live sync with both metrics is present. Paste ids into the E3 runbook."
