#!/usr/bin/env bash
# Set up real, trusted HTTPS for vetcos.smstraining.in via Let's Encrypt (certbot).
# Reuses the certbot already installed on this box for smstraining.in - does not
# reinstall anything if it's already present.
#
# Run on the Lightsail server:
#   cd ~/Vetcos-Pricing-Tool && git pull && bash deploy/enable-https-vetcos.sh
set -euo pipefail

DOMAIN="vetcos.smstraining.in"

echo "==> Checking for certbot (should already be installed from the training portal setup)"
if [ ! -x /opt/certbot/bin/certbot ] && ! command -v certbot >/dev/null; then
  echo "    not found, installing (Amazon Linux 2023 uses pip/venv, not a dnf package)"
  sudo dnf install -y augeas-libs python3 python3-devel python3-pip gcc >/dev/null
  sudo python3 -m venv /opt/certbot
  sudo /opt/certbot/bin/pip install --upgrade pip >/dev/null
  sudo /opt/certbot/bin/pip install certbot certbot-nginx >/dev/null
  sudo ln -sf /opt/certbot/bin/certbot /usr/bin/certbot
fi
certbot --version

echo "==> Requesting the certificate for $DOMAIN (talks to Let's Encrypt, edits Nginx config automatically)"
sudo certbot --nginx \
  -d "$DOMAIN" \
  --non-interactive --agree-tos -m "admin@smstraining.in" \
  --redirect

echo "==> Setting up auto-renewal (certs expire every 90 days) - skips if already scheduled"
sudo systemctl enable --now certbot-renew.timer 2>/dev/null || \
  (crontab -l 2>/dev/null; echo "0 3 * * * /usr/bin/certbot renew --quiet") | sort -u | crontab -

echo ""
echo "=================================================="
echo "DONE. Vetcos is now live with real HTTPS at:"
echo ""
echo "  https://${DOMAIN}"
echo ""
echo "No security warnings, works on every device."
echo "=================================================="
