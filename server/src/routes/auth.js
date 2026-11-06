import { Router } from 'express';
import db from '../lib/db.js';
import {
  hashPassword,
  verifyPassword,
  validatePassword,
  signToken,
  getUserByUsername,
  hasAnyUser,
  registerFailedAttempt,
  clearFailedAttempts,
  isLocked,
  LOCKOUT_THRESHOLD,
} from '../lib/auth.js';
import { logActivity } from '../lib/activity.js';
import { requireAuth, TOKEN_COOKIE } from '../lib/middleware.js';

const router = Router();

// Render (and most hosts) terminate HTTPS at a proxy in front of the app and
// set NODE_ENV=production; the cookie should only require HTTPS in that case,
// not for plain local development on http://localhost.
const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 12 * 60 * 60 * 1000,
};

function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    active: !!u.active,
    mustChangePw: !!u.must_change_pw,
  };
}

// GET /api/auth/status — is the app initialised (does any user exist)?
router.get('/status', (req, res) => {
  res.json({ initialised: hasAnyUser() });
});

// POST /api/auth/setup — first-run: create the very first admin.
// Only works while NO users exist.
router.post('/setup', async (req, res) => {
  if (hasAnyUser()) {
    return res.status(409).json({ error: 'Application is already set up.' });
  }
  const { name, username, password } = req.body || {};
  if (!name?.trim() || !username?.trim()) {
    return res.status(400).json({ error: 'Name and username are required.' });
  }
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  const hash = await hashPassword(password);
  const info = db
    .prepare(
      `INSERT INTO users (name, username, password_hash, role, active, must_change_pw)
       VALUES (?, ?, ?, 'admin', 1, 0)`
    )
    .run(name.trim(), username.trim(), hash);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  logActivity({
    actorId: user.id,
    actorName: user.name,
    action: 'FIRST_ADMIN_CREATED',
    target: user.username,
  });

  const token = signToken(user);
  res.cookie(TOKEN_COOKIE, token, cookieOpts);
  res.json({ token, user: publicUser(user) });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = getUserByUsername(username);
  // Generic message on unknown user to avoid revealing which usernames exist.
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const lockSecs = isLocked(user);
  if (lockSecs > 0) {
    return res
      .status(429)
      .json({ error: `Too many attempts. Try again in ${lockSecs} seconds.`, lockedFor: lockSecs });
  }

  if (!user.active) {
    return res.status(403).json({ error: 'This account is deactivated. Contact an admin.' });
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    const { attempts, lockedUntil } = registerFailedAttempt(user);
    logActivity({
      actorId: user.id,
      actorName: user.username,
      action: 'SIGN_IN_FAILED',
      target: user.username,
      details: { attempts },
    });
    if (lockedUntil) {
      const secs = Math.ceil((lockedUntil - Date.now()) / 1000);
      return res
        .status(429)
        .json({ error: `Too many attempts. Try again in ${secs} seconds.`, lockedFor: secs });
    }
    const remaining = LOCKOUT_THRESHOLD - attempts;
    return res.status(401).json({
      error: `Invalid username or password.${remaining > 0 ? ` ${remaining} attempt(s) left.` : ''}`,
    });
  }

  // Success.
  clearFailedAttempts(user.id);
  logActivity({ actorId: user.id, actorName: user.name, action: 'SIGN_IN', target: user.username });

  const token = signToken(user);
  res.cookie(TOKEN_COOKIE, token, cookieOpts);
  res.json({ token, user: publicUser(user) });
});

// GET /api/auth/me — current session info.
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  logActivity({ actorId: req.user.id, actorName: req.user.name, action: 'SIGN_OUT', target: req.user.username });
  res.clearCookie(TOKEN_COOKIE);
  res.json({ ok: true });
});

// POST /api/auth/change-password — change own password.
// Used both for the forced first-login change and voluntary changes.
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = req.user;

  // If the account is NOT in must-change state, require the current password.
  if (!user.must_change_pw) {
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required.' });
    }
    const ok = await verifyPassword(currentPassword, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const pwErr = validatePassword(newPassword);
  if (pwErr) return res.status(400).json({ error: pwErr });

  // Disallow reusing the same password.
  if (await verifyPassword(newPassword, user.password_hash)) {
    return res.status(400).json({ error: 'New password must be different from the current one.' });
  }

  const hash = await hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ?, must_change_pw = 0 WHERE id = ?').run(hash, user.id);

  logActivity({
    actorId: user.id,
    actorName: user.name,
    action: 'PASSWORD_CHANGED',
    target: user.username,
  });

  // Re-issue token so updated claims (if any) are fresh.
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  const token = signToken(updated);
  res.cookie(TOKEN_COOKIE, token, cookieOpts);
  res.json({ ok: true, user: publicUser(updated), token });
});

export default router;
