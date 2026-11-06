import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'vetcos.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema. Created once; IF NOT EXISTS keeps this idempotent across restarts.
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  username        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash   TEXT    NOT NULL,
  role            TEXT    NOT NULL CHECK (role IN ('admin','sales')),
  active          INTEGER NOT NULL DEFAULT 1,
  must_change_pw  INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    INTEGER,                    -- epoch ms; sign-in blocked until then
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  created_by      INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quotes (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_number         TEXT    NOT NULL UNIQUE,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  issued_by            INTEGER NOT NULL REFERENCES users(id),
  issued_by_name       TEXT    NOT NULL,       -- snapshot of preparer name
  status               TEXT    NOT NULL DEFAULT 'issued',

  -- customer
  clinic_name          TEXT    NOT NULL,
  contact_doctor       TEXT,
  num_doctors          INTEGER,
  city                 TEXT,
  mobile               TEXT,
  email                TEXT,
  address              TEXT,
  gstin                TEXT,

  -- commercial inputs
  appts_per_day        INTEGER NOT NULL,
  doctor_fee           REAL,                   -- captured, does not affect rate (v1)
  validity_days        INTEGER NOT NULL,
  special_note         TEXT,

  -- computed snapshot (frozen at issue time)
  appts_per_month      INTEGER NOT NULL,
  rate                 REAL    NOT NULL,
  monthly_estimate     REAL    NOT NULL,       -- appts_per_month * rate (pre-GST)
  gst_amount           REAL    NOT NULL,
  monthly_total        REAL    NOT NULL,       -- monthly_estimate + gst_amount
  settings_snapshot    TEXT    NOT NULL        -- JSON of pricing settings used
);

CREATE TABLE IF NOT EXISTS activity_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT    NOT NULL DEFAULT (datetime('now')),
  actor_id    INTEGER REFERENCES users(id),
  actor_name  TEXT,
  action      TEXT    NOT NULL,                -- e.g. SIGN_IN, QUOTE_SAVED, RULE_CHANGED
  target      TEXT,                            -- affected entity (username, quote no, key)
  details     TEXT                             -- JSON with old/new values or context
);

CREATE INDEX IF NOT EXISTS idx_quotes_issued_by ON quotes(issued_by);
CREATE INDEX IF NOT EXISTS idx_log_at ON activity_log(at);
`);

// ---------------------------------------------------------------------------
// Default pricing / business settings. Only inserted if missing, so admin
// edits are never overwritten on restart.
// ---------------------------------------------------------------------------
export const DEFAULT_SETTINGS = {
  monthly_revenue_target: 6500, // Rs. target that sets the rate
  max_package: 7500,            // Rs. ceiling package (gives list rate)
  min_rate: 15,                 // Rs. minimum per-appointment rate
  escalation_pct: 10,           // % escalation after year 1
  free_module_months: 12,       // early-bird free-module period
  gst_pct: 18,                  // GST %
  days_per_month: 30,           // appts/day -> appts/month multiplier
  rate_review_months: 3,        // rate review after N months if volume not met
};

const insertSetting = db.prepare(
  'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
);
for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
  insertSetting.run(key, String(value));
}

export default db;
