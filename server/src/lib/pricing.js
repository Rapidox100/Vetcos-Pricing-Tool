/**
 * Vetcos pricing engine.
 *
 * Business rules (v1):
 *  - appointments/month = appointments/day * days_per_month (admin setting)
 *  - rate per appointment = round(monthly_revenue_target / appts_per_month),
 *    but never below min_rate.
 *  - There is NO monthly minimum charge. The bill is appointments * rate.
 *    The revenue target only decides the rate.
 *  - monthly estimate = appts_per_month * rate (pre-GST)
 *  - GST is added on top at gst_pct.
 *  - doctor_fee is captured and shown but DOES NOT affect the rate in v1
 *    (OPEN ITEM pending management decision).
 *
 * @param {object} input
 * @param {number} input.apptsPerDay   - committed appointments per day (required, >=1)
 * @param {object} settings            - pricing settings (see settings.js)
 * @returns {object} computed pricing snapshot
 */
export function computePricing(input, settings) {
  const apptsPerDay = Math.max(0, Math.floor(Number(input.apptsPerDay) || 0));
  const daysPerMonth = Number(settings.days_per_month) || 30;
  const target = Number(settings.monthly_revenue_target) || 0;
  const minRate = Number(settings.min_rate) || 0;
  const gstPct = Number(settings.gst_pct) || 0;

  const apptsPerMonth = apptsPerDay * daysPerMonth;

  let rate = 0;
  if (apptsPerMonth > 0) {
    rate = Math.round(target / apptsPerMonth);
  }
  // Floor at the minimum rate (also covers the zero-appointment edge case).
  if (rate < minRate) rate = minRate;

  const monthlyEstimate = apptsPerMonth * rate;
  const gstAmount = round2((monthlyEstimate * gstPct) / 100);
  const monthlyTotal = round2(monthlyEstimate + gstAmount);

  return {
    apptsPerDay,
    apptsPerMonth,
    rate,
    monthlyEstimate: round2(monthlyEstimate),
    gstAmount,
    monthlyTotal,
    gstPct,
    daysPerMonth,
    minRateApplied: apptsPerMonth > 0 && Math.round(target / apptsPerMonth) < minRate,
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
