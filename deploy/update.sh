#!/usr/bin/env bash
# Pull the latest code, rebuild the website and restart the API.
# Run on the server from the project folder:  bash deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Installing backend dependencies"
(cd server && npm ci --omit=dev)

echo "==> Building website"
(cd client && npm ci && npm run build)

echo "==> Restarting API"
pm2 reload deploy/ecosystem.config.cjs --update-env
pm2 save

echo "==> Health check"
sleep 2
curl -fsS http://127.0.0.1:5000/api/health && echo && echo "Done."
