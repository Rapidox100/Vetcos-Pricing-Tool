import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'vetcos-dev-insecure-secret-change-me';
const TOKEN_EXPIRY = process.env.TOKEN_EXPIRY || '12h';

export const LOCKOUT_THRESHOLD = 5;        // wrong attempts before lock
export const LOCKOUT_MS = 30 * 1000;       // 30 second lock
const BCRYPT_ROUNDS = 12;

if (!process.env.JWT_SECRET) {
  console.warn(
    '[vetcos] WARNING: JWT_SECRET is not set. Using an insecure default. ' +
      'Set JWT_SECRET in a .env file before production use.'
  );
}

// --- password hashing -------------------------------------------------------
export async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}
export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Password policy: at least 8 characters (per spec).
export function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  return null;
}

// --- tokens -----------------------------------------------------------------
export function signToken(user) {
  return jwt.sign(
    { uid: user.id, role: user.role, name: user.name, username: user.username },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// --- user lookups -----------------------------------------------------------
const byUsername = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE');
const byId = db.prepare('SELECT * FROM users WHERE id = ?');

export function getUserByUsername(username) {
  return byUsername.get(username);
}
export function getUserById(id) {
  return byId.get(id);
}

export function hasAnyUser() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  return row.n > 0;
}

export function countActiveAdmins(excludeId = null) {
  if (excludeId == null) {
    return db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND active=1").get().n;
  }
  return db
    .prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND active=1 AND id != ?")
    .get(excludeId).n;
}

// --- lockout bookkeeping ----------------------------------------------------
const setLock = db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?');

export function registerFailedAttempt(user) {
  const attempts = (user.failed_attempts || 0) + 1;
  let lockedUntil = null;
  if (attempts >= LOCKOUT_THRESHOLD) {
    lockedUntil = Date.now() + LOCKOUT_MS;
  }
  setLock.run(attempts, lockedUntil, user.id);
  return { attempts, lockedUntil };
}

export function clearFailedAttempts(userId) {
  setLock.run(0, null, userId);
}

export function isLocked(user) {
  if (user.locked_until && user.locked_until > Date.now()) {
    return Math.ceil((user.locked_until - Date.now()) / 1000); // seconds remaining
  }
  return 0;
}
