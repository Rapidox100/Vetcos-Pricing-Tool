import { verifyToken, getUserById } from './auth.js';

const TOKEN_COOKIE = 'vetcos_token';

/**
 * Populate req.user from the session token (cookie or Authorization header).
 * Rejects if missing/invalid, if the user no longer exists, or is deactivated.
 * This is the server-side gate — the frontend hiding screens is never trusted.
 */
export function requireAuth(req, res, next) {
  const token =
    req.cookies?.[TOKEN_COOKIE] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) return res.status(401).json({ error: 'Not signed in.' });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Session expired. Please sign in again.' });

  const user = getUserById(payload.uid);
  if (!user) return res.status(401).json({ error: 'Account not found.' });
  if (!user.active) return res.status(403).json({ error: 'Account is deactivated.' });

  req.user = user;
  next();
}

/** Restrict a route to admins. Must run after requireAuth. */
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

export { TOKEN_COOKIE };
