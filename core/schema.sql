-- Fraxillion SQLite Database Schema
-- All tables follow the specification in section 14.2 of the build plan.

-- 1. Alerts table (stores ingested and validated alert signals)
CREATE TABLE IF NOT EXISTS alerts (
  alert_id TEXT PRIMARY KEY,
  txn_id TEXT,
  account_id TEXT,
  device_id TEXT,
  to_vpa TEXT,
  rule TEXT,
  severity TEXT,
  score REAL,
  reason TEXT,
  ts TEXT,
  is_fraud INTEGER DEFAULT 0,
  dedupe_key TEXT UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 2. Transactions table (stores financial transactions)
CREATE TABLE IF NOT EXISTS transactions (
  txn_id TEXT PRIMARY KEY,
  ts TEXT,
  from_account TEXT,
  to_account TEXT,
  to_vpa TEXT,
  amount REAL,
  channel TEXT,
  device_id TEXT,
  city TEXT,
  is_fraud INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 3. Cases table (stores grouped investigation cases)
CREATE TABLE IF NOT EXISTS cases (
  case_id TEXT PRIMARY KEY,
  title TEXT,
  status TEXT DEFAULT 'NEW',
  severity TEXT,
  amount REAL,
  shared_keys TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 4. Case-Alerts mapping table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS case_alerts (
  case_id TEXT,
  alert_id TEXT,
  PRIMARY KEY (case_id, alert_id)
);

-- 5. Decisions table (stores maker-checker investigation outcomes)
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT,
  decision_type TEXT,
  grounds TEXT,
  rationale TEXT,
  maker TEXT,
  checker TEXT,
  status TEXT DEFAULT 'PENDING',
  created_at TEXT DEFAULT (datetime('now')),
  decided_at TEXT
);

-- 6. Evidence table (stores tamper-evident SHA-256 hash chain)
CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT,
  path TEXT,
  kind TEXT,
  file_hash TEXT,
  prev_hash TEXT,
  item_hash TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 7. Reports table (records generated regulatory outputs)
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT,
  regime TEXT,
  path TEXT,
  sha256 TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 8. Audit log table (chronological record of actions and transitions)
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT,
  action TEXT,
  object_type TEXT,
  object_id TEXT,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 9. Raw events table (stores raw incoming payloads before validation)
CREATE TABLE IF NOT EXISTS raw_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT,
  payload_json TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
