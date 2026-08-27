#!/usr/bin/env bash
# Update the SAME directory PM2 is actually running, then restart.
set -euo pipefail

APP_NAME="${APP_NAME:-floriva-backend}"
BRANCH="${SEO_BRANCH:-cursor/seo-cms-cors-login-b7cc}"

if ! command -v pm2 >/dev/null; then
  echo "pm2 not found"
  exit 1
fi

CWD="$(pm2 jlist | node -e '
let raw = "";
process.stdin.on("data", (c) => { raw += c; });
process.stdin.on("end", () => {
  const apps = JSON.parse(raw || "[]");
  const app = apps.find((item) => item.name === "floriva-backend");
  if (!app) {
    console.error("PM2 app not found: floriva-backend");
    process.exit(1);
  }
  process.stdout.write(app.pm2_env.pm_cwd || "");
});
')"

if [ -z "$CWD" ]; then
  echo "Could not read PM2 cwd for $APP_NAME"
  exit 1
fi

echo "==> PM2 $APP_NAME runs from: $CWD"
cd "$CWD"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"
mkdir -p uploads/blog
pm2 restart "$APP_NAME" --update-env
echo "==> waiting for port 7000"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:7000/api/cms; then
    break
  fi
  sleep 1
done
echo "==> public payload:"
curl -sS --max-time 5 http://127.0.0.1:7000/api/seo/public || true
echo
echo "==> signin page:"
curl -sI --max-time 5 http://127.0.0.1:7000/api/cms | head -n 8 || true
echo "==> Open: https://api.florivagifts.com/api/cms"
pm2 logs "$APP_NAME" --lines 30 --nostream
