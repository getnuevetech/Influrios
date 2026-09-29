#!/usr/bin/env bash
# Rebuild/restart the Dockerized Influrios stack (replaces PM2 rebuild).
set -euo pipefail
cd "${APP_DIR:-/var/www/influrios}"

git pull origin main
bash deploy/scripts/deploy.sh
