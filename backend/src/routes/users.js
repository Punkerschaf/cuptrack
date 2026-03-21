import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import db from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken, requireAdmin);

// List all users
router.get('/', (req, res) => {
  const users = db.data.users.map(({ password, ...u }) => u);
  res.json(users);
});

// Get single user
router.get('/:id', (req, res) => {
  const user = db.data.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  const { password, ...safe } = user;
  res.json(safe);
});

// Get user activity log
router.get('/:id/log', (req, res) => {
  const logs = db.data.logs.filter(l => l.userId === req.params.id);
  res.json(logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// Create user
router.post('/', async (req, res) => {
  const { username, displayName, password, type } = req.body;
  if (!username || !displayName || !type) {
    return res.status(400).json({ error: 'username, displayName und type erforderlich' });
  }
  if (!['admin', 'api', 'drinker'].includes(type)) {
    return res.status(400).json({ error: 'Ungültiger Benutzertyp' });
  }
  if (type !== 'api' && !password) {
    return res.status(400).json({ error: 'Passwort erforderlich für diesen Benutzertyp' });
  }
  if (db.data.users.some(u => u.username === username)) {
    return res.status(409).json({ error: 'Benutzername existiert bereits' });
  }

  const newUser = {
    id: uuidv4(),
    username,
    displayName,
    password: type !== 'api' ? await bcrypt.hash(password, 10) : null,
    type,
    isRoot: false,
    balance: 0,
    identifiers: [],
    apiKey: type === 'api' ? crypto.randomBytes(32).toString('hex') : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Auto-generate a unique PIN for drinkers
  if (type === 'drinker') {
    let pin;
    do {
      pin = String(Math.floor(1000 + Math.random() * 9000));
    } while (
      db.data.users.some(u =>
        u.identifiers.some(i => i.type === 'pin' && i.value === pin)
      )
    );
    newUser.identifiers.push({ id: uuidv4(), type: 'pin', value: pin });
  }

  db.data.users.push(newUser);

  db.data.logs.push({
    id: uuidv4(),
    type: 'user_created',
    userId: newUser.id,
    machineId: null,
    terminalId: null,
    details: { createdBy: req.user.id, userType: type },
    createdAt: new Date().toISOString(),
  });

  await db.write();
  const { password: _, ...safe } = newUser;
  res.status(201).json(safe);
});

// Update user
router.put('/:id', async (req, res) => {
  const idx = db.data.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Benutzer nicht gefunden' });

  const user = db.data.users[idx];

  if (user.isRoot) {
    return res.status(403).json({ error: 'Root-Benutzer kann nicht über die UI bearbeitet werden' });
  }

  const { displayName, password, balance, identifiers } = req.body;

  if (displayName !== undefined) user.displayName = displayName;
  if (password) user.password = await bcrypt.hash(password, 10);
  if (balance !== undefined && user.type === 'drinker') {
    const oldBalance = user.balance;
    user.balance = parseFloat(balance);
    db.data.logs.push({
      id: uuidv4(),
      type: 'balance',
      userId: user.id,
      machineId: null,
      terminalId: null,
      details: { oldBalance, newBalance: user.balance, method: 'admin' },
      createdAt: new Date().toISOString(),
    });
  }
  if (identifiers !== undefined && user.type === 'drinker') user.identifiers = identifiers;
  user.updatedAt = new Date().toISOString();

  await db.write();
  const { password: _, ...safe } = user;
  res.json(safe);
});

// Delete user
router.delete('/:id', async (req, res) => {
  const user = db.data.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  if (user.isRoot) return res.status(403).json({ error: 'Root-Benutzer kann nicht gelöscht werden' });
  if (user.id === req.user.id) return res.status(403).json({ error: 'Eigenen Account kann man nicht löschen' });

  db.data.users = db.data.users.filter(u => u.id !== req.params.id);

  db.data.logs.push({
    id: uuidv4(),
    type: 'user_deleted',
    userId: req.params.id,
    machineId: null,
    terminalId: null,
    details: { deletedBy: req.user.id, username: user.username },
    createdAt: new Date().toISOString(),
  });

  await db.write();
  res.json({ success: true });
});

export default router;
