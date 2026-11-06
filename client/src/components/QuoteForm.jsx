import { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { computePricing, rupees } from '../lib/format.js';
import { Field, Spinner, Modal, useToast } from './ui.jsx';

export const EMPTY_QUOTE_FORM = {
  clinicName: '',
  contactDoctor: '',
  numDoctors: '',
  city: '',
  mobile: '',
  email: '',
  address: '',
  gstin: '',
  apptsPerDay: '',
  doctorFee: '',
  validityDays: '15',
  specialNote: '',
};

// Turn a loaded quote (API shape) into the form shape.
export function quoteToForm(q) {
  return {
    clinicName: q.clinicName || '',
    contactDoctor: q.contactDoctor || '',
    numDoctors: q.numDoctors ?? '',
    city: q.city || '',
    mobile: q.mobile || '',
    email: q.email || '',
    address: q.address || '',
    gstin: q.gstin || '',
    apptsPerDay: q.apptsPerDay ?? '',
    doctorFee: q.doctorFee ?? '',
    validityDays: q.validityDays ?? '15',
    specialNote: q.specialNote || '',
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Shared quotation form: used both for creating a NEW quote (Quotation page)
 * and for editing an EXISTING one (popup from the Quotes list).
 *
 * Props:
 *  - editing: the original quote object when editing, or null when creating new.
 *  - settings: current pricing settings (object).
 *  - onSaved(quote): called after a successful create/update.
 *  - onCancel(): called when the user cancels (only shown when provided).
 *  - layout: 'page' (form + sticky summary side-by-side) or 'modal' (stacked, compact).
 */
export default function QuoteForm({ editing = null, settings, onSaved, onCancel, layout = 'page' }) {
  const { user } = useAuth();
  const toast = useToast();
  const isEdit = !!editing;

  const [form, setForm] = useState(() => (editing ? quoteToForm(editing) : EMPTY_QUOTE_FORM));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recalc, setRecalc] = useState(false);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  // Live pricing:
  //  - New quote, or edit with "recalculate": use current rules.
  //  - Edit keeping the frozen rate: show the frozen rate with recomputed monthly.
  const pricing = useMemo(() => {
    if (!settings) return null;
    if (isEdit && !recalc) {
      const frozen = Number(editing.rate) || 0;
      const days = Number(editing.settings?.days_per_month) || settings.days_per_month || 30;
      const gstPct = Number(editing.settings?.gst_pct) || settings.gst_pct || 0;
      const perDay = Math.max(0, Math.floor(Number(form.apptsPerDay) || 0));
      const apptsPerMonth = perDay * days;
      const monthlyEstimate = round2(apptsPerMonth * frozen);
      const gstAmount = round2((monthlyEstimate * gstPct) / 100);
      return {
        apptsPerDay: perDay,
        apptsPerMonth,
        rate: frozen,
        monthlyEstimate,
        gstAmount,
        monthlyTotal: round2(monthlyEstimate + gstAmount),
        gstPct,
        daysPerMonth: days,
        frozen: true,
        minRateApplied: false,
      };
    }
    return {
      ...computePricing(form.apptsPerDay, settings),
      gstPct: settings.gst_pct,
      daysPerMonth: settings.days_per_month,
      frozen: false,
    };
  }, [form.apptsPerDay, settings, isEdit, editing, recalc]);

  const validate = () => {
    const er = {};
    if (!form.clinicName.trim()) er.clinicName = 'Clinic name is required.';
    const apd = Number(form.apptsPerDay);
    if (!apd || apd < 1) er.apptsPerDay = 'Required — at least 1.';
    const vd = Number(form.validityDays);
    if (!vd || vd < 1) er.validityDays = 'Required — at least 1.';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) er.email = 'Enter a valid email.';
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  const requestSave = (e) => {
    e.preventDefault();
    if (!validate()) {
      toast?.error('Please fix the highlighted fields.');
      return;
    }
    setConfirmOpen(true);
  };

  const doSave = async () => {
    setSaving(true);
    try {
      let quote;
      if (isEdit) {
        ({ quote } = await api.put(`/quotes/${editing.id}`, { ...form, recalculate: recalc }));
        toast?.success(`Quotation ${quote.quoteNumber} updated.`);
      } else {
        ({ quote } = await api.post('/quotes', form));
        toast?.success(`Quotation ${quote.quoteNumber} saved.`);
      }
      setConfirmOpen(false);
      onSaved?.(quote);
      if (!isEdit) {
        setForm(EMPTY_QUOTE_FORM);
        setErrors({});
      }
    } catch (err) {
      toast?.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const clear = () => {
    setForm(EMPTY_QUOTE_FORM);
    setErrors({});
  };

  const isModal = layout === 'modal';

  return (
    <div className={isModal ? '' : 'grid gap-6 lg:grid-cols-3'}>
      <form onSubmit={requestSave} className={isModal ? '' : 'lg:col-span-2'}>
        <div className={isModal ? '' : 'card p-6'}>
          {isEdit && (
            <div className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-700/40 dark:text-slate-300">
              Editing keeps the same quote number. Issued by{' '}
              <span className="font-medium">{editing.issuedByName}</span>.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Clinic name" required error={errors.clinicName}>
                <input className="input" value={form.clinicName} onChange={set('clinicName')} autoFocus={isModal} />
              </Field>
            </div>
            <Field label="Contact doctor">
              <input className="input" value={form.contactDoctor} onChange={set('contactDoctor')} />
            </Field>
            <Field label="Number of doctors">
              <input type="number" min="0" className="input" value={form.numDoctors} onChange={set('numDoctors')} />
            </Field>
            <Field label="City">
              <input className="input" value={form.city} onChange={set('city')} />
            </Field>
            <Field label="Mobile">
              <input className="input" value={form.mobile} onChange={set('mobile')} />
            </Field>
            <Field label="Email" error={errors.email}>
              <input className="input" value={form.email} onChange={set('email')} />
            </Field>
            <Field label="GSTIN (optional)">
              <input className="input" value={form.gstin} onChange={set('gstin')} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address">
                <textarea rows="2" className="input" value={form.address} onChange={set('address')} />
              </Field>
            </div>
          </div>

          <hr className="my-5 border-slate-200 dark:border-slate-700" />
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">
            Commercials
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Appointments per day"
              required
              error={errors.apptsPerDay}
              hint="Committed volume. Drives the per-appointment rate."
            >
              <input type="number" min="1" className="input" value={form.apptsPerDay} onChange={set('apptsPerDay')} />
            </Field>
            <Field label="Doctor's fee per appointment (optional)" hint="Captured for reference; does not change the rate.">
              <input type="number" min="0" className="input" value={form.doctorFee} onChange={set('doctorFee')} />
            </Field>
            <Field label="Quotation validity (days)" required error={errors.validityDays}>
              <input type="number" min="1" className="input" value={form.validityDays} onChange={set('validityDays')} />
            </Field>
            <Field
              label="Rate per appointment"
              hint={
                isEdit && !recalc
                  ? 'Frozen at the original rate. Tick below to recalculate.'
                  : 'Calculated automatically — not editable.'
              }
            >
              <input className="input" value={pricing ? rupees(pricing.rate) : '-'} disabled readOnly />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Special note">
                <textarea rows="2" className="input" value={form.specialNote} onChange={set('specialNote')} />
              </Field>
            </div>
          </div>

          {isEdit && (
            <div className="mt-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-teal-500"
                  checked={recalc}
                  onChange={(e) => setRecalc(e.target.checked)}
                />
                <span className="text-sm">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    Recalculate rate from current pricing rules
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                    Off: keeps the original rate of {rupees(editing.rate)}. On: recomputes the rate
                    using today’s rules (changes the price).
                  </span>
                </span>
              </label>
            </div>
          )}

          {/* Live summary, inline for the modal layout */}
          {isModal && (
            <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-700/30">
              <SummaryRows pricing={pricing} settings={settings} isEdit={isEdit} />
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={saving}>
              {isEdit ? 'Update quotation' : 'Save quotation'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={isEdit ? onCancel : clear}
              disabled={saving}
            >
              {isEdit ? 'Cancel' : 'Clear'}
            </button>
            {!isModal && (
              <span className="ml-auto text-xs text-slate-400">
                Prepared by{' '}
                <span className="font-medium text-slate-500 dark:text-slate-300">
                  {isEdit ? editing.issuedByName : user.name}
                </span>
              </span>
            )}
          </div>
        </div>
      </form>

      {/* Sticky summary panel for the page layout only */}
      {!isModal && (
        <div className="lg:col-span-1">
          <div className="card sticky top-28 overflow-hidden">
            <div className="bg-gradient-to-br from-teal-500 to-teal-600 px-5 py-4 text-white">
              <p className="text-xs font-medium uppercase tracking-wide opacity-80">Estimated monthly billing</p>
              <p className="mt-1 text-3xl font-bold">{pricing ? rupees(pricing.monthlyTotal) : '—'}</p>
              <p className="text-xs opacity-80">incl. GST @ {pricing?.gstPct ?? settings.gst_pct}%</p>
            </div>
            <div className="space-y-3 p-5 text-sm">
              <SummaryRows pricing={pricing} settings={settings} isEdit={isEdit} detailed />
            </div>
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      <Modal
        open={confirmOpen}
        onClose={() => !saving && setConfirmOpen(false)}
        title={isEdit ? 'Update this quotation?' : 'Save this quotation?'}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>
              Go back
            </button>
            <button className="btn-primary" onClick={doSave} disabled={saving}>
              {saving ? <Spinner /> : isEdit ? 'Yes, update' : 'Yes, save'}
            </button>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          <ConfirmRow label="Clinic" value={form.clinicName} />
          <ConfirmRow label="Appointments / day" value={form.apptsPerDay} />
          <ConfirmRow label="Rate / appointment" value={pricing ? rupees(pricing.rate) : '-'} />
          <ConfirmRow label="Est. monthly (incl. GST)" value={pricing ? rupees(pricing.monthlyTotal) : '-'} />
          <ConfirmRow label="Validity" value={`${form.validityDays} day(s)`} />
          {isEdit && (
            <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-700/40 dark:text-slate-300">
              {recalc
                ? 'The rate will be recalculated from current pricing rules.'
                : `The original rate of ${rupees(editing.rate)} will be kept.`}{' '}
              Quote number {editing.quoteNumber} stays the same.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}

function SummaryRows({ pricing, settings, detailed }) {
  return (
    <>
      <Row label="Appointments / day" value={pricing?.apptsPerDay || '—'} />
      <Row label={`Appointments / month (×${pricing?.daysPerMonth ?? settings.days_per_month})`} value={pricing?.apptsPerMonth || '—'} />
      <Row
        label={`Rate per appointment${pricing?.frozen ? ' (frozen)' : ''}`}
        value={pricing ? rupees(pricing.rate) : '—'}
        accent
      />
      {pricing?.minRateApplied && (
        <p className="rounded-md bg-orange-50 px-2 py-1 text-xs text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
          Minimum rate of {rupees(settings.min_rate)} applied.
        </p>
      )}
      {detailed && <hr className="border-slate-200 dark:border-slate-700" />}
      <Row label="Monthly estimate (pre-GST)" value={pricing ? rupees(pricing.monthlyEstimate) : '—'} />
      <Row label={`GST @ ${pricing?.gstPct ?? settings.gst_pct}%`} value={pricing ? rupees(pricing.gstAmount) : '—'} />
      <Row label="Monthly total" value={pricing ? rupees(pricing.monthlyTotal) : '—'} accent strong />
      {detailed && (
        <p className="pt-1 text-xs text-slate-400">
          No monthly minimum — the bill is appointments × rate. This is an estimate.
        </p>
      )}
    </>
  );
}

function Row({ label, value, accent, strong }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`font-semibold ${accent ? 'text-orange-500' : 'text-slate-700 dark:text-slate-100'} ${strong ? 'text-base' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function ConfirmRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-slate-700 dark:text-slate-100">{value || '-'}</span>
    </div>
  );
}
