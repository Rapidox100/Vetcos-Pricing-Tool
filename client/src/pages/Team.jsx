import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { fmtDate } from '../lib/format.js';
import { Field, Spinner, Modal, RoleBadge, StatusBadge, useToast } from '../components/ui.jsx';

export default function Team() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [resetFor, setResetFor] = useState(null); // user being reset
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = () =>
    api
      .get('/users')
      .then(({ users }) => setUsers(users))
      .catch((e) => toast?.error(e.message));

  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  const toggleActive = async (u) => {
    try {
      await api.patch(`/users/${u.id}/active`, { active: !u.active });
      toast?.success(`${u.name} ${u.active ? 'switched off' : 'switched on'}.`);
      load();
    } catch (e) {
      toast?.error(e.message);
    }
  };

  const doDelete = async (u) => {
    try {
      await api.del(`/users/${u.id}`);
      toast?.success(`${u.name} deleted.`);
      setConfirmDelete(null);
      load();
    } catch (e) {
      toast?.error(e.message);
    }
  };

  if (!users) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8 text-teal-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Team</h2>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          + Add user
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-900/40">
            <tr>
              <th className="th">Name</th>
              <th className="th">Username</th>
              <th className="th">Role</th>
              <th className="th">Status</th>
              <th className="th">Added</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="td font-medium">
                  {u.name}
                  {u.id === me.id && <span className="ml-2 text-xs text-slate-400">(you)</span>}
                  {u.mustChangePw && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                      pending first login
                    </span>
                  )}
                </td>
                <td className="td">@{u.username}</td>
                <td className="td">
                  <RoleBadge role={u.role} />
                </td>
                <td className="td">
                  <StatusBadge active={u.active} />
                </td>
                <td className="td whitespace-nowrap text-slate-400">{fmtDate(u.createdAt)}</td>
                <td className="td">
                  <div className="flex justify-end gap-2">
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setResetFor(u)}>
                      Reset password
                    </button>
                    <button
                      className="btn-ghost px-2 py-1 text-xs"
                      onClick={() => toggleActive(u)}
                      disabled={u.id === me.id && u.active}
                      title={u.id === me.id && u.active ? 'You cannot switch yourself off' : ''}
                    >
                      {u.active ? 'Switch off' : 'Switch on'}
                    </button>
                    <button
                      className="btn-danger px-2 py-1 text-xs"
                      onClick={() => setConfirmDelete(u)}
                      disabled={u.id === me.id}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
      {resetFor && (
        <ResetPasswordModal
          user={resetFor}
          onClose={() => setResetFor(null)}
          onDone={() => {
            setResetFor(null);
            load();
          }}
        />
      )}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete user?"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button className="btn-danger" onClick={() => doDelete(confirmDelete)}>
              Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This permanently removes <strong>{confirmDelete?.name}</strong>. Users who have issued quotes
          cannot be deleted — switch them off instead to keep the history.
        </p>
      </Modal>
    </div>
  );
}

// --- Create user modal with Generate button --------------------------------
function CreateUserModal({ onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', username: '', role: 'sales', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const generate = async () => {
    try {
      const { password } = await api.post('/users/generate-password');
      setForm((f) => ({ ...f, password }));
    } catch (e) {
      toast?.error(e.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) return setError('Temporary password must be at least 8 characters.');
    setBusy(true);
    try {
      await api.post('/users', form);
      toast?.success(`User ${form.username} created.`);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add user">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" required>
          <input className="input" value={form.name} onChange={set('name')} autoFocus />
        </Field>
        <Field label="Username" required>
          <input className="input" value={form.username} onChange={set('username')} />
        </Field>
        <Field label="Role" required>
          <select className="input" value={form.role} onChange={set('role')}>
            <option value="sales">Sales</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <Field label="Temporary password" required hint="The user must change this at first sign-in.">
          <div className="flex gap-2">
            <input className="input" value={form.password} onChange={set('password')} />
            <button type="button" className="btn-ghost whitespace-nowrap" onClick={generate}>
              Generate
            </button>
          </div>
        </Field>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? <Spinner /> : 'Create user'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// --- Reset password modal ---------------------------------------------------
function ResetPasswordModal({ user, onClose, onDone }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    try {
      const { password } = await api.post('/users/generate-password');
      setPassword(password);
    } catch (e) {
      toast?.error(e.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    setBusy(true);
    try {
      await api.post(`/users/${user.id}/reset-password`, { password });
      toast?.success(`Password reset for ${user.name}. Share it securely; they must change it at next sign-in.`);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Reset password — ${user.name}`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="New temporary password" required>
          <div className="flex gap-2">
            <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            <button type="button" className="btn-ghost whitespace-nowrap" onClick={generate}>
              Generate
            </button>
          </div>
        </Field>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? <Spinner /> : 'Reset password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
