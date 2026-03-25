-- CupTrack SQLite Schema

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  displayName TEXT NOT NULL,
  password TEXT,
  type TEXT NOT NULL CHECK(type IN ('admin', 'api', 'drinker')),
  isRoot INTEGER NOT NULL DEFAULT 0,
  balance REAL NOT NULL DEFAULT 0,
  apiKey TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identifiers (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_identifiers_userId ON identifiers(userId);
CREATE INDEX IF NOT EXISTS idx_identifiers_type_value ON identifiers(type, value);

CREATE TABLE IF NOT EXISTS machines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  room TEXT NOT NULL DEFAULT '',
  pricePerCoffee REAL NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS terminals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  machineId TEXT NOT NULL REFERENCES machines(id),
  type TEXT NOT NULL DEFAULT 'web',
  quickButtonsEnabled INTEGER NOT NULL DEFAULT 0,
  quickButton1 REAL NOT NULL DEFAULT 5,
  quickButton2 REAL NOT NULL DEFAULT 10,
  alphabetFilterEnabled INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_terminals_slug ON terminals(slug);
CREATE INDEX IF NOT EXISTS idx_terminals_machineId ON terminals(machineId);

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  userId TEXT,
  machineId TEXT,
  terminalId TEXT,
  details TEXT,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_userId ON logs(userId);
CREATE INDEX IF NOT EXISTS idx_logs_machineId ON logs(machineId);
CREATE INDEX IF NOT EXISTS idx_logs_terminalId ON logs(terminalId);
CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type);
CREATE INDEX IF NOT EXISTS idx_logs_createdAt ON logs(createdAt);

CREATE TABLE IF NOT EXISTS cash_book (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  machineId TEXT,
  terminalId TEXT,
  performedBy TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS archived_stats (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS log_cleanups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deletedAt TEXT NOT NULL,
  deletedBy TEXT NOT NULL,
  deletedCount INTEGER NOT NULL,
  periodFrom TEXT NOT NULL,
  periodTo TEXT NOT NULL
);
