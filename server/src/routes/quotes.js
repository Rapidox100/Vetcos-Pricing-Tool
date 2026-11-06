import { Router } from 'express';
import db from '../lib/db.js';
import { getSettings } from '../lib/settings.js';
import { computePricing } from '../lib/pricing.js';
import { logActivity } from '../lib/activity.js';
import { requireAuth } from '../lib/middleware.js';
import { buildQuotationPDF, buildPurchaseOrderPDF } from '../lib/pdf.js';

const router = Router();
router.use(requireAuth);

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Generate the next quote number: VQ-YYMMDD-NNN where NNN is a daily counter.
function nextQuoteNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = `VQ-${yy}${mm}${dd}-`;
  const row = db
    .prepare("SELECT quote_number FROM quotes WHERE quote_number LIKE ? ORDER BY quote_number DESC LIMIT 1")
    .get(prefix + '%');
  let n = 1;
  if (row) {
    const last = parseInt(row.quote_number.slice(prefix.length), 10);
    if (!Number.isNaN(last)) n = last + 1;
  }
  return prefix + String(n).padStart(3, '0');
}

function quoteSummary(q) {
  return {
    id: q.id,
    quoteNumber: q.quote_number,
    createdAt: q.created_at,
    clinicName: q.clinic_name,
    apptsPerDay: q.appts_per_day,
    rate: q.rate,
    monthlyTotal: q.monthly_total,
    status: q.status,
    issuedByName: q.issued_by_name,
    issuedBy: q.issued_by,
  };
}

function quoteFull(q) {
  return {
    ...quoteSummary(q),
    contactDoctor: q.contact_doctor,
    numDoctors: q.num_doctors,
    city: q.city,
    mobile: q.mobile,
    email: q.email,
    address: q.address,
    gstin: q.gstin,
    doctorFee: q.doctor_fee,
    validityDays: q.validity_days,
    specialNote: q.special_note,
    apptsPerMonth: q.appts_per_month,
    monthlyEstimate: q.monthly_estimate,
    gstAmount: q.gst_amount,
    settings: JSON.parse(q.settings_snapshot || '{}'),
  };
}

// Can this user see this quote? Admin: all. Sales: only their own.
function canAccess(user, q) {
  return user.role === 'admin' || q.issued_by === user.id;
}

// POST /api/quotes — create & save a quote (freezes pricing).
router.post('/', (req, res) => {
  const b = req.body || {};
  if (!b.clinicName?.trim()) return res.status(400).json({ error: 'Clinic name is required.' });
  const apptsPerDay = Math.floor(Number(b.apptsPerDay));
  if (!Number.isFinite(apptsPerDay) || apptsPerDay < 1) {
    return res.status(400).json({ error: 'Appointments per day is required and must be at least 1.' });
  }
  const validityDays = Math.floor(Number(b.validityDays));
  if (!Number.isFinite(validityDays) || validityDays < 1) {
    return res.status(400).json({ error: 'Quotation validity (days) is required and must be at least 1.' });
  }

  const settings = getSettings();
  const pricing = computePricing({ apptsPerDay }, settings);

  const quoteNumber = nextQuoteNumber();
  const doctorFee =
    b.doctorFee === '' || b.doctorFee == null ? null : Number(b.doctorFee);

  const info = db
    .prepare(
      `INSERT INTO quotes (
         quote_number, issued_by, issued_by_name, status,
         clinic_name, contact_doctor, num_doctors, city, mobile, email, address, gstin,
         appts_per_day, doctor_fee, validity_days, special_note,
         appts_per_month, rate, monthly_estimate, gst_amount, monthly_total, settings_snapshot
       ) VALUES (
         @quote_number, @issued_by, @issued_by_name, 'issued',
         @clinic_name, @contact_doctor, @num_doctors, @city, @mobile, @email, @address, @gstin,
         @appts_per_day, @doctor_fee, @validity_days, @special_note,
         @appts_per_month, @rate, @monthly_estimate, @gst_amount, @monthly_total, @settings_snapshot
       )`
    )
    .run({
      quote_number: quoteNumber,
      issued_by: req.user.id,
      issued_by_name: req.user.name, // prepared-by = signed-in user, not editable by sales
      clinic_name: b.clinicName.trim(),
      contact_doctor: b.contactDoctor?.trim() || null,
      num_doctors: b.numDoctors ? Math.floor(Number(b.numDoctors)) : null,
      city: b.city?.trim() || null,
      mobile: b.mobile?.trim() || null,
      email: b.email?.trim() || null,
      address: b.address?.trim() || null,
      gstin: b.gstin?.trim() || null,
      appts_per_day: apptsPerDay,
      doctor_fee: doctorFee,
      validity_days: validityDays,
      special_note: b.specialNote?.trim() || null,
      appts_per_month: pricing.apptsPerMonth,
      rate: pricing.rate,
      monthly_estimate: pricing.monthlyEstimate,
      gst_amount: pricing.gstAmount,
      monthly_total: pricing.monthlyTotal,
      settings_snapshot: JSON.stringify(settings),
    });

  const saved = db.prepare('SELECT * FROM quotes WHERE id = ?').get(info.lastInsertRowid);
  logActivity({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'QUOTE_SAVED',
    target: quoteNumber,
    details: { clinic: saved.clinic_name, apptsPerDay, rate: saved.rate, monthly: saved.monthly_total },
  });

  res.status(201).json({ quote: quoteFull(saved) });
});

// Validate the editable customer/commercial fields shared by create & edit.
// Returns { error } on failure, or the cleaned values on success.
function validateQuoteBody(b) {
  if (!b.clinicName?.trim()) return { error: 'Clinic name is required.' };
  const apptsPerDay = Math.floor(Number(b.apptsPerDay));
  if (!Number.isFinite(apptsPerDay) || apptsPerDay < 1) {
    return { error: 'Appointments per day is required and must be at least 1.' };
  }
  const validityDays = Math.floor(Number(b.validityDays));
  if (!Number.isFinite(validityDays) || validityDays < 1) {
    return { error: 'Quotation validity (days) is required and must be at least 1.' };
  }
  return {
    clinic_name: b.clinicName.trim(),
    contact_doctor: b.contactDoctor?.trim() || null,
    num_doctors: b.numDoctors ? Math.floor(Number(b.numDoctors)) : null,
    city: b.city?.trim() || null,
    mobile: b.mobile?.trim() || null,
    email: b.email?.trim() || null,
    address: b.address?.trim() || null,
    gstin: b.gstin?.trim() || null,
    appts_per_day: apptsPerDay,
    doctor_fee: b.doctorFee === '' || b.doctorFee == null ? null : Number(b.doctorFee),
    validity_days: validityDays,
    special_note: b.specialNote?.trim() || null,
  };
}

// PUT /api/quotes/:id — edit a saved quote in place (same quote number).
// Access: the user who issued it, or any admin.
// Rate behaviour:
//   - By default the ORIGINAL per-appointment rate stays frozen; only the
//     monthly figures are re-derived (appts/month x frozen rate + GST from the
//     original snapshot).
//   - If the request sets recalculate:true, the rate, GST and settings snapshot
//     are recomputed from the CURRENT pricing rules.
router.put('/:id', (req, res) => {
  const q = db.prepare('SELECT * FROM quotes WHERE id = ?').get(Number(req.params.id));
  if (!q) return res.status(404).json({ error: 'Quote not found.' });
  if (!canAccess(req.user, q)) return res.status(403).json({ error: 'Not allowed.' });

  const b = req.body || {};
  const v = validateQuoteBody(b);
  if (v.error) return res.status(400).json({ error: v.error });

  const recalculate = b.recalculate === true;
  const origSettings = JSON.parse(q.settings_snapshot || '{}');

  let rate, gstPct, snapshot;
  if (recalculate) {
    const current = getSettings();
    const priced = computePricing({ apptsPerDay: v.appts_per_day }, current);
    rate = priced.rate;
    gstPct = current.gst_pct;
    snapshot = JSON.stringify(current);
  } else {
    // Keep the frozen rate and the original GST%/snapshot.
    rate = q.rate;
    gstPct = Number(origSettings.gst_pct) || 0;
    snapshot = q.settings_snapshot;
  }

  const apptsPerMonth = v.appts_per_day * (Number(JSON.parse(snapshot).days_per_month) || 30);
  const monthlyEstimate = round2(apptsPerMonth * rate);
  const gstAmount = round2((monthlyEstimate * gstPct) / 100);
  const monthlyTotal = round2(monthlyEstimate + gstAmount);

  db.prepare(
    `UPDATE quotes SET
       clinic_name=@clinic_name, contact_doctor=@contact_doctor, num_doctors=@num_doctors,
       city=@city, mobile=@mobile, email=@email, address=@address, gstin=@gstin,
       appts_per_day=@appts_per_day, doctor_fee=@doctor_fee, validity_days=@validity_days,
       special_note=@special_note, appts_per_month=@appts_per_month, rate=@rate,
       monthly_estimate=@monthly_estimate, gst_amount=@gst_amount, monthly_total=@monthly_total,
       settings_snapshot=@settings_snapshot
     WHERE id=@id`
  ).run({
    ...v,
    appts_per_month: apptsPerMonth,
    rate,
    monthly_estimate: monthlyEstimate,
    gst_amount: gstAmount,
    monthly_total: monthlyTotal,
    settings_snapshot: snapshot,
    id: q.id,
  });

  const updated = db.prepare('SELECT * FROM quotes WHERE id = ?').get(q.id);

  // Build a short summary of what changed, for the activity log.
  const changes = {};
  const fieldMap = {
    clinic_name: 'clinic',
    appts_per_day: 'apptsPerDay',
    validity_days: 'validityDays',
    rate: 'rate',
    monthly_total: 'monthly',
  };
  for (const [col, label] of Object.entries(fieldMap)) {
    if (q[col] !== updated[col]) changes[label] = { old: q[col], new: updated[col] };
  }

  logActivity({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'QUOTE_EDITED',
    target: updated.quote_number,
    details: { recalculated: recalculate, changes },
  });

  res.json({ quote: quoteFull(updated) });
});

// GET /api/quotes — list quotes (admin: all, sales: own).
router.get('/', (req, res) => {
  let rows;
  if (req.user.role === 'admin') {
    rows = db.prepare('SELECT * FROM quotes ORDER BY created_at DESC, id DESC').all();
  } else {
    rows = db.prepare('SELECT * FROM quotes WHERE issued_by = ? ORDER BY created_at DESC, id DESC').all(req.user.id);
  }
  res.json({ quotes: rows.map(quoteSummary) });
});

// GET /api/quotes/:id — single quote (access-checked).
router.get('/:id', (req, res) => {
  const q = db.prepare('SELECT * FROM quotes WHERE id = ?').get(Number(req.params.id));
  if (!q) return res.status(404).json({ error: 'Quote not found.' });
  if (!canAccess(req.user, q)) return res.status(403).json({ error: 'Not allowed.' });
  res.json({ quote: quoteFull(q) });
});

// Shared PDF handler.
async function sendPdf(req, res, kind) {
  const q = db.prepare('SELECT * FROM quotes WHERE id = ?').get(Number(req.params.id));
  if (!q) return res.status(404).json({ error: 'Quote not found.' });
  if (!canAccess(req.user, q)) return res.status(403).json({ error: 'Not allowed.' });

  const settings = JSON.parse(q.settings_snapshot || '{}');
  // tuck days into the quote object for the PDF header label
  q.settings_days = settings.days_per_month;

  let bytes, filename, action;
  if (kind === 'quotation') {
    bytes = await buildQuotationPDF(q, settings);
    filename = `${q.quote_number}-Quotation.pdf`;
    action = 'QUOTATION_DOWNLOADED';
  } else {
    bytes = await buildPurchaseOrderPDF(q, settings);
    filename = `${q.quote_number}-PurchaseOrder.pdf`;
    action = 'PO_DOWNLOADED';
  }

  logActivity({ actorId: req.user.id, actorName: req.user.name, action, target: q.quote_number });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.send(Buffer.from(bytes));
}

// GET /api/quotes/:id/quotation.pdf
router.get('/:id/quotation.pdf', (req, res) => sendPdf(req, res, 'quotation'));
// GET /api/quotes/:id/purchase-order.pdf
router.get('/:id/purchase-order.pdf', (req, res) => sendPdf(req, res, 'po'));

export default router;
