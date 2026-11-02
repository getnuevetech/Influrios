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
echo "========== Web health (compose) =========="
docker compose ps web 2>&1 || true
echo
echo "========== Fix =========="
cat <<EOF
cd ${APP_DIR}
# Hung web (container Up, nothing on :3000 / health fail): try a restart first.
bash deploy/scripts/watch-health.sh
# Or force once:
#   docker compose restart web && sleep 8 && curl -fsS http://127.0.0.1:3000/api/health

# Still down — redeploy from main:
git fetch origin main && git checkout main && git pull origin main
bash deploy/scripts/deploy.sh
# entrypoint runs prisma migrate deploy (AuthLockout + AdminUser.permissionVersion)
curl -fsS http://127.0.0.1:3000/api/health
# http://127.0.0.1/ is nginx's default site (404). Check the public host.
curl -fsSI "\${NEXT_PUBLIC_APP_URL:-https://influrios.com}"
node scripts/staging-evidence-probe.mjs "\${NEXT_PUBLIC_APP_URL:-https://influrios.com}"
# After green probe, continue Phase M E6:
#   npm run staging:e6-marketplace-evidence

# Optional: auto-restart hung webs (Compose does not restart on unhealthy alone):
#   */2 * * * * APP_DIR=${APP_DIR} ${APP_DIR}/deploy/scripts/watch-health.sh >>/var/log/influrios-watch-health.log 2>&1
EOF
