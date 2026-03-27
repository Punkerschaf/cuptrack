# CupTrack — Database Migrations

This document describes the database migration system for CupTrack. It covers how migrations work, how to update a production system, how to create new migrations as a developer, and how to troubleshoot problems.

---

## Overview

CupTrack uses SQLite (via `better-sqlite3`) as its database. The migration system ensures that database schema changes are applied automatically or with admin confirmation when updating to a new version.

**Two types of migrations:**

| Type | Runs when | Admin action required | Use case |
|------|-----------|----------------------|----------|
| `auto` | Automatically on server start | No | Additive changes: new tables, new columns, new indexes |
| `manual` | Admin must confirm via Dashboard or CLI | Yes | Breaking changes: restructured tables, removed fields, incompatible data transformations |

---

## For Administrators

### Updating CupTrack (Docker)

#### Normal update (automatic migrations only)

```bash
git pull                          # or pull new image
docker compose build
docker compose up -d
```

The server runs all pending `auto` migrations on startup. No further action needed.

#### Update with manual migrations (breaking changes)

```bash
git pull
docker compose build
docker compose up -d
```

The server starts in **Maintenance Mode**:
- Auto migrations are applied automatically
- Terminals receive HTTP 503 (service unavailable)
- Only admin login and migration endpoints are accessible

**Via Dashboard:**
1. Log in as root admin
2. A warning banner shows pending migrations with details
3. Review what changes and what breaks
4. Click "Run migration" and confirm
5. After completion, the server exits maintenance mode automatically

**Via CLI (useful for headless deployments like Raspberry Pi):**

```bash
# Check status
docker compose exec cuptrack node backend/src/migrations/cli.js status

# Run all pending migrations (auto + manual)
docker compose exec cuptrack node backend/src/migrations/cli.js run

# Run up to a specific version
docker compose exec cuptrack node backend/src/migrations/cli.js run --version 3
```

### Rollback

If a migration fails or causes issues:

1. Stop the server: `docker compose down`
2. Restore from backup:
   ```bash
   # List available backups
   ls backend/data/cuptrack.db.backup-*

   # Restore (pick the most recent one before the failed migration)
   cp backend/data/cuptrack.db.backup-v2-2026-03-26T10-00-00-000Z backend/data/cuptrack.db
   ```
3. Revert to previous code version: `git checkout v0.x.x`
4. Rebuild and start: `docker compose build && docker compose up -d`

### Backups

The migration system creates automatic backups before each migration run:
- Location: `backend/data/cuptrack.db.backup-v{VERSION}-{TIMESTAMP}`
- Up to 5 backups are kept; older ones are deleted automatically

To create a manual backup:
```bash
docker compose exec cuptrack node backend/src/migrations/cli.js backup
```

### CLI Reference

```bash
# All commands (inside container or local dev)
node backend/src/migrations/cli.js status              # Show schema version and pending migrations
node backend/src/migrations/cli.js run                 # Run all pending migrations
node backend/src/migrations/cli.js run --version N     # Run migrations up to version N
node backend/src/migrations/cli.js backup              # Create manual backup
```

---

## For Developers

### Migration File Location

```
backend/src/migrations/
├── runner.js                   # Migration engine (do not modify)
├── cli.js                      # CLI tool (do not modify)
└── scripts/
    ├── 001-baseline.js         # Baseline (version 1)
    ├── 002-add-feature-x.js    # Example auto migration
    └── 003-restructure-y.js    # Example manual migration
```

### Creating a New Migration

1. Create a new file in `backend/src/migrations/scripts/` with the next version number:
   - Format: `NNN-descriptive-name.js` (e.g., `002-add-machine-status.js`)
   - Version numbers must be sequential and unique

2. Use the migration interface:

```javascript
export default {
  // Required fields
  version: 2,                    // Sequential integer, must match filename prefix
  name: 'add-machine-status',   // Technical name (kebab-case)
  type: 'auto',                 // 'auto' or 'manual'
  description: 'Adds status field to machines table for maintenance tracking.',

  // Required for type: 'manual' only
  breaking: [                   // Array of strings describing what breaks
    'API field machines.status is now required in responses',
    'Terminal firmware < v2.0 cannot read status field',
  ],
  adminAction: 'Update all terminal firmware to v2.0+ after migration.',

  // Optional: Parameters the admin must provide before running
  params: [
    {
      key: 'defaultStatus',
      label: 'Default status for existing machines',
      type: 'string',
      default: 'active',
    },
  ],

  // Required: Pre-migration validation
  validate(db) {
    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='machines'"
    ).get();
    if (!table) {
      return { ok: false, message: 'Table "machines" does not exist.' };
    }
    return { ok: true, message: 'Ready.' };
  },

  // Required: The migration logic
  up(db, params) {
    // params is an object with values from the params array above (manual only)
    db.exec(`ALTER TABLE machines ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`);
  },
};
```

### Migration Interface Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | `number` | Yes | Sequential integer, matches filename prefix |
| `name` | `string` | Yes | Technical name (kebab-case) |
| `type` | `'auto' \| 'manual'` | Yes | Auto = runs on startup; Manual = needs admin confirmation |
| `description` | `string` | Yes | Human-readable description of what the migration does |
| `breaking` | `string[] \| null` | Manual only | Changes that break existing functionality |
| `adminAction` | `string \| null` | Manual only | Actions the admin must take outside the database |
| `params` | `array \| null` | Optional | Input fields the admin fills before running |
| `validate(db)` | `function` | Yes | Returns `{ ok: boolean, message: string }` |
| `up(db, params?)` | `function` | Yes | Performs the actual schema/data changes |

### When to Use `type: 'manual'`

Use manual migrations when:
- Removing or renaming columns/tables
- Changing data types of existing columns
- Restructuring data that external systems depend on
- Any change that requires the admin to update external systems (API clients, terminal firmware, etc.)

Use auto migrations when:
- Adding new tables
- Adding new columns with defaults
- Adding indexes
- Data backfills that don't change existing behavior

### SQLite-Specific Considerations

**Adding a column:**
```javascript
up(db) {
  db.exec(`ALTER TABLE machines ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`);
}
```

**Renaming/restructuring a table (12-step ALTER TABLE):**
```javascript
up(db) {
  // SQLite cannot alter column types or constraints directly.
  // Use the 12-step process: create new → copy → drop old → rename new
  db.pragma('foreign_keys = OFF');

  db.exec(`
    CREATE TABLE machines_new (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    INSERT INTO machines_new (id, name, createdAt, updatedAt)
    SELECT id, name, createdAt, updatedAt FROM machines;

    DROP TABLE machines;

    ALTER TABLE machines_new RENAME TO machines;
  `);

  db.pragma('foreign_keys = ON');

  // Verify foreign key integrity after re-enabling
  const fkCheck = db.pragma('foreign_key_check');
  if (fkCheck.length > 0) {
    throw new Error('Foreign key integrity violated after table rebuild');
  }
}
```

**Important:** When using `PRAGMA foreign_keys = OFF`, always re-enable and verify with `PRAGMA foreign_key_check` at the end.

### Version Number Convention

- Version numbers are sequential integers starting at 1
- The baseline migration is always version 1
- When working on feature branches, use a placeholder version number
- **Assign the final version number when merging into `main`** to avoid conflicts

### Testing Migrations

1. Start with a fresh database: delete `backend/data/cuptrack.db`
2. Run the server — all migrations should apply from baseline
3. Check the CLI status: `node backend/src/migrations/cli.js status`
4. Test with an existing database: verify only new migrations are applied
5. Test validation: intentionally create a bad state and verify `validate()` catches it

---

## API Endpoints (Admin)

### `GET /api/admin/migrations`

Returns the current migration status. Requires JWT + admin role.

**Response:**
```json
{
  "currentVersion": 2,
  "maintenanceMode": false,
  "applied": [
    { "version": 1, "name": "baseline", "type": "auto", "executedAt": "2026-03-26T10:00:00.000Z", "executedBy": "system" },
    { "version": 2, "name": "add-machine-status", "type": "auto", "executedAt": "2026-03-26T10:00:01.000Z", "executedBy": "system" }
  ],
  "pending": [
    { "version": 3, "name": "restructure-identifiers", "type": "manual", "description": "...", "breaking": ["..."], "adminAction": "...", "params": null }
  ]
}
```

### `POST /api/admin/migrations/run`

Runs a specific manual migration. Requires JWT + root user.

**Request:**
```json
{
  "version": 3,
  "confirm": true,
  "params": {}
}
```

**Response:**
```json
{
  "success": true,
  "version": 3,
  "name": "restructure-identifiers",
  "backupPath": "backend/data/cuptrack.db.backup-v3-2026-03-26T10-00-00-000Z",
  "maintenanceMode": false,
  "remainingPending": []
}
```

---

## Troubleshooting

### Server won't start after update

**Symptom:** Server exits with `FATAL: Database migration failed: ...`

**Solution:**
1. Check the error message — it tells you which migration failed and why
2. If a backup path is mentioned, you can restore it (see Rollback section)
3. Check the migration's `validate()` function — it may have failed a precondition

### Maintenance mode won't end

**Symptom:** Dashboard shows migration banner but no "Run migration" button

**Solution:** Only the root user can run migrations. Log in with the root account.

### Migration applied but data seems wrong

**Solution:**
1. Stop the server
2. Restore the backup (see Rollback section above)
3. Report the issue — the migration may have a bug

### CLI shows "no pending migrations" but server is in maintenance mode

**Solution:** Restart the server. The maintenance mode flag is in-memory and is re-evaluated on startup.
