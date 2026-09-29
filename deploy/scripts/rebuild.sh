#!/usr/bin/env bash
# Rebuild/restart the Dockerized Influrios stack (replaces PM2 rebuild).
set -euo pipefail
cd "${APP_DIR:-/var/www/influrios}"

git pull origin main
sudo bash deploy/scripts/ensure-swap.sh || true
bash deploy/scripts/deploy.sh
