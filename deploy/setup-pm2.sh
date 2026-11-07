#!/usr/bin/env bash
# One-time provisioning script for the Vetcos Quote Tool on an existing
# Amazon Linux Lightsail instance that already runs other apps via pm2 + Nginx
# (matches the setup used for training-api / sms-task / vet-survey).
#
# Usage (run as ec2-user, NOT root - pm2 apps run as this user):
#   curl -fsSL https://raw.githubusercontent.com/Rapidox100/Vetcos-Pricing-Tool/main/deploy/setup-pm2.sh -o setup-pm2.sh
#   chmod +x setup-pm2.sh
#   ./setup-pm2.sh
#
# Safe to re-run - it pulls the latest code, rebuilds, and restarts the pm2
# process, without touching the database.

set -euo pipefail

REPO_URL="https://github.com/Rapidox100/Vetcos-Pricing-Tool.git"
APP_DIR="$HOME/Vetcos-Pricing-Tool"
PM2_NAME="vetcos-quote-tool"
APP_PORT="3100"   # distinct from training-api (4000) etc - adjust if this clashes

echo "==> Checking for Node.js"
if ! command -v node >/dev/null; then
  echo "Node.js not found. Install it the same way the other apps on this box were set up, e.g.:"
  echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
  echo "  source ~/.bashrc && nvm install 20"
  exit 1
fi
node -v
npm -v

echo "==> Checking for pm2"
if ! command -v pm2 >/dev/null; then
  npm i -g pm2
fi
pm2 -v

echo "==> Checking for build tools (needed for better-sqlite3's native module)"
if ! command -v gcc >/dev/null || ! command -v python3 >/dev/null; then
  sudo dnf groupinstall -y "Development Tools" || sudo dnf install -y gcc gcc-c++ make
  sudo dnf install -y python3
fi

echo "==> Fetching application code"
if [[ -d "$APP_DIR/.git" ]]; then
  cd "$APP_DIR"
  git pull origin main
else
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

echo "==> Installing dependencies and building the frontend"
npm run setup

echo "==> Writing environment file (.env) - only if it doesn't already exist"
if [[ ! -f "$APP_DIR/.env" ]]; then
  SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  cat > "$APP_DIR/.env" <<EOF
PORT=$APP_PORT
NODE_ENV=production
JWT_SECRET=$SECRET
TOKEN_EXPIRY=12h
EOF
  chmod 600 "$APP_DIR/.env"
  echo "    generated a new JWT_SECRET, app will listen on port $APP_PORT"
else
  echo "    .env already exists, leaving it untouched"
fi

echo "==> Starting / restarting with pm2"
cd "$APP_DIR"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  pm2 start server/src/index.js --name "$PM2_NAME"
fi
pm2 save

echo ""
echo "============================================================"
echo "  Done. App is running under pm2 as '$PM2_NAME' on port $APP_PORT."
echo ""
echo "  pm2 status              - see it alongside your other apps"
echo "  pm2 logs $PM2_NAME       - view logs"
echo "  pm2 restart $PM2_NAME    - restart"
echo ""
echo "  Next: add an Nginx location/server block to proxy your domain"
echo "  to http://127.0.0.1:$APP_PORT - see deploy/nginx-vetcos.conf"
echo "  for the exact snippet to add, then: sudo nginx -t && sudo systemctl reload nginx"
echo "============================================================"
