/**
 * Migration 001 — Baseline
 *
 * Marks existing databases as version 1. No schema changes.
 * This is the anchor point for all future migrations.
 */
export default {
  version: 1,
  name: 'baseline',
  type: 'auto',
  description: 'Baseline migration — marks the initial schema as version 1.',

  validate(db) {
    const usersTable = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
    ).get();
    if (!usersTable) {
      return { ok: false, message: 'Table "users" does not exist. Database not initialized.' };
    }
    return { ok: true, message: 'Database initialized, ready for baseline.' };
  },

  up(/* db */) {
    // No schema changes — this migration only records that version 1 is established.
  },
};
