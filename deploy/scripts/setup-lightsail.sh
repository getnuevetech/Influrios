#!/usr/bin/env bash
# Influrios — first-time AWS Lightsail Ubuntu server preparation
# Run as a sudo-capable user on a fresh Ubuntu 22.04/24.04 Lightsail instance.
# Usage: curl -fsSL ... | bash   OR   bash deploy/scripts/setup-lightsail.sh
set -euo pipefail

APP_USER="${APP_USER:-ubuntu}"
APP_DIR="${APP_DIR:-/var/www/influrios}"
NODE_MAJOR="${NODE_MAJOR:-22}"

echo "==> [1/8] System packages"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
sudo apt-get install -y \
  ca-certificates curl gnupg build-essential git nginx ufw \
  software-properties-common fail2ban unzip

echo "==> [2/8] Firewall (SSH + HTTP/HTTPS)"
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable || true

echo "==> [3/8] Node.js ${NODE_MAJOR}.x"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt "${NODE_MAJOR}" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v
npm -v

echo "==> [4/8] PM2 process manager"
sudo npm install -g pm2
sudo env PATH="$PATH" pm2 startup systemd -u "${APP_USER}" --hp "/home/${APP_USER}" | tail -n 1 | bash || true

echo "==> [5/8] App directory ${APP_DIR}"
sudo mkdir -p "${APP_DIR}"
sudo chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

echo "==> [6/8] Nginx site (HTTP; add Certbot after DNS)"
if [[ -f "$(dirname "$0")/../nginx/influrios.conf" ]]; then
  sudo cp "$(dirname "$0")/../nginx/influrios.conf" /etc/nginx/sites-available/influrios
else
  echo "WARNING: nginx config not found next to script; install deploy/nginx/influrios.conf manually"
fi
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sfn /etc/nginx/sites-available/influrios /etc/nginx/sites-enabled/influrios
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo "==> [7/8] Optional: Certbot (run AFTER DNS points to this instance)"
echo "    sudo apt-get install -y certbot python3-certbot-nginx"
echo "    sudo certbot --nginx -d your-domain.com -d www.your-domain.com"

echo "==> [8/8] Done — next steps"
cat <<EOF

Server baseline is ready.

Next:
  1. Create a Lightsail managed PostgreSQL DB (or install Postgres on-box).
  2. Clone the repo into ${APP_DIR}
  3. Copy .env.example → ${APP_DIR}/.env and set DATABASE_URL + NEXT_PUBLIC_APP_URL
  4. Run: bash deploy/scripts/deploy.sh
  5. Point your domain A record to this Lightsail static IP
  6. Run certbot for HTTPS

See docs/deploy/AWS_LIGHTSAIL.md for the full checklist.
EOF
