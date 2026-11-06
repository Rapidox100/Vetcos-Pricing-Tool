import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { Field, Spinner, useToast } from '../components/ui.jsx';

/**
 * Change-password screen. Serves two cases:
 *  - forced=true: shown full-screen right after first login / reset. No current
 *    password required (server knows must_change_pw).
 *  - forced=false: voluntary change from the account menu; current password required.
 */
export default function ChangePassword({ forced = false }) {
  const { user, applyUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.next.length < 8) return setError('New password must be at least 8 characters.');
    if (form.next !== form.confirm) return setError('New passwords do not match.');
    setBusy(true);
    try {
      const body = { newPassword: form.next };
      if (!forced) body.currentPassword = form.current;
      const { user: updated } = await api.post('/auth/change-password', body);
      applyUser(updated);
      if (forced) {
        toast?.success('Password set. Welcome!');
      } else {
        toast?.success('Password changed.');
        navigate('/quotation');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // The inner card content. Kept as a variable (not a nested component) so that
  // re-renders on each keystroke do NOT remount the inputs and steal focus.
  const content = (
    <>
      <h1 className="mb-1 text-xl font-bold text-slate-800 dark:text-slate-100">
        {forced ? 'Choose a new password' : 'Change password'}
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        {forced
          ? `Hi ${user?.name}, please set your own password before continuing.`
          : 'Update the password for your account.'}
      </p>
      <form onSubmit={submit} className="space-y-4">
        {!forced && (
          <Field label="Current password" required>
            <input
              type="password"
              className="input"
              value={form.current}
              onChange={set('current')}
              autoComplete="current-password"
            />
          </Field>
        )}
        <Field label="New password" required hint="At least 8 characters.">
          <input
            type="password"
            className="input"
            value={form.next}
            onChange={set('next')}
            autoComplete="new-password"
            autoFocus={forced}
          />
        </Field>
        <Field label="Confirm new password" required>
          <input
            type="password"
            className="input"
            value={form.confirm}
            onChange={set('confirm')}
            autoComplete="new-password"
          />
        </Field>
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1" disabled={busy}>
            {busy ? <Spinner /> : forced ? 'Set password' : 'Change password'}
          </button>
          {forced && (
            <button type="button" className="btn-ghost" onClick={logout}>
              Sign out
            </button>
          )}
        </div>
      </form>
    </>
  );

  // Render the content inside the correct wrapper for each mode. These are plain
  // elements (stable across renders), so focus is preserved while typing.
  return forced ? (
    <div className="card w-full max-w-md p-8">{content}</div>
  ) : (
    <div className="mx-auto max-w-md">
      <div className="card p-8">{content}</div>
    </div>
  );
}
