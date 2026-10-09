#!/usr/bin/env bash
# Pull the latest code and rebuild/restart the containers with minimal downtime.
# Run on the server from the project folder:  bash deploy/docker-update.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Rebuilding and restarting containers"
docker compose up -d --build

echo "==> Removing old images"
docker image prune -f

echo "==> Status"
docker compose ps
