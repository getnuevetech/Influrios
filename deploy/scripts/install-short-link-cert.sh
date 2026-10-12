#!/usr/bin/env bash
# Install the already-issued influrios.com certificate onto inflr.me.
# Certbot refuses to install when no server_name lists inflr.me. This adds
# inflr.me and www.inflr.me to those directives, reloads nginx, then runs
# `certbot install`. It does not replace the HTTPS server block.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE="${NGINX_SITE:-/etc/nginx/sites-available/influrios}"
CERT_NAME="${CERT_NAME:-influrios.com}"
PATCH="${ROOT}/deploy/scripts/nginx_server_names.py"

if [[ ! -f "${SITE}" ]]; then
  echo "Missing ${SITE}. Copy deploy/nginx/influrios.conf there before the first certificate." >&2
  exit 1
fi
if [[ ! -f "${PATCH}" ]]; then
  echo "Missing ${PATCH}." >&2
  exit 1
fi

backup="${SITE}.bak.$(date +%Y%m%d%H%M%S)"
tmp="$(mktemp)"
trap 'rm -f "${tmp}"' EXIT

echo "==> Backup ${backup}"
sudo cp "${SITE}" "${backup}"

echo "==> Add inflr.me to server_name in ${SITE}"
sudo python3 "${PATCH}" "${SITE}" > "${tmp}"
if [[ ! -s "${tmp}" ]]; then
  echo "The nginx patch was empty. ${SITE} was not changed." >&2
  exit 1
fi
if ! grep -q 'server_name[^;]*inflr\.me' "${tmp}"; then
  echo "No server_name lists influrios.com, so inflr.me was not added. ${SITE} was not changed." >&2
  exit 1
fi
sudo cp "${tmp}" "${SITE}"

if ! sudo nginx -t; then
  echo "nginx -t failed. Restored ${backup}." >&2
  sudo cp "${backup}" "${SITE}"
  exit 1
fi
sudo systemctl reload nginx

echo "==> Install saved certificate ${CERT_NAME}"
sudo certbot install --cert-name "${CERT_NAME}" --nginx --non-interactive

echo "==> Check https://inflr.me/"
curl -fsSI "https://inflr.me/" | head -n 5
echo "Backup kept at ${backup}"
