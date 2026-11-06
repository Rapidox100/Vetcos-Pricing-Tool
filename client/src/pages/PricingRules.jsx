import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { computePricing, rupees } from '../lib/format.js';
import { Field, Spinner, useToast } from '../components/ui.jsx';

// Field metadata: label, suffix, and a short description for each setting.
const FIELDS = [
  { key: 'monthly_revenue_target', label: 'Monthly revenue target', suffix: 'Rs.', help: 'Divided by monthly appointments to set the rate.' },
  { key: 'max_package', label: 'Maximum package', suffix: 'Rs.', help: 'Ceiling package that gives the list rate.' },
  { key: 'min_rate', label: 'Minimum rate', suffix: 'Rs./appt', help: 'The rate never goes below this.' },
  { key: 'escalation_pct', label: 'Escalation after year 1', suffix: '%', help: 'Applied after the first year.' },
  { key: 'free_module_months', label: 'Free-module period', suffix: 'months', help: 'Early-bird: new standard modules free for this long.' },
  { key: 'gst_pct', label: 'GST', suffix: '%', help: 'Added on top of the monthly estimate.' },
  { key: 'days_per_month', label: 'Days per month', suffix: 'days', help: 'Appointments/day × this = appointments/month.' },
  { key: 'rate_review_months', label: 'Rate review after', suffix: 'months', help: 'Review if committed volume is not met.' },
];

export default function PricingRules() {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/pricing/settings')
      .then(({ settings }) => {
        setSettings(settings);
        setDraft({ ...settings });
      })
      .catch((e) => toast?.error(e.message));
  }, []); // eslint-disable-line

  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  const dirty = settings && draft && FIELDS.some((f) => Number(draft[f.key]) !== Number(settings[f.key]));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {};
      for (const f of FIELDS) payload[f.key] = Number(draft[f.key]);
      const { settings: updated, changed } = await api.put('/pricing/settings', { settings: payload });
      setSettings(updated);
      setDraft({ ...updated });
      toast?.success(changed ? `${changed} rule(s) updated.` : 'No changes.');
    } catch (e) {
      toast?.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!draft) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8 text-teal-500" />
      </div>
    );
  }

  // Live example using the draft values (10 appts/day, like the spec example).
  const example = computePricing(10, draft);
  const example15 = computePricing(15, draft);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="card p-6">
          <h2 className="mb-1 text-lg font-bold text-slate-800 dark:text-slate-100">Pricing Rules</h2>
          <p className="mb-5 text-sm text-slate-500">
            These settings drive every new quotation. Changes are logged. Existing quotes keep the
            rates they were issued with.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <Field key={f.key} label={f.label} hint={f.help}>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="input"
                    value={draft[f.key]}
                    onChange={set(f.key)}
                  />
                  <span className="whitespace-nowrap text-xs text-slate-400">{f.suffix}</span>
                </div>
              </Field>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button className="btn-primary" onClick={save} disabled={!dirty || saving}>
              {saving ? <Spinner /> : 'Save changes'}
            </button>
            <button
              className="btn-ghost"
              onClick={() => setDraft({ ...settings })}
              disabled={!dirty || saving}
            >
              Discard
            </button>
            {dirty && <span className="text-xs text-orange-500">Unsaved changes</span>}
          </div>
        </div>
      </div>

      <div className="lg:col-span-1">
        <div className="card sticky top-28 p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">
            Live example
          </h3>
          <Example title="10 appointments / day" p={example} days={draft.days_per_month} />
          <hr className="my-4 border-slate-200 dark:border-slate-700" />
          <Example title="15 appointments / day" p={example15} days={draft.days_per_month} />
          <p className="mt-3 text-xs text-slate-400">
            Preview uses the draft values above (not yet saved).
          </p>
        </div>
      </div>
    </div>
  );
}

function Example({ title, p, days }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      <dl className="space-y-1 text-sm">
        <Line label={`Appts / month (×${days})`} value={p.apptsPerMonth} />
        <Line label="Rate / appointment" value={rupees(p.rate)} accent />
        {p.minRateApplied && <p className="text-xs text-orange-500">Minimum rate applied.</p>}
        <Line label="Monthly total (incl. GST)" value={rupees(p.monthlyTotal)} />
      </dl>
    </div>
  );
}
function Line({ label, value, accent }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`font-semibold ${accent ? 'text-orange-500' : 'text-slate-700 dark:text-slate-100'}`}>{value}</dd>
    </div>
  );
}
