#!/usr/bin/env node

/**
 * CupTrack Migration CLI
 *
 * Usage:
 *   node backend/src/migrations/cli.js status       Show current migration status
 *   node backend/src/migrations/cli.js run           Run all pending migrations (auto + manual)
 *   node backend/src/migrations/cli.js run --version N  Run up to version N
 *   node backend/src/migrations/cli.js backup        Create a manual database backup
 *
 * Docker:
 *   docker compose exec cuptrack node backend/src/migrations/cli.js status
 */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, statSync } from 'fs';
import Database from 'better-sqlite3';
import { getStatus, runMigrations, runManualMigration } from './runner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', '..', 'data');
const dbPath = join(dataDir, 'cuptrack.db');

function openDb() {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function printTable(rows, columns) {
  if (rows.length === 0) {
    console.log('  (none)');
    return;
  }
  const widths = columns.map(col =>
    Math.max(col.label.length, ...rows.map(r => String(r[col.key] ?? '').length)),
  );
  const header = columns.map((col, i) => col.label.padEnd(widths[i])).join('  ');
  const separator = widths.map(w => '-'.repeat(w)).join('  ');
  console.log(`  ${header}`);
  console.log(`  ${separator}`);
  for (const row of rows) {
    const line = columns.map((col, i) => String(row[col.key] ?? '').padEnd(widths[i])).join('  ');
    console.log(`  ${line}`);
  }
}

async function cmdStatus() {
  const db = openDb();
  try {
    const status = await getStatus(db);
    console.log(`\nCupTrack Database Migration Status`);
    console.log(`==================================`);
    console.log(`Current schema version: ${status.currentVersion}`);
    console.log(`Database: ${dbPath}\n`);

    console.log('Applied migrations:');
    printTable(status.applied, [
      { key: 'version', label: 'Version' },
      { key: 'name', label: 'Name' },
      { key: 'type', label: 'Type' },
      { key: 'executedAt', label: 'Executed At' },
      { key: 'executedBy', label: 'By' },
    ]);

    console.log('\nPending migrations:');
    printTable(status.pending, [
      { key: 'version', label: 'Version' },
      { key: 'name', label: 'Name' },
      { key: 'type', label: 'Type' },
      { key: 'description', label: 'Description' },
    ]);

    const manualPending = status.pending.filter(m => m.type === 'manual');
    if (manualPending.length > 0) {
      console.log('\n⚠ Manual migrations require admin confirmation.');
      for (const m of manualPending) {
        console.log(`\n  Migration ${m.version}: ${m.name}`);
        console.log(`  ${m.description}`);
        if (m.breaking) {
          console.log('  Breaking changes:');
          for (const b of m.breaking) {
            console.log(`    - ${b}`);
          }
        }
        if (m.adminAction) {
          console.log(`  Admin action required: ${m.adminAction}`);
        }
      }
    }
    console.log('');
  } finally {
    db.close();
  }
}

async function cmdRun(maxVersion) {
  const db = openDb();
  try {
    // First run auto migrations
    const result = await runMigrations(db);

    if (!result.success) {
      console.error(`\nMigration failed: ${result.error}`);
      if (result.backupPath) {
        console.error(`Backup available at: ${result.backupPath}`);
      }
      process.exit(1);
    }

    // Then run manual migrations if any
    if (result.pendingManual && result.pendingManual.length > 0) {
      for (const migration of result.pendingManual) {
        if (maxVersion && migration.version > maxVersion) {
          console.log(`Stopping at version ${maxVersion} as requested.`);
          break;
        }
        console.log(`\nRunning manual migration ${migration.version}: ${migration.name}`);
        console.log(`  ${migration.description}`);
        if (migration.breaking) {
          console.log('  Breaking changes:');
          for (const b of migration.breaking) {
            console.log(`    - ${b}`);
          }
        }

        const manualResult = await runManualMigration(db, migration.version, {}, 'cli');
        if (!manualResult.success) {
          console.error(`\nManual migration failed: ${manualResult.error}`);
          if (manualResult.backupPath) {
            console.error(`Backup available at: ${manualResult.backupPath}`);
          }
          process.exit(1);
        }
        console.log(`  ✓ Migration ${migration.version} applied.`);
      }
    }

    const status = await getStatus(db);
    console.log(`\nAll migrations applied. Current version: ${status.currentVersion}`);
  } finally {
    db.close();
  }
}

async function cmdBackup() {
  const db = openDb();
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(dataDir, `cuptrack.db.backup-manual-${timestamp}`);
    await db.backup(backupPath);
    console.log(`Backup created: ${backupPath}`);
  } finally {
    db.close();
  }
}

// Parse CLI arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'status':
    await cmdStatus();
    break;
  case 'run': {
    const versionIdx = args.indexOf('--version');
    const maxVersion = versionIdx !== -1 ? parseInt(args[versionIdx + 1], 10) : null;
    await cmdRun(maxVersion);
    break;
  }
  case 'backup':
    await cmdBackup();
    break;
  default:
    console.log(`CupTrack Migration CLI\n`);
    console.log('Usage:');
    console.log('  node backend/src/migrations/cli.js status              Show migration status');
    console.log('  node backend/src/migrations/cli.js run                 Run all pending migrations');
    console.log('  node backend/src/migrations/cli.js run --version N     Run up to version N');
    console.log('  node backend/src/migrations/cli.js backup              Create database backup');
    process.exit(1);
}
