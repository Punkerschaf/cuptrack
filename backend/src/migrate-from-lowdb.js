/**
 * Migration: lowdb (db.json) → SQLite (cuptrack.db)
 *
 * Usage: node backend/src/migrate-from-lowdb.js
 *
 * Reads backend/data/db.json and writes all data into the SQLite database.
 * The SQLite DB is initialized by importing db.js (schema + root bootstrap).
 * Run this ONCE after switching to the SQLite backend.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbJsonPath = join(__dirname, '..', 'data', 'db.json');

if (!existsSync(dbJsonPath)) {
  console.error('db.json nicht gefunden unter:', dbJsonPath);
  process.exit(1);
}

const data = JSON.parse(readFileSync(dbJsonPath, 'utf-8'));
console.log('db.json geladen. Starte Migration...');

const migrate = db.transaction(() => {
  // ─── Users ──────────────────────────────────────────────
  let userCount = 0;
  const insertUser = db.prepare(
    `INSERT OR IGNORE INTO users (id, username, displayName, password, type, isRoot, balance, apiKey, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertIdentifier = db.prepare(
    'INSERT OR IGNORE INTO identifiers (id, type, value, userId) VALUES (?, ?, ?, ?)',
  );

  for (const u of data.users || []) {
    insertUser.run(
      u.id, u.username, u.displayName, u.password || null,
      u.type, u.isRoot ? 1 : 0, u.balance || 0, u.apiKey || null,
      u.createdAt, u.updatedAt,
    );
    for (const ident of u.identifiers || []) {
      insertIdentifier.run(ident.id, ident.type, ident.value, u.id);
    }
    userCount++;
  }
  console.log(`  Users: ${userCount}`);

  // ─── Machines ───────────────────────────────────────────
  let machineCount = 0;
  const insertMachine = db.prepare(
    `INSERT OR IGNORE INTO machines (id, name, room, pricePerCoffee, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const m of data.machines || []) {
    insertMachine.run(m.id, m.name, m.room || '', m.pricePerCoffee, m.createdAt, m.updatedAt);
    machineCount++;
  }
  console.log(`  Machines: ${machineCount}`);

  // ─── Terminals ──────────────────────────────────────────
  let terminalCount = 0;
  const insertTerminal = db.prepare(
    `INSERT OR IGNORE INTO terminals (id, name, slug, machineId, type, quickButtonsEnabled, quickButton1, quickButton2, alphabetFilterEnabled, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const t of data.terminals || []) {
    const qb = t.quickButtons || { enabled: false, button1: 5, button2: 10 };
    const af = t.alphabetFilter || { enabled: true };
    insertTerminal.run(
      t.id, t.name, t.slug, t.machineId, t.type || 'web',
      qb.enabled ? 1 : 0, qb.button1 || 5, qb.button2 || 10,
      af.enabled ? 1 : 0, t.createdAt, t.updatedAt,
    );
    terminalCount++;
  }
  console.log(`  Terminals: ${terminalCount}`);

  // ─── Logs ───────────────────────────────────────────────
  let logCount = 0;
  const insertLog = db.prepare(
    `INSERT OR IGNORE INTO logs (id, type, userId, machineId, terminalId, details, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const l of data.logs || []) {
    const details = l.details ? JSON.stringify(l.details) : null;
    insertLog.run(l.id, l.type, l.userId || null, l.machineId || null, l.terminalId || null, details, l.createdAt);
    logCount++;
  }
  console.log(`  Logs: ${logCount}`);

  // ─── Cash Book ──────────────────────────────────────────
  let cashBookCount = 0;
  const insertCashBook = db.prepare(
    `INSERT OR IGNORE INTO cash_book (id, type, amount, comment, machineId, terminalId, performedBy, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const e of data.cashBook || []) {
    insertCashBook.run(
      e.id, e.type, e.amount, e.comment || '', e.machineId || null,
      e.terminalId || null, e.performedBy, e.createdAt,
    );
    cashBookCount++;
  }
  console.log(`  Cash Book: ${cashBookCount}`);

  // ─── Settings ───────────────────────────────────────────
  const upsertSetting = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  if (data.settings) {
    for (const [key, value] of Object.entries(data.settings)) {
      upsertSetting.run(key, String(value));
    }
    console.log(`  Settings: ${Object.keys(data.settings).length} Einträge`);
  }

  // ─── Archived Stats ────────────────────────────────────
  const upsertArchived = db.prepare(
    'INSERT INTO archived_stats (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  if (data.archivedStats) {
    upsertArchived.run('totalCoffees', String(data.archivedStats.totalCoffees || 0));
    upsertArchived.run('coffeesByUser', JSON.stringify(data.archivedStats.coffeesByUser || {}));
    upsertArchived.run('coffeesByMachine', JSON.stringify(data.archivedStats.coffeesByMachine || {}));
    console.log('  Archived Stats: migriert');
  }

  // ─── Log Cleanups ──────────────────────────────────────
  let cleanupCount = 0;
  const insertCleanup = db.prepare(
    `INSERT INTO log_cleanups (deletedAt, deletedBy, deletedCount, periodFrom, periodTo)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const c of data.logCleanups || []) {
    insertCleanup.run(c.deletedAt, c.deletedBy, c.deletedCount, c.periodFrom, c.periodTo);
    cleanupCount++;
  }
  if (cleanupCount > 0) console.log(`  Log Cleanups: ${cleanupCount}`);
});

try {
  migrate();
  console.log('\nMigration erfolgreich abgeschlossen!');
  console.log('Die SQLite-Datenbank liegt unter: backend/data/cuptrack.db');
} catch (err) {
  console.error('Migration fehlgeschlagen:', err.message);
  process.exit(1);
}
