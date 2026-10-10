#!/usr/bin/env bash
# Ensure at least 2G of swap so Next.js Docker builds don't OOM on small Lightsail VMs.
# A tiny swap that is already active is not enough; this adds another file until SwapTotal is 2G.
set -euo pipefail

SWAP_FILE="${SWAP_FILE:-/swapfile}"
SWAP_SIZE="${SWAP_SIZE:-2G}"
MIN_SWAP_KB="${MIN_SWAP_KB:-2000000}"

swap_kb="$(awk '/SwapTotal:/ {print $2}' /proc/meminfo)"
if [[ "${swap_kb}" -ge "${MIN_SWAP_KB}" ]]; then
  echo "OK: swap already ${swap_kb} kB"
  swapon --show || true
  free -h
  exit 0
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: run as root (sudo bash deploy/scripts/ensure-swap.sh)"
  exit 1
fi

target="${SWAP_FILE}"
if [[ -e "${target}" ]]; then
  target="${SWAP_FILE}.extra"
fi
if [[ -e "${target}" ]]; then
  echo "ERROR: ${target} already exists and SwapTotal is only ${swap_kb} kB. Need at least ${MIN_SWAP_KB} kB."
  exit 1
fi

echo "==> Creating ${SWAP_SIZE} swap at ${target} (SwapTotal is ${swap_kb} kB)"
fallocate -l "${SWAP_SIZE}" "${target}" || dd if=/dev/zero of="${target}" bs=1M count=2048
chmod 600 "${target}"
mkswap "${target}"
swapon "${target}"

if ! grep -q "${target}" /etc/fstab 2>/dev/null; then
  echo "${target} none swap sw 0 0" >> /etc/fstab
fi

echo "OK: swap ready"
swapon --show
free -h
