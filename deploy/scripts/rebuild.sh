#!/usr/bin/env bash
# One-shot fix when PM2 says: Could not find a production build in '.next'
set -euo pipefail
cd "${APP_DIR:-/var/www/influrios}"

echo "==> Stop crash-looping PM2 process"
pm2 stop influrios 2>/dev/null || true
pm2 delete influrios 2>/dev/null || true

echo "==> Ensure swap (helps 2GB instances survive next build)"
if ! swapon --show | grep -q /; then
  if [[ ! -f /swapfile ]]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
  fi
  sudo swapon /swapfile || true
fi
free -h

echo "==> Pull latest + full rebuild"
git pull origin main
bash deploy/scripts/deploy.sh
