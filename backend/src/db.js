import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, readFileSync } from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import config from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, 'cuptrack.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// Seed default settings
const settingsExist = db.prepare('SELECT 1 FROM settings WHERE key = ?').get('language');
if (!settingsExist) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('language', 'de');
}

// Seed default archived_stats
for (const key of ['totalCoffees', 'coffeesByUser', 'coffeesByMachine']) {
  const exists = db.prepare('SELECT 1 FROM archived_stats WHERE key = ?').get(key);
  if (!exists) {
    const val = key === 'totalCoffees' ? '0' : '{}';
    db.prepare('INSERT INTO archived_stats (key, value) VALUES (?, ?)').run(key, val);
  }
}

// Bootstrap root user if not exists
const rootExists = db.prepare('SELECT 1 FROM users WHERE isRoot = 1').get();
if (!rootExists) {
  const hashedPassword = bcrypt.hashSync(config.rootPassword, 10);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, username, displayName, password, type, isRoot, balance, apiKey, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(uuidv4(), config.rootUsername, 'Root Admin', hashedPassword, 'admin', 1, 0, null, now, now);
  console.log('Root-Benutzer erstellt.');
}

// Graceful shutdown
process.on('exit', () => db.close());

export default db;
