import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import config from './config.js';
import { initMigrations } from './db.js';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { maintenanceGuard } from './middleware/maintenance.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import machineRoutes from './routes/machines.js';
import terminalRoutes from './routes/terminals.js';
import terminalActionRoutes from './routes/terminalActions.js';
import statsRoutes from './routes/stats.js';
import settingsRoutes from './routes/settings.js';
import cashBookRoutes from './routes/cashBook.js';
import migrationsRoutes from './routes/migrations.js';

const logger = pino({ level: config.logLevel });

const __dirname = dirname(fileURLToPath(import.meta.url));
const version = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'version.json'), 'utf-8'),
);

const app = express();

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// CORS
const corsOptions = config.corsOrigin === '*'
  ? {}
  : { origin: config.corsOrigin.split(',').map(s => s.trim()) };
app.use(cors(corsOptions));

app.use(express.json());

// Request logging
app.use(requestLogger(logger));

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anmeldeversuche, bitte später erneut versuchen' },
});

// Maintenance mode guard (must be before routes, after middleware)
app.use(maintenanceGuard);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: `${version.major}.${version.minor}.${version.patch}`,
    codeName: version.codeName,
  });
});

// API routes
app.use('/api/admin/migrations', migrationsRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/machines', machineRoutes);
app.use('/api/terminals', terminalRoutes);
app.use('/api/terminal-actions', terminalActionRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/cashbook', cashBookRoutes);

// Serve frontend build in production
const frontendDist = join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (_req, res, next) => {
  res.sendFile(join(frontendDist, 'index.html'), err => {
    if (err) next();
  });
});

// Central error handler (must be last)
app.use(errorHandler(logger));

// Unhandled errors
process.on('uncaughtException', (err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'Uncaught Exception');
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: String(reason) }, 'Unhandled Rejection');
  process.exit(1);
});

// Run migrations, then start server
async function start() {
  await initMigrations(logger);

  app.listen(config.port, '0.0.0.0', () => {
    logger.info(
      `CupTrack v${version.major}.${version.minor}.${version.patch} "${version.codeName}" auf Port ${config.port}`,
    );
  });
}

start();
