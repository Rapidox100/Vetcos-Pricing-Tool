# Vetcos Quote Tool

A pricing and quotation web app for **SMS Vetcare Technologies Private Limited**
(Thiruvananthapuram). Salespeople give a clinic a price on the spot; admins control
the pricing rules, the team, and see every quote and every action.

Vetcos is veterinary clinic software sold as *free software* — the clinic is charged
per appointment booked through it. This tool calculates that per-appointment charge
and produces branded PDF quotations and purchase orders.

---

## What's in the box

```
Vetcos Pricing Tool/
├── server/          Node + Express API, SQLite database, PDF generation
│   ├── src/
│   │   ├── index.js         app entry (API + serves the built frontend)
│   │   ├── routes/          auth, users, pricing, quotes, activity
│   │   └── lib/             db, auth, pricing engine, pdf, activity log
│   ├── assets/logo.png      logo embedded in PDFs
│   └── data/vetcos.db       the database (created on first run)
├── client/          React + Vite + Tailwind frontend
│   └── src/
│       ├── pages/           Login, FirstRun, Quotation, Quotes, Team, PricingRules, ActivityLog
│       └── components/      Layout, shared UI
├── docs/ADMIN_GUIDE.md      the admin guide
└── package.json             scripts to install / build / run
```

---

## Requirements

- **Node.js 18 or newer** (built and tested on Node 24).
- Windows, macOS, or Linux. No separate database to install — it uses a local
  SQLite file.

---

## Quick start

From the project folder (`Vetcos Pricing Tool`):

```bash
# 1. Install everything (server + client) and build the frontend
npm run setup

# 2. (Recommended) create a secret for sign-in tokens
#    Copy .env.example to .env and set JWT_SECRET to a long random string.
#    Generate one with:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Start the app
npm start
```

Then open **http://localhost:3000** in a browser.

The **first time** you open it, you'll be asked to create the first administrator.
After that, the admin creates the rest of the team.

> `npm run setup` is a shortcut for `npm run install:all` (installs server + client
> dependencies) followed by `npm run build` (builds the frontend into `server/public`).

### Running on a phone / another computer on the same network

Start the app as above, find this computer's local IP address (e.g. `192.168.1.20`),
and open `http://192.168.1.20:3000` on the other device. Both devices must be on the
same Wi-Fi/network. (A shared database so everyone works off the same data from
different machines is on the roadmap — see *Later*.)

---

## Developer mode (optional)

For live-reload while editing the frontend, run the API and the Vite dev server
in two terminals:

```bash
npm run dev:server   # API on http://localhost:3000
npm run dev:client   # UI on http://localhost:5173 (proxies /api to :3000)
```

Open **http://localhost:5173**. After changing frontend code for production,
run `npm run build` again.

---

## How the price is calculated

- **Appointments per month** = appointments per day × *days per month* (admin setting, default 30).
- **Rate per appointment** = `round(monthly revenue target ÷ appointments per month)`,
  but never below the **minimum rate**. The salesperson cannot edit it.
- **Monthly estimate** = appointments per month × rate, **plus GST**. Shown as an estimate.
- There is **no monthly minimum charge** — the real bill is appointments × rate. The
  revenue target only decides the rate.

Example (defaults): 10 appointments/day → 300/month → ₹6,500 ÷ 300 ≈ **₹22/appointment**.
From ~15 appointments/day the ₹15 minimum rate kicks in.

**Doctor's fee per appointment** is captured and shown for reference but does **not**
change the rate in this version. How it should affect pricing is an open item pending
a management decision (see *Admin guide*).

All pricing settings are editable by an admin under **Pricing Rules**. Every change is
recorded in the Activity Log with the old and new value. Existing quotes keep the rate
they were issued with.

---

## Security notes

- Passwords are **hashed with bcrypt** (12 rounds, per-password salt). Plain passwords
  are never stored.
- Sign-in locks for **30 seconds after 5 wrong attempts** per account.
- Roles are enforced **on the server**, not just by hiding screens — a Sales user cannot
  reach any admin data even by calling the API directly.
- Sessions use a signed, httpOnly cookie (JWT). **Set `JWT_SECRET` in `.env`** before
  real use.
- For internet-facing deployment, put the app behind HTTPS and set the cookie `secure`
  flag (see `server/src/routes/auth.js`, `cookieOpts`).

---

## Backups

The entire application state is the single file **`server/data/vetcos.db`**. To back up,
copy that file while the app is stopped (or copy it along with any `-wal`/`-shm` files
while running). To restore, put the file back in `server/data/`.

---

## Roadmap (not in this version)

- Invoice generation from Vetcos billing records, sent to finance and copied to us.
- Approved-discount workflow.
- Export/backup tools and a shared database so all users work on the same data from
  different computers.

---

## Documents produced

- **Quotation** (3 pages): customer details, committed volume, per-appointment charge,
  estimated monthly billing with GST, what's included / charged separately, commercial
  terms, and a full Terms & Conditions page. Quote number format `VQ-YYMMDD-NNN`.
- **Purchase Order**: supplier and customer details, order summary, and signature +
  seal blocks for both parties.

Both are generated as branded PDFs with the Vetcos logo. Placeholders in the T&C
(payment terms, notice period, service levels) are marked for management/legal to confirm.

---

© SMS Vetcare Technologies Private Limited — *The Future of Vet Care*
