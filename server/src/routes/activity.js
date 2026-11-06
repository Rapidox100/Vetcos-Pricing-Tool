import { Router } from 'express';
import db from '../lib/db.js';
import { requireAuth, requireAdmin } from '../lib/middleware.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// GET /api/activity?limit=200&action=... — admin-only activity log.
router.get('/', (req, res) => {
  const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 300));
  const action = req.query.action?.trim();

  let rows;
  if (action) {
    rows = db
      .prepare('SELECT * FROM activity_log WHERE action = ? ORDER BY id DESC LIMIT ?')
      .all(action, limit);
  } else {
    rows = db.prepare('SELECT * FROM activity_log ORDER BY id DESC LIMIT ?').all(limit);
  }

  const entries = rows.map((r) => ({
    id: r.id,
    at: r.at,
    actorId: r.actor_id,
    actorName: r.actor_name,
    action: r.action,
    target: r.target,
    details: r.details ? JSON.parse(r.details) : null,
  }));
  res.json({ entries });
});

// GET /api/activity/actions — distinct action types, for the filter dropdown.
router.get('/actions', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT action FROM activity_log ORDER BY action').all();
  res.json({ actions: rows.map((r) => r.action) });
});

export default router;
