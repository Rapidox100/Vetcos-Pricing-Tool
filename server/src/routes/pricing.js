import { Router } from 'express';
import { getSettings, setSetting, validateSetting } from '../lib/settings.js';
import { computePricing } from '../lib/pricing.js';
import { logActivity } from '../lib/activity.js';
import { requireAuth, requireAdmin } from '../lib/middleware.js';

const router = Router();

// GET /api/pricing/settings — any signed-in user may read the rules
// (needed so the quotation screen can compute the rate live).
router.get('/settings', requireAuth, (req, res) => {
  res.json({ settings: getSettings() });
});

// PUT /api/pricing/settings — admin only. Logs each changed value old->new.
router.put('/settings', requireAuth, requireAdmin, (req, res) => {
  const incoming = req.body?.settings || {};
  const current = getSettings();
  const changes = [];

  // Validate everything first; apply nothing on any error.
  for (const [key, value] of Object.entries(incoming)) {
    const err = validateSetting(key, value);
    if (err) return res.status(400).json({ error: err });
  }

  for (const [key, value] of Object.entries(incoming)) {
    const newVal = Number(value);
    if (current[key] !== newVal) {
      changes.push({ key, old: current[key], new: newVal });
    }
  }

  for (const c of changes) {
    setSetting(c.key, c.new);
    logActivity({
      actorId: req.user.id,
      actorName: req.user.name,
      action: 'RULE_CHANGED',
      target: c.key,
      details: { old: c.old, new: c.new },
    });
  }

  res.json({ settings: getSettings(), changed: changes.length });
});

// POST /api/pricing/preview — compute a live quote preview (no save).
router.post('/preview', requireAuth, (req, res) => {
  const settings = getSettings();
  const result = computePricing({ apptsPerDay: req.body?.apptsPerDay }, settings);
  res.json({ pricing: result, settings });
});

export default router;
