import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { Field, Spinner } from '../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card w-full max-w-sm p-8">
      <h1 className="mb-1 text-xl font-bold text-slate-800 dark:text-slate-100">Sign in</h1>
      <p className="mb-6 text-sm text-slate-500">Welcome to the Vetcos Quote Tool.</p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Username">
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        )}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? <Spinner /> : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
