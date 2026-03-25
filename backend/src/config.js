import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'cuptrack-dev-secret-change-in-production',
  rootUsername: process.env.ROOT_USERNAME || 'root',
  rootPassword: process.env.ROOT_PASSWORD || 'Coffee',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  logLevel: process.env.LOG_LEVEL || 'info',
};

if (config.nodeEnv === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('FATAL: JWT_SECRET muss in Produktion gesetzt sein (mind. 32 Zeichen)');
    process.exit(1);
  }
  if (!process.env.ROOT_PASSWORD || process.env.ROOT_PASSWORD === 'Coffee') {
    console.warn('WARNUNG: ROOT_PASSWORD sollte in Produktion geändert werden');
  }
}

export default config;
