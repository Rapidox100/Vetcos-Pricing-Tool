import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, '..', '..', 'assets', 'logo.png');

// --- brand palette ----------------------------------------------------------
const TEAL = rgb(0x01 / 255, 0xa5 / 255, 0xa5 / 255);
const ORANGE = rgb(0xe8 / 255, 0x5f / 255, 0x00 / 255);
const DARK = rgb(0.15, 0.17, 0.19);
const GREY = rgb(0.42, 0.45, 0.48);
const LIGHT = rgb(0.9, 0.92, 0.93);
const LIGHTBG = rgb(0.96, 0.98, 0.98);
const WHITE = rgb(1, 1, 1);

const PAGE = { w: 595.28, h: 841.89 }; // A4 portrait (points)
const MARGIN = 48;
const COMPANY = {
  name: 'SMS Vetcare Technologies Private Limited',
  place: 'Thiruvananthapuram, Kerala, India',
  tagline: 'The Future of Vet Care',
  product: 'Vetcos',
};

const INR = '₹'; // ₹ — Helvetica lacks this glyph, so we render "Rs." instead in text.
function money(n) {
  const v = Number(n || 0);
  return 'Rs. ' + v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function fmtDate(d) {
  const dt = d ? new Date(d) : new Date();
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * A tiny layout helper that tracks the current Y cursor and offers
 * reusable drawing primitives shared by both documents.
 */
class Doc {
  constructor(pdf, logo, fonts) {
    this.pdf = pdf;
    this.logo = logo;
    this.font = fonts.regular;
    this.bold = fonts.bold;
    this.page = null;
    this.y = 0;
  }

  newPage() {
    this.page = this.pdf.addPage([PAGE.w, PAGE.h]);
    this.y = PAGE.h - MARGIN;
    return this.page;
  }

  // Branded header band with the logo and company line.
  header(docTitle, meta = []) {
    const p = this.page;
    // top brand bar
    p.drawRectangle({ x: 0, y: PAGE.h - 8, width: PAGE.w, height: 8, color: TEAL });

    const logoW = 150;
    if (this.logo) {
      const scale = logoW / this.logo.width;
      const h = this.logo.height * scale;
      p.drawImage(this.logo, { x: MARGIN, y: PAGE.h - MARGIN - h + 6, width: logoW, height: h });
    } else {
      p.drawText('Vetcos', { x: MARGIN, y: PAGE.h - MARGIN - 18, size: 24, font: this.bold, color: TEAL });
    }

    // right-aligned document title + meta
    let ry = PAGE.h - MARGIN - 2;
    this.drawRight(docTitle, ry, 18, this.bold, ORANGE);
    ry -= 20;
    for (const line of meta) {
      this.drawRight(line, ry, 9, this.font, GREY);
      ry -= 12;
    }

    this.y = PAGE.h - MARGIN - 64;
    // thin divider
    p.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE.w - MARGIN, y: this.y }, thickness: 1, color: LIGHT });
    this.y -= 22;
  }

  footer(pageLabel) {
    const p = this.page;
    const fy = MARGIN - 14;
    p.drawLine({ start: { x: MARGIN, y: fy + 14 }, end: { x: PAGE.w - MARGIN, y: fy + 14 }, thickness: 0.5, color: LIGHT });
    p.drawText(`${COMPANY.name}  |  ${COMPANY.place}`, { x: MARGIN, y: fy, size: 7.5, font: this.font, color: GREY });
    if (pageLabel) this.drawRight(pageLabel, fy, 7.5, this.font, GREY);
  }

  drawRight(text, y, size, font, color) {
    const w = font.widthOfTextAtSize(text, size);
    this.page.drawText(text, { x: PAGE.w - MARGIN - w, y, size, font, color });
  }

  sectionTitle(text) {
    this.ensure(40);
    this.page.drawRectangle({ x: MARGIN, y: this.y - 3, width: 4, height: 15, color: ORANGE });
    this.page.drawText(text.toUpperCase(), { x: MARGIN + 12, y: this.y, size: 11, font: this.bold, color: TEAL });
    this.y -= 22;
  }

  // Draw a label:value pair in a two-column key/value layout.
  kv(label, value, opts = {}) {
    this.ensure(16);
    const labelX = MARGIN;
    const valueX = MARGIN + (opts.labelWidth || 150);
    this.page.drawText(label, { x: labelX, y: this.y, size: 9.5, font: this.font, color: GREY });
    const val = value == null || value === '' ? '-' : String(value);
    this.wrapText(val, valueX, PAGE.w - MARGIN - valueX, 9.5, opts.bold ? this.bold : this.font, opts.color || DARK);
  }

  // Simple paragraph with wrapping.
  paragraph(text, size = 9, color = DARK, font = this.font, lh = 13) {
    this.wrapText(text, MARGIN, PAGE.w - 2 * MARGIN, size, font, color, lh);
    this.y -= 4;
  }

  bullet(text, size = 9) {
    this.ensure(14);
    this.page.drawText('•', { x: MARGIN + 4, y: this.y, size, font: this.bold, color: TEAL });
    this.wrapText(text, MARGIN + 16, PAGE.w - MARGIN - (MARGIN + 16), size, this.font, DARK, 12.5);
  }

  // Word-wrap helper that advances this.y. Returns number of lines drawn.
  wrapText(text, x, maxWidth, size, font, color, lineHeight = 13) {
    const words = String(text).split(/\s+/);
    let line = '';
    let lines = 0;
    const flush = () => {
      this.ensure(lineHeight);
      this.page.drawText(line, { x, y: this.y, size, font, color });
      this.y -= lineHeight;
      lines++;
    };
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        flush();
        line = w;
      } else {
        line = test;
      }
    }
    if (line) flush();
    return lines;
  }

  // A boxed highlight for the headline commercial figure.
  highlightBox(rows) {
    this.ensure(30 + rows.length * 20);
    const boxX = MARGIN;
    const boxW = PAGE.w - 2 * MARGIN;
    const boxH = 24 + rows.length * 22;
    const top = this.y;
    this.page.drawRectangle({ x: boxX, y: top - boxH, width: boxW, height: boxH, color: LIGHTBG, borderColor: TEAL, borderWidth: 1 });
    let ry = top - 20;
    for (const [label, value, emphasize] of rows) {
      this.page.drawText(label, { x: boxX + 16, y: ry, size: 10, font: this.font, color: DARK });
      const vFont = emphasize ? this.bold : this.font;
      const vSize = emphasize ? 12 : 10;
      const vColor = emphasize ? ORANGE : DARK;
      const w = vFont.widthOfTextAtSize(value, vSize);
      this.page.drawText(value, { x: boxX + boxW - 16 - w, y: ry - (emphasize ? 1 : 0), size: vSize, font: vFont, color: vColor });
      ry -= 22;
    }
    this.y = top - boxH - 14;
  }

  // A two-column table (label | amount) for the billing breakdown.
  amountTable(rows) {
    const x = MARGIN;
    const w = PAGE.w - 2 * MARGIN;
    const rowH = 22;
    this.ensure(rows.length * rowH + 4);
    for (let i = 0; i < rows.length; i++) {
      const [label, amount, strong] = rows[i];
      const top = this.y;
      if (strong) {
        this.page.drawRectangle({ x, y: top - rowH + 6, width: w, height: rowH, color: LIGHTBG });
      }
      this.page.drawText(label, { x: x + 10, y: top - 9, size: strong ? 10.5 : 9.5, font: strong ? this.bold : this.font, color: strong ? TEAL : DARK });
      const amtFont = strong ? this.bold : this.font;
      const amtSize = strong ? 10.5 : 9.5;
      const aw = amtFont.widthOfTextAtSize(amount, amtSize);
      this.page.drawText(amount, { x: x + w - 10 - aw, y: top - 9, size: amtSize, font: amtFont, color: strong ? ORANGE : DARK });
      this.page.drawLine({ start: { x, y: top - rowH + 4 }, end: { x: x + w, y: top - rowH + 4 }, thickness: 0.5, color: LIGHT });
      this.y -= rowH;
    }
    this.y -= 6;
  }

  // Ensure at least h points remain; otherwise start a new page (no header).
  ensure(h) {
    if (this.y - h < MARGIN + 10) {
      this.footer();
      this.newPage();
      this.y = PAGE.h - MARGIN;
    }
  }

  space(n = 10) {
    this.y -= n;
  }
}

async function loadBase() {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Vetcos Quotation');
  pdf.setAuthor(COMPANY.name);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let logo = null;
  try {
    if (fs.existsSync(LOGO_PATH)) {
      const bytes = fs.readFileSync(LOGO_PATH);
      logo = await pdf.embedPng(bytes);
    }
  } catch {
    logo = null;
  }
  return { pdf, logo, fonts: { regular, bold } };
}

/**
 * Build the 2-page Quotation PDF (+ T&C page).
 * @param {object} q  - the saved quote row
 * @param {object} settings - pricing settings snapshot (object)
 * @returns {Promise<Uint8Array>}
 */
export async function buildQuotationPDF(q, settings) {
  const { pdf, logo, fonts } = await loadBase();
  const d = new Doc(pdf, logo, fonts);

  const validUntil = (() => {
    const base = q.created_at ? new Date(q.created_at) : new Date();
    const dt = new Date(base.getTime() + (Number(q.validity_days) || 0) * 86400000);
    return fmtDate(dt);
  })();

  // ----- PAGE 1: customer + commercials -----
  d.newPage();
  d.header('QUOTATION', [
    `Quote No: ${q.quote_number}`,
    `Date: ${fmtDate(q.created_at)}`,
    `Valid until: ${validUntil}`,
  ]);

  d.sectionTitle('Customer Details');
  d.kv('Clinic Name', q.clinic_name, { bold: true });
  d.kv('Contact Doctor', q.contact_doctor);
  d.kv('Number of Doctors', q.num_doctors);
  d.kv('City', q.city);
  d.kv('Mobile', q.mobile);
  d.kv('Email', q.email);
  d.kv('Address', q.address);
  d.kv('GSTIN', q.gstin);
  d.space(8);

  d.sectionTitle('Committed Volume & Charge');
  d.highlightBox([
    ['Committed appointments per day', String(q.appts_per_day), false],
    [`Appointments per month (x${q.settings_days || settings.days_per_month} days)`, String(q.appts_per_month), false],
    ['Charge per appointment', money(q.rate), true],
  ]);

  d.sectionTitle('Estimated Monthly Billing');
  d.amountTable([
    [`Appointments/month x ${money(q.rate)}`, money(q.monthly_estimate), false],
    [`GST @ ${settings.gst_pct}%`, money(q.gst_amount), false],
    ['Estimated monthly total', money(q.monthly_total), true],
  ]);
  d.paragraph(
    'This is an estimate only. There is no monthly minimum charge — the actual monthly invoice is the number of appointments booked through Vetcos multiplied by the charge per appointment, plus GST.',
    8,
    GREY
  );
  if (q.doctor_fee != null && q.doctor_fee !== '') {
    d.paragraph(
      `Doctor's fee per appointment (for reference): ${money(q.doctor_fee)}. Note: the per-appointment charge above is independent of the doctor's fee in this version.`,
      8,
      GREY
    );
  }
  if (q.special_note) {
    d.space(2);
    d.sectionTitle('Special Note');
    d.paragraph(q.special_note, 9);
  }

  d.footer('Page 1 of 3');

  // ----- PAGE 2: what's included / separate + commercial terms -----
  d.newPage();
  d.header('QUOTATION', [`Quote No: ${q.quote_number}`, `Clinic: ${q.clinic_name}`]);

  d.sectionTitle('What is Included');
  d.paragraph('Vetcos is provided as free clinic software. You are charged only per appointment booked through it. The following are included:', 9);
  [
    'All standard modules: appointments & token queue, pet & owner records, consultation notes & prescriptions, vaccination, billing, pharmacy & stock, lab & imaging, admissions & wards.',
    'WhatsApp reminders and booking.',
    `Early-bird offer: all new standard modules released in the first ${settings.free_module_months} months from signing are included at no extra charge.`,
  ].forEach((t) => d.bullet(t));
  d.space(6);

  d.sectionTitle('Charged Separately');
  [
    'AI features.',
    'Equipment and analyser integration.',
    'Academy and training modules.',
    'Any module announced as chargeable.',
  ].forEach((t) => d.bullet(t));
  d.space(6);

  d.sectionTitle('Commercial Terms');
  [
    `Committed minimum of ${q.appts_per_day} appointments per day, with a rate review after ${settings.rate_review_months} months if the committed volume is not met.`,
    `${settings.escalation_pct}% escalation applies after year 1.`,
    'A monthly invoice is generated from Vetcos and sent to the clinic’s finance contact.',
    `This quotation is valid for ${q.validity_days} day(s), until ${validUntil}.`,
  ].forEach((t) => d.bullet(t));
  d.space(10);

  // prepared-by block
  d.ensure(60);
  d.page.drawLine({ start: { x: MARGIN, y: d.y }, end: { x: PAGE.w - MARGIN, y: d.y }, thickness: 0.5, color: LIGHT });
  d.y -= 16;
  d.kv('Prepared by', q.issued_by_name, { bold: true });
  d.kv('For', COMPANY.name);

  d.footer('Page 2 of 3');

  // ----- PAGE 3: Terms & Conditions -----
  d.newPage();
  d.header('TERMS & CONDITIONS', [`Quote No: ${q.quote_number}`]);
  addTermsAndConditions(d, q, settings);
  d.footer('Page 3 of 3');

  return pdf.save();
}

function addTermsAndConditions(d, q, settings) {
  const items = [
    ['1. Service', `${COMPANY.product} veterinary clinic software is provided to the customer for use in their clinic operations. The software is offered free of licence fees; charges apply per appointment booked through the software as set out in this quotation.`],
    ['2. Pricing & Billing', `The charge per appointment is ${money(q.rate)}. The monthly amount payable is the number of appointments booked through ${COMPANY.product} multiplied by the charge per appointment, plus GST at ${settings.gst_pct}%. There is no monthly minimum charge. Invoices are raised monthly. [Payment terms to be confirmed by management.]`],
    ['3. Commitment & Review', `The customer commits to a minimum of ${q.appts_per_day} appointments per day. If this committed volume is not met, the per-appointment rate is subject to review after ${settings.rate_review_months} months. A ${settings.escalation_pct}% price escalation applies after the first year.`],
    ['4. Early-Bird Period', `All new standard modules released within ${settings.free_module_months} months of signing are included at no additional charge. Modules announced as chargeable, AI features, equipment/analyser integration, and academy/training modules are charged separately.`],
    ['5. Data Protection', `Personal data is processed in accordance with the Digital Personal Data Protection Act, 2023. The customer remains responsible for the lawful collection of their patients’ and owners’ data. ${COMPANY.name} acts as a data processor for data entered into ${COMPANY.product}.`],
    ['6. Confidentiality', 'Each party shall keep confidential all non-public information disclosed by the other party and use it solely for the purposes of this engagement.'],
    ['7. Service Levels', 'Support and availability service levels apply. [Specific service levels, response times and uptime commitments to be confirmed by management.]'],
    ['8. Term & Termination', 'This agreement continues on a monthly basis. Either party may terminate on written notice. [Notice period to be confirmed by management.]'],
    ['9. Liability', `${COMPANY.name}’s total liability arising out of or in connection with the service shall be limited to the fees paid by the customer in the three months preceding the claim, to the extent permitted by law.`],
    ['10. Governing Law & Disputes', 'This agreement is governed by the laws of India. The courts at Thiruvananthapuram, Kerala shall have exclusive jurisdiction over any dispute arising under it.'],
  ];
  for (const [title, body] of items) {
    d.ensure(30);
    d.page.drawText(title, { x: MARGIN, y: d.y, size: 9.5, font: d.bold, color: TEAL });
    d.y -= 14;
    d.paragraph(body, 8.5, DARK, d.font, 12);
    d.space(4);
  }
  d.space(6);
  d.paragraph('Items marked [ ] are placeholders to be confirmed by management and legal before this quotation is treated as final.', 7.5, GREY, d.font, 11);
}

/**
 * Build the Purchase Order PDF with signature & seal blocks.
 * @param {object} q
 * @param {object} settings
 * @returns {Promise<Uint8Array>}
 */
export async function buildPurchaseOrderPDF(q, settings) {
  const { pdf, logo, fonts } = await loadBase();
  pdf.setTitle('Vetcos Purchase Order');
  const d = new Doc(pdf, logo, fonts);

  d.newPage();
  d.header('PURCHASE ORDER', [
    `PO Ref: PO-${q.quote_number.replace(/^VQ-/, '')}`,
    `Against Quote: ${q.quote_number}`,
    `Date: ${fmtDate(q.created_at)}`,
  ]);

  d.sectionTitle('Supplier');
  d.kv('Company', COMPANY.name, { bold: true });
  d.kv('Place', COMPANY.place);
  d.kv('Product', `${COMPANY.product} — ${COMPANY.tagline}`);
  d.space(6);

  d.sectionTitle('Customer (Clinic)');
  d.kv('Clinic Name', q.clinic_name, { bold: true });
  d.kv('Contact Doctor', q.contact_doctor);
  d.kv('City', q.city);
  d.kv('Mobile', q.mobile);
  d.kv('Email', q.email);
  d.kv('Address', q.address);
  d.kv('GSTIN', q.gstin);
  d.space(6);

  d.sectionTitle('Order Details');
  d.amountTable([
    ['Committed appointments per day', String(q.appts_per_day), false],
    ['Appointments per month', String(q.appts_per_month), false],
    ['Charge per appointment', money(q.rate), false],
    [`Estimated monthly billing (incl. GST ${settings.gst_pct}%)`, money(q.monthly_total), true],
  ]);
  d.paragraph(
    'The customer agrees to adopt Vetcos clinic software on a pay-per-appointment basis as per the referenced quotation. This purchase order is subject to the terms and conditions of that quotation.',
    8.5,
    GREY
  );

  // Signature & seal blocks.
  d.space(24);
  d.ensure(150);
  const colW = (PAGE.w - 2 * MARGIN - 30) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colW + 30;
  const top = d.y;

  const sigBlock = (x, heading, lines) => {
    d.page.drawText(heading, { x, y: top, size: 10, font: d.bold, color: TEAL });
    const lineY = top - 60;
    d.page.drawLine({ start: { x, y: lineY }, end: { x: x + colW, y: lineY }, thickness: 0.75, color: DARK });
    d.page.drawText('Authorised Signature', { x, y: lineY - 12, size: 8, font: d.font, color: GREY });
    let ly = lineY - 30;
    for (const l of lines) {
      d.page.drawText(l, { x, y: ly, size: 8.5, font: d.font, color: DARK });
      ly -= 13;
    }
    // seal box
    d.page.drawRectangle({ x: x + colW - 80, y: lineY - 58, width: 72, height: 44, borderColor: LIGHT, borderWidth: 1 });
    d.page.drawText('Seal', { x: x + colW - 60, y: lineY - 40, size: 8, font: d.font, color: GREY });
  };

  sigBlock(leftX, 'For the Customer', [`Clinic: ${q.clinic_name}`, 'Name: ______________________', 'Date: ______________________']);
  sigBlock(rightX, 'For the Supplier', [COMPANY.name, `Prepared by: ${q.issued_by_name}`, 'Date: ______________________']);

  d.y = top - 130;
  d.footer('Purchase Order');

  return pdf.save();
}
