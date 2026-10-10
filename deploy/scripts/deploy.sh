#!/usr/bin/env bash
# Influrios — build & restart via Docker Compose (no PM2)
# Run from the app root. Requires .env with POSTGRES_* and NEXT_PUBLIC_APP_URL.
set -euo pipefail

APP_DIR="${APP_DIR:-$(pwd)}"
cd "${APP_DIR}"

if [[ ! -f .env ]]; then
  echo "ERROR: ${APP_DIR}/.env missing. Copy .env.example and set POSTGRES_PASSWORD + NEXT_PUBLIC_APP_URL."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

# One key for every image build. Server action ids are a hash of this key, so a
# fresh random key on each deploy makes Save post an id the new server rejects.
if [[ -z "${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:-}" ]]; then
  action_key="$(openssl rand -base64 32 | tr -d '\n')"
  tmp_env="$(mktemp)"
  if grep -q '^NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=' .env; then
    awk -v k="$action_key" 'BEGIN{done=0} /^NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=/ && !done { print "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=" k; done=1; next } { print }' .env > "$tmp_env"
  else
    cat .env > "$tmp_env"
    printf '\n# Keeps server action ids stable across image rebuilds.\nNEXT_SERVER_ACTIONS_ENCRYPTION_KEY=%s\n' "$action_key" >> "$tmp_env"
  fi
  mv "$tmp_env" .env
  chmod 600 .env
  export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$action_key"
  unset action_key tmp_env
  echo "==> Wrote NEXT_SERVER_ACTIONS_ENCRYPTION_KEY into .env"
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not found. Run bash deploy/scripts/setup-lightsail.sh first."
  exit 1
fi

# Stop legacy PM2 process if present (migrating off PM2)
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete influrios >/dev/null 2>&1 || true
  pm2 save >/dev/null 2>&1 || true
fi

echo "==> Ensure swap (avoids Next.js webpack OOM on small Lightsail)"
if [[ "$(id -u)" -eq 0 ]]; then
  bash deploy/scripts/ensure-swap.sh
else
  sudo bash deploy/scripts/ensure-swap.sh
fi

if command -v git >/dev/null 2>&1 && [[ -d .git ]]; then
  echo "==> Building from git $(git rev-parse --short HEAD) ($(git rev-parse --abbrev-ref HEAD))"
  if ! grep -q 'DOCKER_BUILD=1' Dockerfile 2>/dev/null; then
    echo "WARN: Dockerfile is missing DOCKER_BUILD=1 — pull origin/main before rebuilding."
  fi
fi

avail_kb="$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)"
echo "==> Memory available: ${avail_kb} kB"
# Postgres and Meilisearch stay up across a normal deploy. On a 2 GB box they
# leave too little RAM for `next build`, and the kernel kills the builder.
if [[ "${avail_kb}" -lt 2000000 ]]; then
  echo "==> Stopping web, Postgres, and Meilisearch so the image build can use the RAM."
  docker compose stop web meilisearch postgres || true
fi

echo "==> Build web image"
docker compose build --progress=plain web

echo "==> Start databases, then web"
bash deploy/scripts/db-up.sh
docker compose up -d meilisearch web

echo "==> Wait for web healthy on :3000"
ok=0
for _ in $(seq 1 90); do
  if curl -fsS "http://127.0.0.1:3000" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done

if [[ "$ok" -ne 1 ]]; then
  echo "ERROR: web not responding on :3000"
  docker compose ps
  docker compose logs --tail=80 web
  exit 1
fi

echo "OK: app responding on :3000"
curl -fsSI "http://127.0.0.1/" | head -5 || true
docker compose ps

echo
echo "Optional seed (from host against published Postgres port):"
echo "  npm ci && npx prisma db push && npm run db:seed"
echo "  (DATABASE_URL in .env should use 127.0.0.1 for host-side tools)"
