import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { fmtDateTime } from '../lib/format.js';
import { Spinner, useToast } from '../components/ui.jsx';

// Friendly labels + colours for action codes.
const ACTION_META = {
  SIGN_IN: ['Signed in', 'teal'],
  SIGN_IN_FAILED: ['Failed sign-in', 'red'],
  SIGN_OUT: ['Signed out', 'slate'],
  FIRST_ADMIN_CREATED: ['First admin created', 'orange'],
  QUOTE_SAVED: ['Quotation saved', 'teal'],
  QUOTE_EDITED: ['Quotation edited', 'orange'],
  QUOTATION_DOWNLOADED: ['Quotation PDF', 'slate'],
  PO_DOWNLOADED: ['Purchase order PDF', 'slate'],
  PASSWORD_CHANGED: ['Password changed', 'orange'],
  PASSWORD_RESET: ['Password reset', 'orange'],
  RULE_CHANGED: ['Pricing rule changed', 'orange'],
  USER_CREATED: ['User created', 'teal'],
  USER_ENABLED: ['User switched on', 'teal'],
  USER_DISABLED: ['User switched off', 'red'],
  USER_DELETED: ['User deleted', 'red'],
};

const COLOR = {
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

export default function ActivityLog() {
  const toast = useToast();
  const [entries, setEntries] = useState(null);
  const [actions, setActions] = useState([]);
  const [filter, setFilter] = useState('');

  const load = (action) => {
    const qs = action ? `?action=${encodeURIComponent(action)}&limit=500` : '?limit=500';
    api
      .get('/activity' + qs)
      .then(({ entries }) => setEntries(entries))
      .catch((e) => toast?.error(e.message));
  };

  useEffect(() => {
    load('');
    api.get('/activity/actions').then(({ actions }) => setActions(actions)).catch(() => {});
  }, []); // eslint-disable-line

  const onFilter = (e) => {
    setFilter(e.target.value);
    setEntries(null);
    load(e.target.value);
  };

  const describeDetails = (e) => {
    if (!e.details) return null;
    if (e.action === 'RULE_CHANGED') return `${e.details.old} → ${e.details.new}`;
    if (e.action === 'QUOTE_SAVED')
      return `${e.details.clinic} · ${e.details.apptsPerDay}/day · Rs.${e.details.rate}/appt`;
    if (e.action === 'USER_CREATED') return `${e.details.role}`;
    if (e.action === 'SIGN_IN_FAILED') return `attempt ${e.details.attempts}`;
    if (e.action === 'QUOTE_EDITED') {
      const ch = e.details.changes || {};
      const parts = Object.entries(ch).map(([k, v]) => `${k}: ${v.old}→${v.new}`);
      const prefix = e.details.recalculated ? 'rate recalculated' : 'rate kept';
      return parts.length ? `${prefix} · ${parts.join(', ')}` : prefix;
    }
    return null;
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Activity Log</h2>
        <select className="input max-w-xs" value={filter} onChange={onFilter}>
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {ACTION_META[a]?.[0] || a}
            </option>
          ))}
        </select>
      </div>

      {!entries ? (
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8 text-teal-500" />
        </div>
      ) : entries.length === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-400">No activity recorded.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900/40">
              <tr>
                <th className="th">When</th>
                <th className="th">Who</th>
                <th className="th">Action</th>
                <th className="th">Target</th>
                <th className="th">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {entries.map((e) => {
                const [label, color] = ACTION_META[e.action] || [e.action, 'slate'];
                return (
                  <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="td whitespace-nowrap text-slate-400">{fmtDateTime(e.at)}</td>
                    <td className="td">{e.actorName || '—'}</td>
                    <td className="td">
                      <span className={`badge ${COLOR[color]}`}>{label}</span>
                    </td>
                    <td className="td">{e.target || '—'}</td>
                    <td className="td text-slate-500 dark:text-slate-400">{describeDetails(e) || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
