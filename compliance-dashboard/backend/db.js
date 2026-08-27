const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'data', 'dashboard.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------- Schema ----------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',      -- 'admin' | 'user'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS compliances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT,                          -- e.g. MCX Circular, Margin, Reporting, Audit, KYC
  reference_no TEXT,                      -- e.g. MCX circular / notice number
  description TEXT,
  frequency TEXT DEFAULT 'One-time',      -- One-time | Monthly | Quarterly | Half-Yearly | Annual
  due_date TEXT,                          -- ISO date
  status TEXT NOT NULL DEFAULT 'Pending', -- Pending | In Progress | Completed | Overdue
  completed_date TEXT,
  file_name TEXT,
  file_path TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id TEXT,
  asset_type TEXT,       -- SERVER | DESKTOP | LAPTOP | NETWORK | OTHER
  processor TEXT,
  ram TEXT,
  storage TEXT,
  os TEXT,
  ip_address TEXT,
  computer_name TEXT,
  user_name TEXT,
  department TEXT,
  location TEXT,
  status TEXT DEFAULT 'IN USE',   -- IN USE | IDLE | UNDER REPAIR | DECOMMISSIONED
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_compliance_status ON compliances(status);
CREATE INDEX IF NOT EXISTS idx_compliance_due ON compliances(due_date);
CREATE INDEX IF NOT EXISTS idx_inventory_dept ON inventory(department);
CREATE INDEX IF NOT EXISTS idx_inventory_type ON inventory(asset_type);
`);

module.exports = db;
