import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { users, logs } from '../dal.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { createUserSchema, updateUserSchema } from '../validators/index.js';

const router = Router();
router.use(authenticateToken, requireAdmin);

// List all users
router.get('/', (_req, res) => {
  res.json(users.findAll());
});

// Get single user
router.get('/:id', (req, res) => {
  const user = users.findByIdSafe(req.params.id);
  if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  res.json(user);
});

// Get user activity log
router.get('/:id/log', (req, res) => {
  res.json(logs.findByUserId(req.params.id));
});

// Create user
router.post('/', async (req, res, next) => {
  try {
    const { username, displayName, password, type, pin: providedPin } = createUserSchema.parse(req.body);

    if (type !== 'api' && !password) {
      return res.status(400).json({ error: 'Passwort erforderlich für diesen Benutzertyp' });
    }
    if (users.usernameExists(username)) {
      return res.status(409).json({ error: 'Benutzername existiert bereits' });
    }

    const identifiers = [];

    // Use provided PIN or auto-generate a unique one for drinkers
    if (type === 'drinker') {
      let pin;
      if (providedPin) {
        if (users.pinExists(providedPin)) {
          return res.status(409).json({ error: 'PIN wird bereits verwendet' });
        }
        pin = providedPin;
      } else {
        do {
          pin = String(Math.floor(1000 + Math.random() * 9000));
        } while (users.pinExists(pin));
      }
      identifiers.push({ id: uuidv4(), type: 'pin', value: pin });
    }

    const now = new Date().toISOString();
    const newUser = {
      id: uuidv4(),
      username,
      displayName,
      password: type !== 'api' ? await bcrypt.hash(password, 10) : null,
      type,
      isRoot: false,
      balance: 0,
      apiKey: type === 'api' ? crypto.randomBytes(32).toString('hex') : null,
      createdAt: now,
      updatedAt: now,
      identifiers,
    };

    const created = users.create(newUser);

    logs.create({
      id: uuidv4(),
      type: 'user_created',
      userId: created.id,
      machineId: null,
      terminalId: null,
      details: { createdBy: req.user.id, userType: type },
      createdAt: now,
    });

    const { password: _, ...safe } = created;
    res.status(201).json(safe);
  } catch (err) {
    next(err);
  }
});

// Update user
router.put('/:id', async (req, res, next) => {
  try {
    const data = updateUserSchema.parse(req.body);
    const user = users.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    if (user.isRoot) {
      return res.status(403).json({ error: 'Root-Benutzer kann nicht über die UI bearbeitet werden' });
    }

    const updates = {};
    if (data.displayName !== undefined) updates.displayName = data.displayName;
    if (data.password) updates.password = await bcrypt.hash(data.password, 10);
    if (data.balance !== undefined && user.type === 'drinker') {
      const oldBalance = user.balance;
      updates.balance = data.balance;
      logs.create({
        id: uuidv4(),
        type: 'balance',
        userId: user.id,
        machineId: null,
        terminalId: null,
        details: { oldBalance, newBalance: data.balance, method: 'admin' },
        createdAt: new Date().toISOString(),
      });
    }
    if (data.identifiers !== undefined && user.type === 'drinker') {
      const pinCount = data.identifiers.filter(i => i.type === 'pin').length;
      if (pinCount > 1) {
        return res.status(400).json({ error: 'Nur ein PIN-Identifier pro Benutzer erlaubt' });
      }
      users.replaceIdentifiers(user.id, data.identifiers);
    }
    updates.updatedAt = new Date().toISOString();

    const updated = users.update(req.params.id, updates);
    const { password: _, ...safe } = updated;
    res.json(safe);
  } catch (err) {
    next(err);
  }
});

// Delete user
router.delete('/:id', (req, res) => {
  const user = users.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  if (user.isRoot) return res.status(403).json({ error: 'Root-Benutzer kann nicht gelöscht werden' });
  if (user.id === req.user.id) return res.status(403).json({ error: 'Eigenen Account kann man nicht löschen' });

  users.delete(req.params.id);

  logs.create({
    id: uuidv4(),
    type: 'user_deleted',
    userId: req.params.id,
    machineId: null,
    terminalId: null,
    details: { deletedBy: req.user.id, username: user.username },
    createdAt: new Date().toISOString(),
  });

  res.json({ success: true });
});

export default router;
