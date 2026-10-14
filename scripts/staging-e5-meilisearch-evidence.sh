#!/usr/bin/env bash
# Phase M E5 — collect Meilisearch creator-index evidence on the host.
# Uses Docker Postgres + Meilisearch HTTP (no tsx / host prisma generate).
#
# Usage (from /var/www/influrios):
#   npm run staging:e5-meilisearch-evidence
#   bash scripts/staging-e5-meilisearch-evidence.sh
#
# Operator path:
#   1. Confirm meilisearch container is up (docker compose ps meilisearch)
#   2. Admin → Meilisearch: host/key enabled (or rely on MEILI_HOST in .env)
#   3. Click Reindex; wait for succeeded job
#   4. Open /discover?q=… and confirm creators appear
#   5. Re-run this script; paste postgres count, index count, reindex job id
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
MEILI_KEY="${MEILI_API_KEY:-influrios-meili-dev-key}"

# Host-side access: Compose publishes Meili on 127.0.0.1:7700.
# Inside Docker the app uses http://meilisearch:7700 — rewrite for this script.
RAW_MEILI="${MEILI_HOST:-http://127.0.0.1:7700}"
RAW_MEILI="${RAW_MEILI%/}"
case "${RAW_MEILI}" in
  *meilisearch*)
    MEILI_URL="http://127.0.0.1:7700"
    ;;
  *)
    MEILI_URL="${RAW_MEILI}"
    ;;
esac

echo "Influrios Phase M E5 Meilisearch evidence"
echo
echo "When: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo
echo "Meili URL (host): ${MEILI_URL}"
echo "App URL: ${APP_URL}"
echo "Env MEILI_HOST: ${RAW_MEILI}"
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

echo "### Meilisearch container"
echo
if docker compose ps meilisearch --status running >/dev/null 2>&1; then
  echo "meilisearch: running"
else
  echo "meilisearch: NOT running — start with: docker compose up -d meilisearch"
fi
echo

echo "### Meilisearch health"
echo
HEALTH_CODE="$(curl -sS -m 10 -o /tmp/influrios-e5-meili-health.json -w '%{http_code}' "${MEILI_URL}/health" 2>/dev/null || true)"
HEALTH_BODY="$(tr -d '\n' </tmp/influrios-e5-meili-health.json 2>/dev/null || true)"
echo "GET ${MEILI_URL}/health → HTTP ${HEALTH_CODE:-?}"
echo "Body: ${HEALTH_BODY:-—}"
if [[ "${HEALTH_CODE}" != "200" ]]; then
  echo "ERROR: Meilisearch health failed. Check MEILI_API_KEY / container logs."
  echo
fi
echo

echo "### Creator index stats"
echo
STATS_CODE="$(
  curl -sS -m 15 -o /tmp/influrios-e5-meili-stats.json -w '%{http_code}' \
    -H "Authorization: Bearer ${MEILI_KEY}" \
    "${MEILI_URL}/indexes/creators/stats" 2>/dev/null || true
)"
STATS_BODY="$(cat /tmp/influrios-e5-meili-stats.json 2>/dev/null || true)"
echo "GET /indexes/creators/stats → HTTP ${STATS_CODE:-?}"
INDEX_DOCS="$(
  node -e '
    try {
      const j = JSON.parse(require("fs").readFileSync("/tmp/influrios-e5-meili-stats.json","utf8"));
      process.stdout.write(String(j.numberOfDocuments ?? ""));
    } catch { process.stdout.write(""); }
  ' 2>/dev/null || true
)"
if [[ -z "${INDEX_DOCS}" ]]; then
  echo "Index documents: — (index missing or unauthorized — run Admin → Meilisearch → Reindex)"
  echo "Body: $(echo "${STATS_BODY}" | tr -d '\n' | cut -c1-200)"
else
  echo "Index documents (creators): ${INDEX_DOCS}"
fi
echo

echo "### Postgres public creators"
echo
PG_COUNT="$(psql -At -c "
SELECT count(*)::text
FROM \"Creator\"
WHERE \"profileState\" IS DISTINCT FROM 'RESTRICTED';
")"
echo "Postgres creators (not RESTRICTED): ${PG_COUNT}"
echo

echo "### Latest reindex_creators jobs"
echo
echo "| Job id | Status | Indexed / notes | Updated |"
echo "|--------|--------|-----------------|---------|"
mapfile -t JOBS < <(psql -At -F '|' -c "
SELECT
  id,
  status,
  CASE
    WHEN payload ? 'indexed' THEN 'indexed=' || (payload->>'indexed') || ' postgres=' || coalesce(payload->>'postgresCount','?')
    WHEN \"lastError\" IS NOT NULL AND length(trim(\"lastError\")) > 0 THEN left(replace(replace(\"lastError\", E'\\n', ' '), '|', '/'), 80)
    ELSE '—'
  END,
  to_char(\"updatedAt\" AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
FROM \"Job\"
WHERE kind = 'reindex_creators'
ORDER BY \"updatedAt\" DESC
LIMIT 5;
")
if [[ ${#JOBS[@]} -eq 0 ]]; then
  echo "| (none) | — | — | — |"
else
  for row in "${JOBS[@]}"; do
    IFS='|' read -r id status notes updated <<<"${row}"
    echo "| ${id} | ${status} | ${notes} | ${updated} |"
  done
fi
echo

echo "### Discover smoke (indexed search path)"
echo
DISCOVER_CODE="$(
  curl -sS -m 20 -o /tmp/influrios-e5-discover.html -w '%{http_code}' \
    "${APP_URL}/discover?q=creator" 2>/dev/null || true
)"
DISCOVER_BYTES="$(wc -c </tmp/influrios-e5-discover.html 2>/dev/null | tr -d ' ' || echo 0)"
echo "GET ${APP_URL}/discover?q=creator → HTTP ${DISCOVER_CODE:-?} (${DISCOVER_BYTES} bytes)"
if [[ "${DISCOVER_CODE}" == "200" ]]; then
  echo "Discover responded OK. Confirm creator cards in the browser for full E5."
else
  echo "Note: Discover did not return 200 — check web container / nginx."
fi
echo

echo "### Count check"
echo
echo "| Check | Result |"
echo "|-------|--------|"
echo "| Meili health 200 | $([[ "${HEALTH_CODE}" == "200" ]] && echo ☑ || echo ☐) |"
echo "| Postgres creators | ${PG_COUNT} |"
echo "| Index documents | ${INDEX_DOCS:-—} |"
if [[ -n "${INDEX_DOCS}" && "${PG_COUNT}" == "${INDEX_DOCS}" ]]; then
  echo "| Counts match | ☑ |"
elif [[ -n "${INDEX_DOCS}" ]]; then
  echo "| Counts match | ☐ (reindex if drift is unexpected) |"
else
  echo "| Counts match | ☐ (no index yet) |"
fi
echo

echo "Operator checklist (fill docs/deploy/STAGING_LAUNCH_INTEGRATIONS.md § E5):"
echo "  1. docker compose ps meilisearch  → running"
echo "  2. Admin → Meilisearch: host/key Ready (or MEILI_HOST in .env)"
echo "  3. Click Reindex → succeeded job id"
echo "  4. Browser /discover?q=… shows creators"
echo "  5. Re-run this script; paste postgres count, index count, reindex job id"
echo

if [[ "${HEALTH_CODE}" != "200" ]]; then
  echo "Meilisearch health is not green yet."
  exit 1
fi

if [[ -z "${INDEX_DOCS}" || "${INDEX_DOCS}" == "0" ]]; then
  echo "Creator index is empty or missing. Run Admin → Meilisearch → Reindex, then re-run."
  exit 0
fi

if [[ "${#JOBS[@]}" -eq 0 ]]; then
  echo "No reindex_creators job yet — click Reindex in Admin for a job id to paste."
  exit 0
fi

echo "Meilisearch evidence present. Paste health + counts + job id into the E5 runbook."
