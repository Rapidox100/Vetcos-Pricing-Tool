# Deploying to AWS Lightsail

This deploys the full app (frontend + backend + database) to a Lightsail
instance you control, reachable at your own domain over HTTPS.

Cost: **$5/month** (1GB RAM, 2 vCPU instance). No separate database cost -
the SQLite file lives on the instance's own disk, which is permanent
(unlike free-tier PaaS hosts, nothing wipes it on restart or redeploy).

---

## 1. Create the Lightsail instance

1. Go to the [Lightsail console](https://lightsail.aws.amazon.com/) → **Create instance**.
2. **Platform:** Linux/Unix. **Blueprint:** OS Only → **Ubuntu 22.04 LTS**.
3. **Instance plan:** choose the **$5/month** plan (1 GB RAM, 2 vCPUs, 40 GB SSD).
4. Name it something like `vetcos-quote-tool`, then **Create instance**.
5. Wait for it to show **Running** (about a minute).

## 2. Attach a static IP

By default the instance's IP changes if it's ever stopped/restarted. Fix it:

1. In the instance page, go to the **Networking** tab → **Create static IP**.
2. Attach it to your `vetcos-quote-tool` instance.
3. Note the static IP address shown (e.g. `13.234.x.x`) - you'll point your domain at this.

## 3. Open the firewall for HTTP/HTTPS

Still on the **Networking** tab, under **IPv4 Firewall**, make sure these rules exist:

| Application | Protocol | Port |
|---|---|---|
| SSH | TCP | 22 (should already be there) |
| HTTP | TCP | 80 |
| HTTPS | TCP | 443 |

(Port 80 is needed so Caddy can complete the Let's Encrypt HTTPS challenge.)

## 4. Point your domain at the static IP

In your domain's DNS settings (wherever you manage the domain), add an **A record**:

```
Type: A
Name: quotes            (or whatever subdomain you want, e.g. "quotes.yourdomain.com")
Value: 13.234.x.x        (the static IP from step 2)
TTL: default / 300
```

DNS can take anywhere from a few minutes to an hour to propagate. You can check with:
```
nslookup quotes.yourdomain.com
```

## 5. Connect to the instance

Easiest: in the Lightsail console, click your instance → **Connect using SSH**
(opens a browser-based terminal, no key setup needed).

## 6. Run the setup script

In that terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/Rapidox100/Vetcos-Pricing-Tool/main/deploy/setup.sh -o setup.sh
chmod +x setup.sh
sudo ./setup.sh quotes.yourdomain.com
```

Replace `quotes.yourdomain.com` with the actual domain you pointed at the IP in step 4.

This installs Node.js, Caddy, clones the repo, builds the app, generates a
secure login secret, and starts everything as a background service that
survives reboots.

Takes a few minutes. At the end it prints the URL to visit.

## 7. Open the app

Visit `https://quotes.yourdomain.com`. The first time, Caddy needs ~30-60
seconds to obtain the HTTPS certificate - if you see a certificate warning
immediately after setup finishes, just wait a minute and reload.

You'll land on the **first-run admin setup screen** - create your admin
there. This is a brand new, empty database, separate from anything on your
local machine.

---

## Updating the app later

When you (or I) push new code to the `main` branch on GitHub, deploy the
update by re-running the same script on the server:

```bash
cd ~ 
sudo ./setup.sh quotes.yourdomain.com
```

It pulls the latest code, rebuilds, and restarts the service. **Your
database is never touched by this** - it only lives in `server/data/` on
the instance's disk, which the script never deletes.

## Useful commands on the server

```bash
# View live application logs
sudo journalctl -u vetcos -f

# Restart the app
sudo systemctl restart vetcos

# Check if it's running
sudo systemctl status vetcos

# Back up the database (copy it somewhere safe regularly)
sudo cp /opt/vetcos/Vetcos-Pricing-Tool/server/data/vetcos.db ~/vetcos-backup-$(date +%Y%m%d).db
```

## Cost summary

- Lightsail instance: **$5/month** (includes the static IP while attached to a running instance)
- Domain: whatever you already pay your registrar
- HTTPS certificate: **free** (Let's Encrypt, auto-renewed by Caddy)
