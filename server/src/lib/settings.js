import db, { DEFAULT_SETTINGS } from './db.js';

// Numeric keys are stored as text in SQLite; coerce back to numbers on read.
const getStmt = db.prepare('SELECT key, value FROM settings');
const setStmt = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);

export function getSettings() {
  const rows = getStmt.all();
  const out = {};
  for (const { key, value } of rows) {
    out[key] = Number(value);
  }
  // Ensure any newly added default is present even on an old database.
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    if (out[k] === undefined) out[k] = v;
  }
  return out;
}

export function setSetting(key, value) {
  setStmt.run(key, String(value));
}

// Validation rules for each editable setting. Returns null if valid, else a message.
export function validateSetting(key, value) {
  if (!(key in DEFAULT_SETTINGS)) return `Unknown setting: ${key}`;
  const n = Number(value);
  if (!Number.isFinite(n)) return `${key} must be a number`;
  if (n < 0) return `${key} cannot be negative`;
  if (key === 'days_per_month' && (n < 1 || n > 31)) return 'days_per_month must be 1-31';
  if (key === 'gst_pct' && n > 100) return 'gst_pct must be 0-100';
  if (key === 'escalation_pct' && n > 100) return 'escalation_pct must be 0-100';
  if (key === 'min_rate' && n < 1) return 'min_rate must be at least 1';
  return null;
}
