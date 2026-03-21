import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import config from '../config.js';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
  }

  const user = db.data.users.find(u => u.username === username && u.type !== 'api');
  if (!user) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });

  if (user.type !== 'admin') {
    return res.status(403).json({ error: 'Nur Admins können sich am Dashboard anmelden' });
  }

  const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '24h' });

  db.data.logs.push({
    id: uuidv4(),
    type: 'login',
    userId: user.id,
    machineId: null,
    terminalId: null,
    details: { method: 'dashboard' },
    createdAt: new Date().toISOString(),
  });
  await db.write();

  const { password: _, ...safe } = user;
  res.json({ token, user: safe });
});

router.get('/me', authenticateToken, (req, res) => {
  const { password: _, ...safe } = req.user;
  res.json(safe);
});

export default router;
