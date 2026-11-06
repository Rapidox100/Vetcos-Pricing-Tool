# Vetcos Quote Tool — Admin Guide

A short guide for administrators. For installation and running the app, see the
main `README.md`.

---

## 1. First run — creating the first admin

The very first time the app is opened, it shows a **Welcome — set up your admin**
screen. Enter your name, a username, and a password (at least 8 characters). This
creates the first administrator and signs you in. From here you build the rest of
the team.

There is always **at least one active admin** — the app will not let you switch off
or delete the last one.

---

## 2. Roles — who sees what

| Area                | Sales | Admin |
|---------------------|:-----:|:-----:|
| Quotation (new)     |  ✓    |  ✓    |
| Quotes list         | own only | all users |
| Team                |       |  ✓    |
| Pricing Rules       |       |  ✓    |
| Activity Log        |       |  ✓    |

Permissions are enforced on the server. A Sales user cannot see any admin data even
by trying to reach it directly.

---

## 3. Managing the team

Open the **Team** tab.

- **Add user** — enter the person's name, username, and role (Sales or Admin). For the
  temporary password, click **Generate** for a strong random one (or type your own, min 8
  characters). Share it with the user securely. They must change it the first time they
  sign in.
- **Reset password** — sets a new temporary password for a user (for example if they're
  locked out or forgot theirs). They'll be asked to choose a new password at next sign-in.
- **Switch off / Switch on** — a switched-off user cannot sign in, but their quotes and
  history remain. Use this instead of deleting when someone leaves.
- **Delete** — permanently removes a user. A user who has **issued quotes cannot be
  deleted** (to preserve history) — switch them off instead. You cannot delete your own
  account, and you cannot remove the last active admin.

Every one of these actions is written to the Activity Log.

---

## 4. Pricing Rules

Open the **Pricing Rules** tab. These settings drive every **new** quotation. Existing
quotes keep the rate they were issued with. Every change is logged with the old and new
value.

| Setting | Default | What it does |
|---|---|---|
| Monthly revenue target | ₹6,500 | Divided by monthly appointments to set the per-appointment rate. |
| Maximum package | ₹7,500 | The ceiling package that gives the list rate. |
| Minimum rate | ₹15 / appt | The rate never goes below this. |
| Escalation after year 1 | 10% | Applied after the first year (shown in terms). |
| Free-module period | 12 months | Early-bird: new standard modules are free for this long. |
| GST | 18% | Added on top of the monthly estimate. |
| Days per month | 30 | Appointments/day × this = appointments/month. |
| Rate review after | 3 months | Review if the committed volume isn't met (shown in terms). |

A **live example** panel on the right shows the resulting rate and monthly total for
10 and 15 appointments/day using your draft values, before you save.

### How the rate works

```
appointments/month = appointments/day × days per month
rate               = round(monthly revenue target ÷ appointments/month), min = minimum rate
monthly estimate   = appointments/month × rate   (then + GST)
```

There is **no monthly minimum charge**. The actual bill is appointments × rate. The
revenue target only decides the rate.

### Open item: doctor's fee

The quotation captures a **doctor's fee per appointment** and shows it for reference,
but in this version it does **not** change the rate. Management still needs to decide
how it should affect pricing (options discussed: show the rate as a percentage of the
fee; fee bands; or a percentage of the fee with a minimum). Once decided, it can be
added as a pricing rule.

---

## 5. Issuing a quotation (Sales and Admin)

Open the **Quotation** tab.

1. Fill in the clinic details. **Clinic name**, **appointments per day**, and
   **quotation validity (days)** are required.
2. The **rate per appointment** and the **estimated monthly billing** update live on
   the right as you type. The rate is calculated automatically and cannot be edited.
3. Click **Save quotation**. A **confirmation box** appears showing the clinic, the
   appointments per day, the rate, the estimated monthly total and the validity.
   Click **Yes, save** to confirm, or **Go back** to keep editing. This prevents
   saving a quote by accident.
4. Once saved, the quote gets a number like `VQ-261106-001` and the pricing is frozen
   at that moment. Download buttons appear for the **Quotation PDF** and the
   **Purchase Order PDF**.

The **Prepared by** name on every quotation is the signed-in user — Sales cannot change it.

You can always re-download the PDFs later from the **Quotes** tab.

---

## 5a. Editing a saved quotation

You can change a quote after it has been saved.

- On the **Quotes** tab, click **Edit** on the row you want to change. (Sales can edit
  their own quotes; admins can edit any quote.)
- The form opens pre-filled, titled **Edit Quotation VQ-…**. It keeps the **same quote
  number** — editing updates the existing quote and its PDFs, it does not create a new one.
- **The per-appointment rate stays frozen** at its original value by default, so fixing a
  typo or address never changes the price. If you *do* want the price recalculated (for
  example the committed appointments changed, or the pricing rules were updated since),
  tick **"Recalculate rate from current pricing rules"**. The summary on the right shows
  whether the rate is frozen or recalculated before you save.
- Click **Update quotation**, confirm in the box, and the quote and both PDFs are updated.

Every edit is written to the **Activity Log** (action *Quotation edited*), including what
changed and whether the rate was recalculated.

---

## 6. Quotes list

- **Sales** see only their own quotes.
- **Admins** see all quotes from everyone, with the issuer's name.

Each row links to the Quotation PDF and the Purchase Order PDF, and has an **Edit**
link (see section 5a). Use the search box to filter by clinic, quote number, or
(admins) the person who issued it.

---

## 7. Activity Log (admin only)

The **Activity Log** records who did what and when:

- sign-in, failed sign-in, sign-out
- quotation saved, quotation edited (with what changed), PDF downloaded
- password changed, password reset
- pricing-rule change (with old → new value)
- user created, switched on/off, deleted

Use the dropdown to filter by action type. This is your audit trail.

---

## 8. Account & passwords

- Any user can change their own password from the avatar menu (top right) →
  **Change password**.
- New users and users whose password was reset are **required** to set their own
  password at next sign-in.
- After **5 wrong attempts**, sign-in for that account is locked for **30 seconds**.

---

## 9. Backups

Everything lives in one file: **`server/data/vetcos.db`**. To back up, stop the app
and copy that file somewhere safe. To restore, put it back. Keep regular copies.

---

## 10. Before going live (checklist for management/IT)

- [ ] Set a strong `JWT_SECRET` in `.env`.
- [ ] Serve the app over **HTTPS** and enable the secure cookie flag.
- [ ] Confirm the T&C placeholders: **payment terms, notice period, service levels**.
- [ ] Confirm the **doctor's-fee** pricing decision (see section 4).
- [ ] Set up a backup schedule for `vetcos.db`.

---

*SMS Vetcare Technologies Private Limited · Thiruvananthapuram · The Future of Vet Care*
