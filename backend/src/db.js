import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import { JSONFilePreset } from 'lowdb/node';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import config from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const defaultData = {
  users: [],
  machines: [],
  terminals: [],
  logs: [],
};

const db = await JSONFilePreset(join(dataDir, 'db.json'), defaultData);

// Bootstrap root user if not exists
const rootExists = db.data.users.some(u => u.isRoot);
if (!rootExists) {
  const hashedPassword = await bcrypt.hash(config.rootPassword, 10);
  db.data.users.push({
    id: uuidv4(),
    username: config.rootUsername,
    displayName: 'Root Admin',
    password: hashedPassword,
    type: 'admin',
    isRoot: true,
    balance: 0,
    identifiers: [],
    apiKey: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await db.write();
  console.log('Root-Benutzer erstellt.');
}

export default db;
