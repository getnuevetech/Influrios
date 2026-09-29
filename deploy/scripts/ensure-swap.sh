#!/usr/bin/env bash
# Ensure a swap file exists so Next.js Docker builds don't OOM on small Lightsail VMs.
set -euo pipefail

SWAP_FILE="${SWAP_FILE:-/swapfile}"
SWAP_SIZE="${SWAP_SIZE:-2G}"

if swapon --show | grep -q .; then
  echo "OK: swap already active"
  swapon --show
  free -h
  exit 0
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: run as root (sudo bash deploy/scripts/ensure-swap.sh)"
  exit 1
fi

echo "==> Creating ${SWAP_SIZE} swap at ${SWAP_FILE}"
if [[ ! -f "${SWAP_FILE}" ]]; then
  fallocate -l "${SWAP_SIZE}" "${SWAP_FILE}" || dd if=/dev/zero of="${SWAP_FILE}" bs=1M count=2048
  chmod 600 "${SWAP_FILE}"
  mkswap "${SWAP_FILE}"
fi

swapon "${SWAP_FILE}" || true

if ! grep -q "${SWAP_FILE}" /etc/fstab 2>/dev/null; then
  echo "${SWAP_FILE} none swap sw 0 0" >> /etc/fstab
fi

echo "OK: swap ready"
swapon --show
free -h
