#!/usr/bin/env bash
# Restart Docker web when local /api/health fails while the container is still "Up".
# Nginx then returns 502 even though `docker compose ps` looks fine — Compose
# restart:unless-stopped only recovers process exits, not hung unhealthy webs.
#
# Host crontab (every 2 minutes):
#   */2 * * * * APP_DIR=/var/www/influrios /var/www/influrios/deploy/scripts/watch-health.sh >>/var/log/influrios-watch-health.log 2>&1
#
# Skips while a deploy lock is held (deploy.sh / manual). Dry-run: WATCH_HEALTH_DRY_RUN=1
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/influrios}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
STATE_FILE="${WATCH_HEALTH_STATE:-/tmp/influrios-watch-health.failures}"
LOCK_FILE="${WATCH_HEALTH_DEPLOY_LOCK:-/tmp/influrios-deploy.lock}"
MAX_FAILURES="${WATCH_HEALTH_MAX_FAILURES:-2}"
COOLDOWN_SEC="${WATCH_HEALTH_COOLDOWN_SEC:-120}"
LAST_RESTART_FILE="${WATCH_HEALTH_LAST_RESTART:-/tmp/influrios-watch-health.last-restart}"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

cd "${APP_DIR}" 2>/dev/null || {
  log "ERROR: APP_DIR ${APP_DIR} missing"
  exit 1
}

if [[ -f "${LOCK_FILE}" ]]; then
  log "skip: deploy lock ${LOCK_FILE}"
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  log "ERROR: docker not on PATH"
  exit 1
fi

if curl -fsS -m 8 "${HEALTH_URL}" >/dev/null 2>&1; then
  rm -f "${STATE_FILE}"
  exit 0
fi

failures=0
if [[ -f "${STATE_FILE}" ]]; then
  failures="$(tr -dc '0-9' <"${STATE_FILE}" || true)"
  failures="${failures:-0}"
fi
failures=$((failures + 1))
printf '%s\n' "${failures}" >"${STATE_FILE}"
log "health fail ${failures}/${MAX_FAILURES} (${HEALTH_URL})"

if [[ "${failures}" -lt "${MAX_FAILURES}" ]]; then
  exit 0
fi

now="$(date +%s)"
if [[ -f "${LAST_RESTART_FILE}" ]]; then
  last="$(tr -dc '0-9' <"${LAST_RESTART_FILE}" || true)"
  last="${last:-0}"
  if [[ $((now - last)) -lt "${COOLDOWN_SEC}" ]]; then
    log "skip: cooldown $((COOLDOWN_SEC - (now - last)))s left after last restart"
    exit 0
  fi
fi

# Only restart when the web service exists; postgres-down needs a full deploy.
web_state="$(docker compose ps web --format '{{.State}}' 2>/dev/null | head -1 || true)"
if [[ -z "${web_state}" ]]; then
  log "ERROR: web service not found — run bash deploy/scripts/diagnose-502.sh"
  exit 1
fi

log "restarting web (state=${web_state})"
if [[ "${WATCH_HEALTH_DRY_RUN:-}" == "1" ]]; then
  log "dry-run: would run docker compose restart web"
  exit 0
fi

docker compose restart web
printf '%s\n' "${now}" >"${LAST_RESTART_FILE}"
rm -f "${STATE_FILE}"

# Give Next a moment, then report.
sleep 8
if curl -fsS -m 10 "${HEALTH_URL}" >/dev/null 2>&1; then
  log "OK: health restored after restart"
  exit 0
fi
log "WARN: health still failing after restart — bash deploy/scripts/diagnose-502.sh"
exit 1
