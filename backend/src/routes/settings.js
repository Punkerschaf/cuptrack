import { Router } from 'express';
import { settings, logs, archivedStats, logCleanups } from '../dal.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { settingsSchema } from '../validators/index.js';

const router = Router();

// GET /api/settings — public, no auth required (needed for terminal views too)
router.get('/', (_req, res) => {
  res.json(settings.get());
});

// PUT /api/settings — admin only
router.put('/', authenticateToken, requireAdmin, (req, res, next) => {
  try {
    const data = settingsSchema.parse(req.body);
    const updated = settings.update(data);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/settings/cleanup-logs — admin only, deletes logs older than 1 year
router.delete('/cleanup-logs', authenticateToken, requireAdmin, (req, res) => {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const cutoffISO = oneYearAgo.toISOString();

  const oldLogs = logs.deleteOlderThan(cutoffISO);

  if (oldLogs.length === 0) {
    return res.json({ deletedCount: 0, message: 'Keine Logs älter als ein Jahr gefunden.' });
  }

  // Determine time range of deleted logs
  const timestamps = oldLogs.map(l => l.createdAt).sort();
  const oldestLog = timestamps[0];
  const newestLog = timestamps[timestamps.length - 1];

  // Aggregate coffee stats from old logs before losing them
  const oldCoffeeLogs = oldLogs.filter(l => l.type === 'coffee');
  const archived = archivedStats.get();
  oldCoffeeLogs.forEach(l => {
    archived.totalCoffees += 1;
    if (l.userId) {
      archived.coffeesByUser[l.userId] = (archived.coffeesByUser[l.userId] || 0) + 1;
    }
    if (l.machineId) {
      archived.coffeesByMachine[l.machineId] = (archived.coffeesByMachine[l.machineId] || 0) + 1;
    }
  });
  archivedStats.update(archived);

  logCleanups.create({
    deletedAt: new Date().toISOString(),
    deletedBy: req.user.username,
    deletedCount: oldLogs.length,
    periodFrom: oldestLog,
    periodTo: newestLog,
  });

  res.json({
    deletedCount: oldLogs.length,
    periodFrom: oldestLog,
    periodTo: newestLog,
  });
});

// GET /api/settings/log-cleanups — admin only, returns cleanup history
router.get('/log-cleanups', authenticateToken, requireAdmin, (_req, res) => {
  res.json(logCleanups.findAll());
});

export default router;
