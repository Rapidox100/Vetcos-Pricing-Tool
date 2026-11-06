import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { Field, Spinner } from '../components/ui.jsx';

export default function FirstRun() {
  const { setup } = useAuth();
  const [form, setForm] = useState({ name: '', username: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await setup(form.name.trim(), form.username.trim(), form.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card w-full max-w-md p-8">
      <h1 className="mb-1 text-xl font-bold text-slate-800 dark:text-slate-100">Welcome — set up your admin</h1>
      <p className="mb-6 text-sm text-slate-500">
        This is the first time the tool is being used. Create the first administrator account to get started.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" required>
          <input className="input" value={form.name} onChange={set('name')} autoFocus />
        </Field>
        <Field label="Username" required>
          <input className="input" value={form.username} onChange={set('username')} autoComplete="username" />
        </Field>
        <Field label="Password" required hint="At least 8 characters.">
          <input
            type="password"
            className="input"
            value={form.password}
            onChange={set('password')}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm password" required>
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
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? <Spinner /> : 'Create admin & continue'}
        </button>
      </form>
    </div>
  );
}
