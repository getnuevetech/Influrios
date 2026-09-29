#!/usr/bin/env bash
# Stop Influrios Postgres container (data volume is kept).
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "${APP_DIR}"

docker compose stop postgres
echo "Postgres stopped. Volume 'influrios_pg' retained. To wipe data: docker compose down -v"
