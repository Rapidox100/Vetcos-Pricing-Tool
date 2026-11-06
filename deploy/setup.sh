#!/usr/bin/env bash
# One-time provisioning script for the Vetcos Quote Tool on a fresh
# AWS Lightsail Ubuntu instance.
#
# Usage (run as a user with sudo, e.g. the default "ubuntu" user):
#   curl -fsSL https://raw.githubusercontent.com/Rapidox100/Vetcos-Pricing-Tool/main/deploy/setup.sh -o setup.sh
#   chmod +x setup.sh
#   sudo ./setup.sh YOUR_DOMAIN
#
# Re-running this script is safe - it skips steps that are already done,
# and re-pulls/rebuilds the app so you can also use it to update.

set -euo pipefail

DOMAIN="${1:-}"
REPO_URL="https://github.com/Rapidox100/Vetcos-Pricing-Tool.git"
APP_DIR="/opt/vetcos/Vetcos-Pricing-Tool"
APP_USER="vetcos"

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: sudo ./setup.sh your-domain.com"
  echo "  (the domain's DNS A record must already point at this server's IP)"
  exit 1
fi

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root (sudo ./setup.sh $DOMAIN)"
  exit 1
fi

echo "==> Updating system packages"
apt-get update -y
apt-get upgrade -y

echo "==> Installing Node.js 20 (if missing)"
if ! command -v node >/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

echo "==> Installing build tools (needed for better-sqlite3's native module)"
apt-get install -y build-essential python3 git

echo "==> Installing Caddy (reverse proxy + automatic HTTPS)"
if ! command -v caddy >/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi
caddy version

echo "==> Creating dedicated app user (if missing)"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
fi

echo "==> Fetching application code"
mkdir -p /opt/vetcos
if [[ -d "$APP_DIR/.git" ]]; then
  cd "$APP_DIR"
  sudo -u "$APP_USER" git pull origin main
else
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi

echo "==> Installing dependencies and building the frontend"
cd "$APP_DIR"
sudo -u "$APP_USER" npm run setup

echo "==> Writing environment file (.env)"
if [[ ! -f "$APP_DIR/.env" ]]; then
  SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  cat > "$APP_DIR/.env" <<EOF
PORT=3000
NODE_ENV=production
JWT_SECRET=$SECRET
TOKEN_EXPIRY=12h
EOF
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
  echo "    generated a new JWT_SECRET"
else
  echo "    .env already exists, leaving it untouched"
fi

echo "==> Ensuring the data directory exists and is writable"
mkdir -p "$APP_DIR/server/data"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/server/data"

echo "==> Installing the systemd service"
cp "$APP_DIR/deploy/vetcos.service" /etc/systemd/system/vetcos.service
systemctl daemon-reload
systemctl enable vetcos
systemctl restart vetcos
sleep 2
systemctl --no-pager status vetcos || true

echo "==> Configuring Caddy for $DOMAIN"
sed "s/YOUR_DOMAIN/$DOMAIN/" "$APP_DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile
systemctl enable caddy
systemctl restart caddy

echo ""
echo "============================================================"
echo "  Done."
echo "  App service:   systemctl status vetcos"
echo "  App logs:      journalctl -u vetcos -f"
echo "  Reverse proxy: systemctl status caddy"
echo ""
echo "  Visit: https://$DOMAIN"
echo "  (allow a minute for the HTTPS certificate to be issued the"
echo "   first time Caddy starts)"
echo "============================================================"
