import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import config from '../config.js';
import { users, logs } from '../dal.js';
import { authenticateToken } from '../middleware/auth.js';
import { loginSchema } from '../validators/index.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const user = users.findByUsername(username);
    if (!user) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });

    if (user.type !== 'admin') {
      return res.status(403).json({ error: 'Nur Admins können sich am Dashboard anmelden' });
    }

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '24h' });

    logs.create({
      id: uuidv4(),
      type: 'login',
      userId: user.id,
      machineId: null,
      terminalId: null,
      details: { method: 'dashboard' },
      createdAt: new Date().toISOString(),
    });

    const { password: _, ...safe } = user;
    res.json({ token, user: safe });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticateToken, (req, res) => {
  const { password: _, ...safe } = req.user;
  res.json(safe);
});

export default router;
