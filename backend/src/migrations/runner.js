import { readdirSync, unlinkSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = join(__dirname, 'scripts');
const MAX_BACKUPS = 5;

/**
 * Ensure the schema_migrations table exists (idempotent).
 */
function ensureMigrationsTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('auto','manual')),
    executedAt TEXT NOT NULL,
    executedBy TEXT
  )`);
}

/**
 * Load all migration scripts from the scripts/ directory, sorted by version.
 */
function loadMigrationScripts() {
  let files;
  try {
    files = readdirSync(SCRIPTS_DIR).filter(f => /^\d{3}-.+\.js$/.test(f)).sort();
  } catch {
    return [];
  }

  const migrations = [];
  for (const file of files) {
    // Dynamic import is async, so we use a sync approach:
    // Migration files must use module.exports (CJS-compatible) or default export
    // We'll load them via dynamic import in the async wrapper
    migrations.push({ file, path: join(SCRIPTS_DIR, file) });
  }
  return migrations;
}

/**
 * Get the current schema version from the database.
 */
function getCurrentVersion(db) {
  const row = db.prepare('SELECT MAX(version) as version FROM schema_migrations').get();
  return row?.version || 0;
}

/**
 * Get all applied migrations.
 */
function getAppliedMigrations(db) {
  return db.prepare('SELECT * FROM schema_migrations ORDER BY version ASC').all();
}

/**
 * Create a backup of the database before running migrations.
 * Returns the backup file path.
 */
async function createBackup(db, version) {
  const dataDir = dirname(db.name);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(dataDir, `cuptrack.db.backup-v${version}-${timestamp}`);

  await db.backup(backupPath);

  // Clean up old backups (keep MAX_BACKUPS most recent)
  try {
    const backups = readdirSync(dataDir)
      .filter(f => f.startsWith('cuptrack.db.backup-'))
      .map(f => ({ name: f, path: join(dataDir, f), mtime: statSync(join(dataDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    for (const old of backups.slice(MAX_BACKUPS)) {
      unlinkSync(old.path);
    }
  } catch {
    // Cleanup failure is non-critical
  }

  return backupPath;
}

/**
 * Get migration status — current version, applied, and pending migrations.
 */
export async function getStatus(db) {
  ensureMigrationsTable(db);
  const currentVersion = getCurrentVersion(db);
  const applied = getAppliedMigrations(db);
  const scriptFiles = loadMigrationScripts();

  const pending = [];
  for (const { file, path } of scriptFiles) {
    const mod = await import(path);
    const migration = mod.default || mod;
    if (migration.version > currentVersion) {
      pending.push({
        version: migration.version,
        name: migration.name,
        type: migration.type,
        description: migration.description,
        breaking: migration.breaking || null,
        adminAction: migration.adminAction || null,
        params: migration.params || null,
      });
    }
  }

  return { currentVersion, applied, pending };
}

/**
 * Run all pending auto migrations. Stops before the first manual migration.
 * Returns { success, currentVersion, pendingManual, error, backupPath }.
 */
export async function runMigrations(db, logger = console) {
  ensureMigrationsTable(db);
  const currentVersion = getCurrentVersion(db);
  const scriptFiles = loadMigrationScripts();

  const pending = [];
  for (const { file, path } of scriptFiles) {
    const mod = await import(path);
    const migration = mod.default || mod;
    if (migration.version > currentVersion) {
      pending.push(migration);
    }
  }

  if (pending.length === 0) {
    return { success: true, currentVersion, pendingManual: null, error: null };
  }

  // Sort by version
  pending.sort((a, b) => a.version - b.version);

  let lastVersion = currentVersion;

  for (const migration of pending) {
    // Stop at first manual migration
    if (migration.type === 'manual') {
      const remainingManual = pending.filter(m => m.version >= migration.version && m.type === 'manual');
      return {
        success: true,
        currentVersion: lastVersion,
        pendingManual: remainingManual.map(m => ({
          version: m.version,
          name: m.name,
          type: m.type,
          description: m.description,
          breaking: m.breaking || null,
          adminAction: m.adminAction || null,
          params: m.params || null,
        })),
        error: null,
      };
    }

    // Validate before running
    if (migration.validate) {
      const validation = migration.validate(db);
      if (!validation.ok) {
        return {
          success: false,
          currentVersion: lastVersion,
          pendingManual: null,
          error: `Migration ${migration.version} (${migration.name}) validation failed: ${validation.message}`,
        };
      }
    }

    // Create backup before first migration
    let backupPath;
    if (lastVersion === currentVersion) {
      try {
        backupPath = await createBackup(db, migration.version);
        logger.info(`Backup created: ${backupPath}`);
      } catch (err) {
        return {
          success: false,
          currentVersion: lastVersion,
          pendingManual: null,
          error: `Backup failed before migration ${migration.version}: ${err.message}`,
        };
      }
    }

    // Run migration in transaction
    try {
      const runInTransaction = db.transaction(() => {
        migration.up(db);
        db.prepare(
          'INSERT INTO schema_migrations (version, name, type, executedAt, executedBy) VALUES (?, ?, ?, ?, ?)',
        ).run(migration.version, migration.name, migration.type, new Date().toISOString(), 'system');
      });
      runInTransaction();
      lastVersion = migration.version;
      logger.info(`Migration ${migration.version} (${migration.name}) applied successfully.`);
    } catch (err) {
      return {
        success: false,
        currentVersion: lastVersion,
        pendingManual: null,
        error: `Migration ${migration.version} (${migration.name}) failed: ${err.message}`,
        backupPath,
      };
    }
  }

  return { success: true, currentVersion: lastVersion, pendingManual: null, error: null };
}

/**
 * Run a specific manual migration by version number.
 * Used by the admin API and CLI tool.
 */
export async function runManualMigration(db, version, params = {}, executedBy = 'admin', logger = console) {
  ensureMigrationsTable(db);
  const scriptFiles = loadMigrationScripts();

  let migration;
  for (const { file, path } of scriptFiles) {
    const mod = await import(path);
    const m = mod.default || mod;
    if (m.version === version) {
      migration = m;
      break;
    }
  }

  if (!migration) {
    return { success: false, error: `Migration version ${version} not found.` };
  }

  if (migration.type !== 'manual') {
    return { success: false, error: `Migration ${version} is not a manual migration.` };
  }

  // Check it hasn't been applied already
  const existing = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(version);
  if (existing) {
    return { success: false, error: `Migration ${version} has already been applied.` };
  }

  // Check all prior migrations are applied
  const currentVersion = getCurrentVersion(db);
  if (migration.version !== currentVersion + 1) {
    return { success: false, error: `Migration ${version} cannot run. Current version is ${currentVersion}, expected ${migration.version - 1}.` };
  }

  // Validate
  if (migration.validate) {
    const validation = migration.validate(db);
    if (!validation.ok) {
      return { success: false, error: `Validation failed: ${validation.message}` };
    }
  }

  // Backup
  let backupPath;
  try {
    backupPath = await createBackup(db, version);
    logger.info(`Backup created: ${backupPath}`);
  } catch (err) {
    return { success: false, error: `Backup failed: ${err.message}` };
  }

  // Run in transaction
  try {
    const runInTransaction = db.transaction(() => {
      migration.up(db, params);
      db.prepare(
        'INSERT INTO schema_migrations (version, name, type, executedAt, executedBy) VALUES (?, ?, ?, ?, ?)',
      ).run(migration.version, migration.name, migration.type, new Date().toISOString(), executedBy);
    });
    runInTransaction();
    logger.info(`Manual migration ${migration.version} (${migration.name}) applied by ${executedBy}.`);
    return { success: true, version: migration.version, name: migration.name, backupPath };
  } catch (err) {
    return { success: false, error: `Migration ${version} failed: ${err.message}`, backupPath };
  }
}
