// Shared formatting + client-side pricing mirror (for instant preview).
// The server re-computes and freezes the real numbers on save, so this is
// purely for a responsive UI.

export function rupees(n) {
  const v = Number(n || 0);
  return 'Rs. ' + v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function fmtDateTime(s) {
  if (!s) return '-';
  // SQLite stores UTC "YYYY-MM-DD HH:MM:SS"; make it a real Date.
  const d = new Date(s.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return s;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtDate(s) {
  if (!s) return '-';
  const d = new Date(String(s).replace(' ', 'T') + 'Z');
  if (isNaN(d)) return s;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Mirror of server/src/lib/pricing.js — keep in sync.
export function computePricing(apptsPerDay, settings) {
  const s = settings || {};
  const perDay = Math.max(0, Math.floor(Number(apptsPerDay) || 0));
  const daysPerMonth = Number(s.days_per_month) || 30;
  const target = Number(s.monthly_revenue_target) || 0;
  const minRate = Number(s.min_rate) || 0;
  const gstPct = Number(s.gst_pct) || 0;

  const apptsPerMonth = perDay * daysPerMonth;
  let rawRate = apptsPerMonth > 0 ? Math.round(target / apptsPerMonth) : 0;
  let rate = Math.max(rawRate, minRate);

  const monthlyEstimate = apptsPerMonth * rate;
  const gstAmount = round2((monthlyEstimate * gstPct) / 100);
  const monthlyTotal = round2(monthlyEstimate + gstAmount);

  return {
    apptsPerDay: perDay,
    apptsPerMonth,
    rate,
    monthlyEstimate: round2(monthlyEstimate),
    gstAmount,
    monthlyTotal,
    gstPct,
    minRateApplied: apptsPerMonth > 0 && rawRate < minRate,
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
