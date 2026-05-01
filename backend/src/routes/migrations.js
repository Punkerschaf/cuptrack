import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import db, { isMaintenanceMode, getPendingManualMigrations, exitMaintenanceMode } from '../db.js';
import { getStatus, runManualMigration } from '../migrations/runner.js';

const router = Router();

// All migration routes require admin auth
router.use(authenticateToken, requireAdmin);

/**
 * GET /api/admin/migrations
 * Returns current migration status including pending migrations.
 */
router.get('/', async (_req, res, next) => {
  try {
    const status = await getStatus(db);
    res.json({
      currentVersion: status.currentVersion,
      maintenanceMode: isMaintenanceMode(),
      applied: status.applied,
      pending: status.pending,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/migrations/run
 * Run a specific manual migration. Only root users can trigger this.
 * Body: { version: number, confirm: true, params?: object }
 */
router.post('/run', async (req, res, next) => {
  try {
    if (!req.user.isRoot) {
      return res.status(403).json({ error: 'Only the root user can run migrations.' });
    }

    const { version, confirm, params } = req.body;

    if (!version || !confirm) {
      return res.status(400).json({ error: 'Fields "version" and "confirm: true" are required.' });
    }

    const result = await runManualMigration(
      db,
      version,
      params || {},
      req.user.username,
    );

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        backupPath: result.backupPath || null,
      });
    }

    // Check if there are still pending manual migrations
    const status = await getStatus(db);
    const stillPendingManual = status.pending.filter(m => m.type === 'manual');

    if (stillPendingManual.length === 0) {
      exitMaintenanceMode();
    }

    res.json({
      success: true,
      version: result.version,
      name: result.name,
      backupPath: result.backupPath,
      maintenanceMode: isMaintenanceMode(),
      remainingPending: status.pending,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
