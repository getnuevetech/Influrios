#!/bin/sh
# Host crontab entry (every 5 minutes):
# */5 * * * * CRON_SECRET=... APP_URL=https://example.com /var/www/influrios/deploy/scripts/sweep-cron.sh
set -eu
APP_URL="${APP_URL:-http://127.0.0.1:3000}"
if [ -z "${CRON_SECRET:-}" ]; then
  echo "CRON_SECRET is required" >&2
  exit 1
fi
curl -fsS -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_URL%/}/api/cron/sweeps"
echo
