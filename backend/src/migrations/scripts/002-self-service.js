/**
 * Migration 002 — Terminal Self Service Settings
 *
 * Adds two new columns to the terminals table to enable/disable
 * self-service features per terminal:
 *   - pinChangeEnabled: allows authenticated users to change their PIN
 *   - selfRegistrationEnabled: allows new users to self-register
 */
export default {
  version: 2,
  name: 'self-service',
  type: 'auto',
  description: 'Adds pinChangeEnabled and selfRegistrationEnabled columns to terminals table.',

  validate(db) {
    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='terminals'",
    ).get();
    if (!table) {
      return { ok: false, message: 'Table "terminals" does not exist.' };
    }
    return { ok: true, message: 'Terminals table exists, ready for migration.' };
  },

  up(db) {
    const cols = db.prepare("PRAGMA table_info(terminals)").all().map(c => c.name);

    if (!cols.includes('pinChangeEnabled')) {
      db.prepare('ALTER TABLE terminals ADD COLUMN pinChangeEnabled INTEGER DEFAULT 0').run();
    }
    if (!cols.includes('selfRegistrationEnabled')) {
      db.prepare('ALTER TABLE terminals ADD COLUMN selfRegistrationEnabled INTEGER DEFAULT 0').run();
    }
  },
};
