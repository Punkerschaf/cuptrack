import { isMaintenanceMode, getPendingManualMigrations } from '../db.js';

/**
 * Maintenance mode middleware.
 * When manual migrations are pending, only allow auth and migration endpoints.
 * Everything else gets HTTP 503.
 */
export function maintenanceGuard(req, res, next) {
  if (!isMaintenanceMode()) {
    return next();
  }

  // Always allow these paths in maintenance mode
  const allowedPaths = [
    '/api/health',
    '/api/auth/login',
    '/api/auth/me',
    '/api/admin/migrations',
  ];

  const isAllowed = allowedPaths.some(
    p => req.path === p || req.path.startsWith(p + '/'),
  );

  if (isAllowed) {
    return next();
  }

  return res.status(503).json({
    error: 'maintenance',
    message: 'Database migration required. Please contact an administrator.',
    pendingMigrations: getPendingManualMigrations(),
  });
}
