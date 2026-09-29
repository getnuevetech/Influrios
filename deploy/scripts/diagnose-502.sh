#!/usr/bin/env bash
# Diagnose 502 / empty reply when Nginx is up but Docker web is down.
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/influrios}"

echo "========== Docker =========="
docker --version 2>&1 || echo "docker missing"
docker compose version 2>&1 || true
echo
echo "========== Containers =========="
cd "${APP_DIR}" 2>/dev/null || true
docker compose ps 2>&1 || docker ps -a
echo
echo "========== Port 3000 =========="
ss -lntp | grep 3000 || echo "NOTHING on :3000 → Nginx 502"
echo
echo "========== Web logs (tail) =========="
docker compose logs --tail=40 web 2>&1 || true
echo
echo "========== Fix =========="
cat <<EOF
cd ${APP_DIR}
git pull origin main
# stop legacy PM2 if still running
pm2 delete influrios 2>/dev/null || true
bash deploy/scripts/deploy.sh
curl -I http://127.0.0.1:3000
curl -I http://127.0.0.1/
EOF
