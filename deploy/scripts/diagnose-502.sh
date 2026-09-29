#!/usr/bin/env bash
# Diagnose 502 Bad Gateway on Lightsail (Nginx up, app down).
# Run ON the server: bash deploy/scripts/diagnose-502.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/influrios}"

echo "========== 1) Nginx =========="
systemctl is-active nginx || true
sudo nginx -t 2>&1 || true
echo
echo "========== 2) Port 3000 =========="
ss -lntp | grep 3000 || echo "NOTHING listening on :3000  ← this causes 502"
echo
echo "========== 3) PM2 =========="
if command -v pm2 >/dev/null 2>&1; then
  pm2 status || true
  pm2 describe influrios 2>/dev/null | head -40 || echo "No PM2 app named influrios"
else
  echo "pm2 not installed"
fi
echo
echo "========== 4) Docker Postgres =========="
if command -v docker >/dev/null 2>&1; then
  docker compose -f "${APP_DIR}/docker-compose.yml" ps 2>/dev/null || docker ps --filter name=influrios || true
else
  echo "docker not installed"
fi
echo
echo "========== 5) App files =========="
ls -la "${APP_DIR}/package.json" "${APP_DIR}/.env" "${APP_DIR}/.next" 2>&1 || true
echo
echo "========== 6) Quick fix sequence =========="
cat <<EOF
cd ${APP_DIR}
git checkout main && git pull origin main
test -f .env || cp .env.example .env
# edit .env: strong POSTGRES_PASSWORD + matching DATABASE_URL + NEXT_PUBLIC_APP_URL=http://YOUR_IP
bash deploy/scripts/db-up.sh
bash deploy/scripts/deploy.sh
pm2 status
curl -I http://127.0.0.1:3000
curl -I http://127.0.0.1/
EOF
