#!/usr/bin/env bash
# Influrios — first-time AWS Lightsail Ubuntu server preparation
# Installs Docker (app + DB), Node (optional host tooling), Nginx.
# Does NOT require PM2 — the Next.js app runs in Docker.
#
# BEFORE: docs/deploy/FRESH_SERVER_SETUP.md (GitHub deploy key + clone)
# Usage: bash deploy/scripts/setup-lightsail.sh
set -euo pipefail

APP_USER="${APP_USER:-ubuntu}"
APP_DIR="${APP_DIR:-/var/www/influrios}"
NODE_MAJOR="${NODE_MAJOR:-22}"

if [[ ! -d "${APP_DIR}/.git" ]] && [[ ! -f "${APP_DIR}/package.json" ]]; then
  echo "NOTE: ${APP_DIR} does not look like the Influrios repo yet."
  echo "      Follow docs/deploy/FRESH_SERVER_SETUP.md to add a GitHub deploy key and clone first."
fi

echo "==> [1/8] System packages"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
sudo apt-get install -y \
  ca-certificates curl gnupg build-essential git nginx ufw \
  software-properties-common fail2ban unzip

echo "==> [2/8] Firewall (SSH + HTTP/HTTPS only)"
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable || true

echo "==> [3/8] Docker Engine + Compose (app + Postgres)"
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

echo "==> [4/8] Node.js ${NODE_MAJOR}.x (optional — host prisma/seed tooling)"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt "${NODE_MAJOR}" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v
npm -v

echo "==> [5/8] Remove legacy PM2 app if present"
if command -v pm2 >/dev/null 2>&1; then
  sudo -u "${APP_USER}" pm2 delete influrios >/dev/null 2>&1 || true
  echo "PM2 left installed but unused. App runs in Docker now."
fi

echo "==> [6/8] App directory ${APP_DIR}"
sudo mkdir -p "${APP_DIR}"
sudo chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

echo "==> [7/8] Nginx → 127.0.0.1:3000 (Docker web)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/../nginx/influrios.conf" ]]; then
  sudo cp "${SCRIPT_DIR}/../nginx/influrios.conf" /etc/nginx/sites-available/influrios
fi
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sfn /etc/nginx/sites-available/influrios /etc/nginx/sites-enabled/influrios
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo "==> [8/8] Swap for Docker image builds"
sudo bash "${SCRIPT_DIR}/ensure-swap.sh"

echo "==> [9/9] Done"
cat <<EOF

Docker is the process manager for Influrios (web + postgres).
Nginx on the host proxies to 127.0.0.1:3000.

If Docker was just installed:  newgrp docker

Next:
  cd ${APP_DIR}
  cp .env.example .env && nano .env
  bash deploy/scripts/deploy.sh

See docs/deploy/FRESH_SERVER_SETUP.md
EOF
