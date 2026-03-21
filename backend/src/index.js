import express from 'express';
import cors from 'cors';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import config from './config.js';
import './db.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import machineRoutes from './routes/machines.js';
import terminalRoutes from './routes/terminals.js';
import terminalActionRoutes from './routes/terminalActions.js';
import statsRoutes from './routes/stats.js';
import settingsRoutes from './routes/settings.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const version = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'version.json'), 'utf-8'),
);

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: `${version.major}.${version.minor}.${version.patch}`,
    codeName: version.codeName,
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/machines', machineRoutes);
app.use('/api/terminals', terminalRoutes);
app.use('/api/terminal-actions', terminalActionRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/settings', settingsRoutes);

// Serve frontend build in production
const frontendDist = join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (_req, res, next) => {
  res.sendFile(join(frontendDist, 'index.html'), err => {
    if (err) next();
  });
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(
    `CupTrack v${version.major}.${version.minor}.${version.patch} "${version.codeName}" auf Port ${config.port}`,
  );
});
