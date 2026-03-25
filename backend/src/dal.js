import db from './db.js';
import { v4 as uuidv4 } from 'uuid';

// ─── Helpers ────────────────────────────────────────────────

function attachIdentifiers(row) {
  if (!row) return null;
  const identifiers = db.prepare('SELECT id, type, value FROM identifiers WHERE userId = ?').all(row.id);
  return { ...row, isRoot: !!row.isRoot, identifiers };
}

function stripPassword(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

function parseLog(row) {
  if (!row) return null;
  return { ...row, details: row.details ? JSON.parse(row.details) : null };
}

function toTerminal(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    machineId: row.machineId,
    type: row.type,
    quickButtons: {
      enabled: !!row.quickButtonsEnabled,
      button1: row.quickButton1,
      button2: row.quickButton2,
    },
    alphabetFilter: {
      enabled: !!row.alphabetFilterEnabled,
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── Users ──────────────────────────────────────────────────

export const users = {
  findAll() {
    const rows = db.prepare('SELECT * FROM users').all();
    return rows.map(r => stripPassword(attachIdentifiers(r)));
  },

  findById(id) {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return attachIdentifiers(row);
  },

  findByIdSafe(id) {
    const user = users.findById(id);
    return stripPassword(user);
  },

  findByUsername(username) {
    const row = db.prepare("SELECT * FROM users WHERE username = ? AND type != 'api'").get(username);
    return attachIdentifiers(row);
  },

  findDrinkersForTerminal() {
    const rows = db.prepare("SELECT id, displayName FROM users WHERE type = 'drinker'").all();
    return rows.filter(u => {
      const ids = db.prepare("SELECT 1 FROM identifiers WHERE userId = ? AND type IN ('pin', 'kaba_nfc') LIMIT 1").get(u.id);
      return !!ids;
    });
  },

  findByNfcSerial(serial) {
    const normalized = serial.toLowerCase().trim();
    const identifier = db.prepare(
      "SELECT userId FROM identifiers WHERE type = 'kaba_nfc' AND LOWER(TRIM(value)) = ?",
    ).get(normalized);
    if (!identifier) return null;
    const row = db.prepare("SELECT * FROM users WHERE id = ? AND type = 'drinker'").get(identifier.userId);
    return attachIdentifiers(row);
  },

  usernameExists(username) {
    return !!db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
  },

  pinExists(pin) {
    return !!db.prepare("SELECT 1 FROM identifiers WHERE type = 'pin' AND value = ?").get(pin);
  },

  create(userData) {
    const { identifiers: ids, ...user } = userData;
    db.prepare(
      `INSERT INTO users (id, username, displayName, password, type, isRoot, balance, apiKey, createdAt, updatedAt)
       VALUES (@id, @username, @displayName, @password, @type, @isRoot, @balance, @apiKey, @createdAt, @updatedAt)`,
    ).run({ ...user, isRoot: user.isRoot ? 1 : 0 });

    if (ids && ids.length > 0) {
      const stmt = db.prepare('INSERT INTO identifiers (id, type, value, userId) VALUES (?, ?, ?, ?)');
      for (const ident of ids) {
        stmt.run(ident.id, ident.type, ident.value, user.id);
      }
    }
    return users.findById(user.id);
  },

  update(id, fields) {
    const setClauses = [];
    const values = {};
    for (const [key, val] of Object.entries(fields)) {
      if (key === 'identifiers') continue;
      setClauses.push(`${key} = @${key}`);
      values[key] = key === 'isRoot' ? (val ? 1 : 0) : val;
    }
    if (setClauses.length > 0) {
      values.id = id;
      db.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = @id`).run(values);
    }
    return users.findById(id);
  },

  replaceIdentifiers(userId, identifiers) {
    db.prepare('DELETE FROM identifiers WHERE userId = ?').run(userId);
    if (identifiers && identifiers.length > 0) {
      const stmt = db.prepare('INSERT INTO identifiers (id, type, value, userId) VALUES (?, ?, ?, ?)');
      for (const ident of identifiers) {
        stmt.run(ident.id || uuidv4(), ident.type, ident.value, userId);
      }
    }
  },

  delete(id) {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  },

  countDrinkers() {
    return db.prepare("SELECT COUNT(*) as count FROM users WHERE type = 'drinker'").get().count;
  },
};

// ─── Machines ───────────────────────────────────────────────

export const machines = {
  findAll() {
    return db.prepare('SELECT * FROM machines').all();
  },

  findById(id) {
    return db.prepare('SELECT * FROM machines WHERE id = ?').get(id) || null;
  },

  create(data) {
    db.prepare(
      `INSERT INTO machines (id, name, room, pricePerCoffee, createdAt, updatedAt)
       VALUES (@id, @name, @room, @pricePerCoffee, @createdAt, @updatedAt)`,
    ).run(data);
    return machines.findById(data.id);
  },

  update(id, fields) {
    const setClauses = [];
    const values = {};
    for (const [key, val] of Object.entries(fields)) {
      setClauses.push(`${key} = @${key}`);
      values[key] = val;
    }
    if (setClauses.length > 0) {
      values.id = id;
      db.prepare(`UPDATE machines SET ${setClauses.join(', ')} WHERE id = @id`).run(values);
    }
    return machines.findById(id);
  },

  delete(id) {
    db.prepare('DELETE FROM machines WHERE id = ?').run(id);
  },

  count() {
    return db.prepare('SELECT COUNT(*) as count FROM machines').get().count;
  },
};

// ─── Terminals ──────────────────────────────────────────────

export const terminals = {
  findAll() {
    const rows = db.prepare('SELECT * FROM terminals').all();
    return rows.map(row => {
      const t = toTerminal(row);
      const machine = machines.findById(t.machineId);
      return { ...t, machine: machine || null };
    });
  },

  findById(id) {
    const row = db.prepare('SELECT * FROM terminals WHERE id = ?').get(id);
    return toTerminal(row);
  },

  findByIdWithMachine(id) {
    const t = terminals.findById(id);
    if (!t) return null;
    const machine = machines.findById(t.machineId);
    return { ...t, machine: machine || null };
  },

  findBySlug(slug) {
    const row = db.prepare('SELECT * FROM terminals WHERE slug = ?').get(slug);
    return toTerminal(row);
  },

  slugExists(slug, excludeId) {
    if (excludeId) {
      return !!db.prepare('SELECT 1 FROM terminals WHERE slug = ? AND id != ?').get(slug, excludeId);
    }
    return !!db.prepare('SELECT 1 FROM terminals WHERE slug = ?').get(slug);
  },

  machineInUse(machineId) {
    return db.prepare('SELECT id FROM terminals WHERE machineId = ?').get(machineId) || null;
  },

  exists(id) {
    return !!db.prepare('SELECT 1 FROM terminals WHERE id = ?').get(id);
  },

  create(data) {
    db.prepare(
      `INSERT INTO terminals (id, name, slug, machineId, type, quickButtonsEnabled, quickButton1, quickButton2, alphabetFilterEnabled, createdAt, updatedAt)
       VALUES (@id, @name, @slug, @machineId, @type, @quickButtonsEnabled, @quickButton1, @quickButton2, @alphabetFilterEnabled, @createdAt, @updatedAt)`,
    ).run(data);
    return terminals.findByIdWithMachine(data.id);
  },

  update(id, fields) {
    const setClauses = [];
    const values = {};
    for (const [key, val] of Object.entries(fields)) {
      setClauses.push(`${key} = @${key}`);
      values[key] = val;
    }
    if (setClauses.length > 0) {
      values.id = id;
      db.prepare(`UPDATE terminals SET ${setClauses.join(', ')} WHERE id = @id`).run(values);
    }
    return terminals.findByIdWithMachine(id);
  },

  delete(id) {
    db.prepare('DELETE FROM terminals WHERE id = ?').run(id);
  },

  count() {
    return db.prepare('SELECT COUNT(*) as count FROM terminals').get().count;
  },
};

// ─── Logs ───────────────────────────────────────────────────

export const logs = {
  create(entry) {
    const row = {
      id: entry.id || uuidv4(),
      type: entry.type,
      userId: entry.userId || null,
      machineId: entry.machineId || null,
      terminalId: entry.terminalId || null,
      details: entry.details ? JSON.stringify(entry.details) : null,
      createdAt: entry.createdAt || new Date().toISOString(),
    };
    db.prepare(
      `INSERT INTO logs (id, type, userId, machineId, terminalId, details, createdAt)
       VALUES (@id, @type, @userId, @machineId, @terminalId, @details, @createdAt)`,
    ).run(row);
  },

  findByUserId(userId) {
    return db.prepare('SELECT * FROM logs WHERE userId = ? ORDER BY createdAt DESC').all(userId).map(parseLog);
  },

  findByMachineId(machineId) {
    return db.prepare('SELECT * FROM logs WHERE machineId = ? ORDER BY createdAt DESC').all(machineId).map(parseLog);
  },

  findByTerminalId(terminalId) {
    return db.prepare('SELECT * FROM logs WHERE terminalId = ? ORDER BY createdAt DESC').all(terminalId).map(parseLog);
  },

  getCoffeeLogs() {
    return db.prepare("SELECT * FROM logs WHERE type = 'coffee'").all().map(parseLog);
  },

  countCoffeesForDate(dateStr) {
    return db.prepare("SELECT COUNT(*) as count FROM logs WHERE type = 'coffee' AND createdAt LIKE ?")
      .get(dateStr + '%').count;
  },

  coffeesPerDay(startDateStr) {
    return db.prepare(
      "SELECT DATE(createdAt) as date, COUNT(*) as count FROM logs WHERE type = 'coffee' AND createdAt >= ? GROUP BY DATE(createdAt)",
    ).all(startDateStr + 'T00:00:00.000Z');
  },

  coffeeCountsByUser() {
    return db.prepare("SELECT userId, COUNT(*) as count FROM logs WHERE type = 'coffee' GROUP BY userId").all();
  },

  coffeeCountsByMachine() {
    return db.prepare(
      "SELECT machineId, COUNT(*) as count FROM logs WHERE type = 'coffee' AND machineId IS NOT NULL GROUP BY machineId",
    ).all();
  },

  deleteOlderThan(cutoffISO) {
    const old = db.prepare('SELECT * FROM logs WHERE createdAt < ?').all(cutoffISO).map(parseLog);
    if (old.length > 0) {
      db.prepare('DELETE FROM logs WHERE createdAt < ?').run(cutoffISO);
    }
    return old;
  },
};

// ─── Cash Book ──────────────────────────────────────────────

export const cashBook = {
  findAll() {
    return db.prepare('SELECT * FROM cash_book ORDER BY createdAt DESC').all();
  },

  findById(id) {
    return db.prepare('SELECT * FROM cash_book WHERE id = ?').get(id) || null;
  },

  create(entry) {
    const row = {
      id: entry.id || uuidv4(),
      type: entry.type,
      amount: entry.amount,
      comment: entry.comment || '',
      machineId: entry.machineId || null,
      terminalId: entry.terminalId || null,
      performedBy: entry.performedBy,
      createdAt: entry.createdAt || new Date().toISOString(),
    };
    db.prepare(
      `INSERT INTO cash_book (id, type, amount, comment, machineId, terminalId, performedBy, createdAt)
       VALUES (@id, @type, @amount, @comment, @machineId, @terminalId, @performedBy, @createdAt)`,
    ).run(row);
    return row;
  },

  delete(id) {
    db.prepare('DELETE FROM cash_book WHERE id = ?').run(id);
  },

  computeBalance() {
    const result = db.prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN type IN ('deposit', 'anonymous_coffee') THEN amount ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0) as balance
       FROM cash_book`,
    ).get();
    return Math.round(result.balance * 100) / 100;
  },
};

// ─── Settings ───────────────────────────────────────────────

export const settings = {
  get() {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const obj = {};
    for (const row of rows) obj[row.key] = row.value;
    return Object.keys(obj).length > 0 ? obj : { language: 'de' };
  },

  update(data) {
    const upsert = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    );
    for (const [key, value] of Object.entries(data)) {
      upsert.run(key, value);
    }
    return settings.get();
  },
};

// ─── Archived Stats ─────────────────────────────────────────

export const archivedStats = {
  get() {
    const rows = db.prepare('SELECT key, value FROM archived_stats').all();
    const obj = { totalCoffees: 0, coffeesByUser: {}, coffeesByMachine: {} };
    for (const row of rows) {
      if (row.key === 'totalCoffees') obj.totalCoffees = parseInt(row.value, 10) || 0;
      else obj[row.key] = JSON.parse(row.value);
    }
    return obj;
  },

  update(stats) {
    const upsert = db.prepare(
      'INSERT INTO archived_stats (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    );
    upsert.run('totalCoffees', String(stats.totalCoffees));
    upsert.run('coffeesByUser', JSON.stringify(stats.coffeesByUser));
    upsert.run('coffeesByMachine', JSON.stringify(stats.coffeesByMachine));
  },
};

// ─── Log Cleanups ───────────────────────────────────────────

export const logCleanups = {
  findAll() {
    return db.prepare('SELECT * FROM log_cleanups ORDER BY deletedAt DESC').all();
  },

  create(entry) {
    db.prepare(
      `INSERT INTO log_cleanups (deletedAt, deletedBy, deletedCount, periodFrom, periodTo)
       VALUES (@deletedAt, @deletedBy, @deletedCount, @periodFrom, @periodTo)`,
    ).run(entry);
  },
};
