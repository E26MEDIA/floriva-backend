#!/usr/bin/env bash
# Run ON THE VPS (after SSH login) to update the Floriva API.
#
# Usage (from backend repo on server):
#   cd /var/www/floriva-backend
#   bash scripts/update-vps-backend.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PATH="${BACKEND_PATH:-$(cd "$SCRIPT_DIR/.." && pwd)}"

echo "==> Updating backend at: $BACKEND_PATH"
cd "$BACKEND_PATH"

git fetch origin main
git reset --hard origin/main

npm ci --omit=dev

mkdir -p uploads/products uploads/categories uploads/site-content uploads/vendors uploads/blog

if pm2 describe floriva-api > /dev/null 2>&1; then
  pm2 restart floriva-api
elif pm2 describe backend > /dev/null 2>&1; then
  pm2 restart backend
else
  pm2 restart all || true
fi

echo "==> Done. Test: curl -s https://api.florivagifts.com/api/categoryview | head -c 120"
