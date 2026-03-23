import { Router } from 'express';
import db from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/settings — public, no auth required (needed for terminal views too)
router.get('/', async (_req, res) => {
  await db.read();
  const settings = db.data.settings || { language: 'de' };
  res.json(settings);
});

// PUT /api/settings — admin only
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  const { language } = req.body;
  const allowedLanguages = ['de', 'en'];
  if (!language || !allowedLanguages.includes(language)) {
    return res.status(400).json({ error: 'Ungültige Sprache' });
  }

  await db.read();
  db.data.settings = { ...(db.data.settings || {}), language };
  await db.write();

  res.json(db.data.settings);
});

// DELETE /api/settings/cleanup-logs — admin only, deletes logs older than 1 year
router.delete('/cleanup-logs', authenticateToken, requireAdmin, async (req, res) => {
  await db.read();

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const cutoffISO = oneYearAgo.toISOString();

  const oldLogs = db.data.logs.filter(l => l.createdAt < cutoffISO);
  const remainingLogs = db.data.logs.filter(l => l.createdAt >= cutoffISO);

  if (oldLogs.length === 0) {
    return res.json({ deletedCount: 0, message: 'Keine Logs älter als ein Jahr gefunden.' });
  }

  // Determine time range of deleted logs
  const timestamps = oldLogs.map(l => l.createdAt).sort();
  const oldestLog = timestamps[0];
  const newestLog = timestamps[timestamps.length - 1];

  // Aggregate coffee stats from old logs before deleting
  const oldCoffeeLogs = oldLogs.filter(l => l.type === 'coffee');
  if (!db.data.archivedStats) {
    db.data.archivedStats = { totalCoffees: 0, coffeesByUser: {}, coffeesByMachine: {} };
  }
  const archived = db.data.archivedStats;
  oldCoffeeLogs.forEach(l => {
    archived.totalCoffees += 1;
    if (l.userId) {
      archived.coffeesByUser[l.userId] = (archived.coffeesByUser[l.userId] || 0) + 1;
    }
    if (l.machineId) {
      archived.coffeesByMachine[l.machineId] = (archived.coffeesByMachine[l.machineId] || 0) + 1;
    }
  });

  // Replace logs with only the remaining ones
  db.data.logs = remainingLogs;

  // Record the cleanup event
  if (!db.data.logCleanups) db.data.logCleanups = [];
  db.data.logCleanups.push({
    deletedAt: new Date().toISOString(),
    deletedBy: req.user.username,
    deletedCount: oldLogs.length,
    periodFrom: oldestLog,
    periodTo: newestLog,
  });

  await db.write();

  res.json({
    deletedCount: oldLogs.length,
    periodFrom: oldestLog,
    periodTo: newestLog,
  });
});

// GET /api/settings/log-cleanups — admin only, returns cleanup history
router.get('/log-cleanups', authenticateToken, requireAdmin, async (_req, res) => {
  await db.read();
  res.json(db.data.logCleanups || []);
});

export default router;
