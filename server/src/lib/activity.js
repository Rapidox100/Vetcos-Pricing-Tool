import db from './db.js';

const insert = db.prepare(
  `INSERT INTO activity_log (actor_id, actor_name, action, target, details)
   VALUES (@actor_id, @actor_name, @action, @target, @details)`
);

/**
 * Record an entry in the admin-only activity log.
 * @param {object} e
 * @param {number|null} e.actorId    - user id performing the action (null if unknown, e.g. failed login)
 * @param {string|null} e.actorName  - snapshot of actor name/username
 * @param {string} e.action          - action code, e.g. SIGN_IN, QUOTE_SAVED
 * @param {string} [e.target]        - affected entity (username, quote number, setting key)
 * @param {object} [e.details]       - structured context (old/new values, etc.)
 */
export function logActivity({ actorId = null, actorName = null, action, target = null, details = null }) {
  insert.run({
    actor_id: actorId,
    actor_name: actorName,
    action,
    target,
    details: details ? JSON.stringify(details) : null,
  });
}
