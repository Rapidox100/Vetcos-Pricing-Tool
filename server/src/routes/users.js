import { Router } from 'express';
import crypto from 'crypto';
import db from '../lib/db.js';
import { hashPassword, validatePassword, countActiveAdmins, getUserByUsername } from '../lib/auth.js';
import { logActivity } from '../lib/activity.js';
import { requireAuth, requireAdmin } from '../lib/middleware.js';

const router = Router();
router.use(requireAuth, requireAdmin);

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    active: !!u.active,
    mustChangePw: !!u.must_change_pw,
    createdAt: u.created_at,
  };
}

// Generate a readable temporary password (letters+digits, no ambiguous chars).
function genTempPassword(len = 12) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

// GET /api/users — list all users.
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY role DESC, name COLLATE NOCASE').all();
  res.json({ users: rows.map(publicUser) });
});

// POST /api/users/generate-password — helper for the "Generate" button.
router.post('/generate-password', (req, res) => {
  res.json({ password: genTempPassword() });
});

// POST /api/users — create a user with a temporary password.
router.post('/', async (req, res) => {
  const { name, username, role, password } = req.body || {};
  if (!name?.trim() || !username?.trim()) {
    return res.status(400).json({ error: 'Name and username are required.' });
  }
  if (role !== 'admin' && role !== 'sales') {
    return res.status(400).json({ error: 'Role must be admin or sales.' });
  }
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  if (getUserByUsername(username.trim())) {
    return res.status(409).json({ error: 'That username is already taken.' });
  }

  const hash = await hashPassword(password);
  const info = db
    .prepare(
      `INSERT INTO users (name, username, password_hash, role, active, must_change_pw, created_by)
       VALUES (?, ?, ?, ?, 1, 1, ?)`
    )
    .run(name.trim(), username.trim(), hash, role, req.user.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  logActivity({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'USER_CREATED',
    target: user.username,
    details: { role: user.role, name: user.name },
  });
  res.status(201).json({ user: publicUser(user) });
});

// POST /api/users/:id/reset-password — set a new temporary password.
router.post('/:id/reset-password', async (req, res) => {
  const id = Number(req.params.id);
  const { password } = req.body || {};
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'User not found.' });

  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  const hash = await hashPassword(password);
  db.prepare('UPDATE users SET password_hash = ?, must_change_pw = 1, failed_attempts = 0, locked_until = NULL WHERE id = ?').run(
    hash,
    id
  );
  logActivity({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'PASSWORD_RESET',
    target: target.username,
  });
  res.json({ ok: true });
});

// PATCH /api/users/:id/active — switch a user on/off.
router.patch('/:id/active', (req, res) => {
  const id = Number(req.params.id);
  const { active } = req.body || {};
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'User not found.' });

  const makeInactive = !active;
  // Guard: never leave zero active admins.
  if (makeInactive && target.role === 'admin' && target.active) {
    if (countActiveAdmins(id) === 0) {
      return res.status(400).json({ error: 'At least one active admin must remain.' });
    }
  }

  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
  logActivity({
    actorId: req.user.id,
    actorName: req.user.name,
    action: active ? 'USER_ENABLED' : 'USER_DISABLED',
    target: target.username,
  });
  res.json({ ok: true });
});

// DELETE /api/users/:id — remove a user.
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!target) return res.status(404).json({ error: 'User not found.' });

  if (id === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }
  // Guard: never delete the last active admin.
  if (target.role === 'admin' && target.active && countActiveAdmins(id) === 0) {
    return res.status(400).json({ error: 'At least one active admin must remain.' });
  }

  // Quotes reference the user; keep the quotes but detach is not allowed by FK.
  // Instead we block deletion if the user has issued quotes, to preserve history.
  const quoteCount = db.prepare('SELECT COUNT(*) AS n FROM quotes WHERE issued_by = ?').get(id).n;
  if (quoteCount > 0) {
    return res
      .status(400)
      .json({ error: `This user has issued ${quoteCount} quote(s). Switch them off instead of deleting to preserve history.` });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  logActivity({
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'USER_DELETED',
    target: target.username,
  });
  res.json({ ok: true });
});

export default router;
