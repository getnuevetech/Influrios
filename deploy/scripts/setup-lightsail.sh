#!/usr/bin/env bash
# Influrios — first-time AWS Lightsail Ubuntu server preparation
# Run as a sudo-capable user on a fresh Ubuntu 22.04/24.04 Lightsail instance.
#
# BEFORE running this script on a brand-new server, complete:
#   docs/deploy/FRESH_SERVER_SETUP.md
#   (apt upgrade, GitHub deploy key, git clone into /var/www/influrios)
#
# Usage: bash deploy/scripts/setup-lightsail.sh
set -euo pipefail

APP_USER="${APP_USER:-ubuntu}"
APP_DIR="${APP_DIR:-/var/www/influrios}"
NODE_MAJOR="${NODE_MAJOR:-22}"

if [[ ! -d "${APP_DIR}/.git" ]] && [[ ! -f "${APP_DIR}/package.json" ]]; then
  echo "NOTE: ${APP_DIR} does not look like the Influrios repo yet."
  echo "      Follow docs/deploy/FRESH_SERVER_SETUP.md to add a GitHub deploy key and clone first."
  echo "      Continuing with runtime install anyway..."
fi

echo "==> [1/9] System packages"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
sudo apt-get install -y \
  ca-certificates curl gnupg build-essential git nginx ufw \
  software-properties-common fail2ban unzip

echo "==> [2/9] Firewall (SSH + HTTP/HTTPS only — Postgres stays on localhost via Docker)"
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable || true

echo "==> [3/9] Docker Engine + Compose plugin (for PostgreSQL)"
if ! command -v docker >/dev/null 2>&1; then
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
sudo systemctl enable --now docker
sudo usermod -aG docker "${APP_USER}" || true
docker --version
docker compose version

echo "==> [4/9] Node.js ${NODE_MAJOR}.x"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt "${NODE_MAJOR}" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v
npm -v

echo "==> [5/9] PM2 process manager"
sudo npm install -g pm2
sudo env PATH="$PATH" pm2 startup systemd -u "${APP_USER}" --hp "/home/${APP_USER}" | tail -n 1 | bash || true

echo "==> [6/9] App directory ${APP_DIR}"
sudo mkdir -p "${APP_DIR}"
sudo chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

echo "==> [7/9] Nginx site (HTTP; add Certbot after DNS)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/../nginx/influrios.conf" ]]; then
  sudo cp "${SCRIPT_DIR}/../nginx/influrios.conf" /etc/nginx/sites-available/influrios
else
  echo "WARNING: nginx config not found next to script; install deploy/nginx/influrios.conf manually"
fi
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sfn /etc/nginx/sites-available/influrios /etc/nginx/sites-enabled/influrios
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo "==> [8/9] Optional: Certbot (run AFTER DNS points to this instance)"
echo "    sudo apt-get install -y certbot python3-certbot-nginx"
echo "    sudo certbot --nginx -d your-domain.com -d www.your-domain.com"

echo "==> [9/9] Done — next steps"
cat <<EOF

Server baseline is ready (Docker + Node + Nginx + PM2).

IMPORTANT: if this is your first Docker install, log out and back in (or run
  newgrp docker
) so the ${APP_USER} user can run docker without sudo.

GitHub + first clone checklist: docs/deploy/FRESH_SERVER_SETUP.md

Next:
  1. Ensure repo is at ${APP_DIR}
  2. cp .env.example .env  → set a strong POSTGRES_PASSWORD and matching DATABASE_URL
  3. bash deploy/scripts/db-up.sh          # start Postgres in Docker
  4. bash deploy/scripts/deploy.sh         # migrate, seed, build, PM2
  5. Point domain A record to this Lightsail static IP
  6. Run certbot for HTTPS

Database runs in Docker on 127.0.0.1:5432 (not public).
See docs/deploy/AWS_LIGHTSAIL.md for the full checklist.
EOF
