import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import config from '../config.js';
import db from '../db.js';

const router = Router();

// Get terminal info + eligible users (public – no JWT required)
router.get('/:slug', (req, res) => {
  const terminal = db.data.terminals.find(t => t.slug === req.params.slug);
  if (!terminal) return res.status(404).json({ error: 'Terminal nicht gefunden' });

  const machine = db.data.machines.find(m => m.id === terminal.machineId);

  const users = db.data.users
    .filter(u => u.type === 'drinker' && u.identifiers.some(i => i.type === 'pin' || i.type === 'kaba_nfc'))
    .map(u => ({ id: u.id, displayName: u.displayName }));

  res.json({
    terminal: { id: terminal.id, name: terminal.name, slug: terminal.slug },
    machine: machine
      ? { id: machine.id, name: machine.name, room: machine.room, pricePerCoffee: machine.pricePerCoffee }
      : null,
    users,
  });
});

// Verify NFC serial number → returns short-lived session token (no PIN needed)
router.post('/:slug/verify-nfc', (req, res) => {
  const { serialNumber } = req.body;
  if (!serialNumber || typeof serialNumber !== 'string') {
    return res.status(400).json({ error: 'Seriennummer erforderlich' });
  }

  const terminal = db.data.terminals.find(t => t.slug === req.params.slug);
  if (!terminal) return res.status(404).json({ error: 'Terminal nicht gefunden' });

  // Normalize: lowercase, trimmed
  const normalized = serialNumber.toLowerCase().trim();

  const user = db.data.users.find(
    u => u.type === 'drinker' &&
      u.identifiers.some(i => i.type === 'kaba_nfc' && i.value.toLowerCase().trim() === normalized),
  );
  if (!user) return res.status(404).json({ error: 'Kein Benutzer mit dieser NFC-Seriennummer gefunden' });

  const sessionToken = jwt.sign(
    { userId: user.id, terminalId: terminal.id, purpose: 'terminal-session' },
    config.jwtSecret,
    { expiresIn: '5m' },
  );

  res.json({
    success: true,
    sessionToken,
    user: { id: user.id, displayName: user.displayName, balance: user.balance },
  });
});

// Verify PIN → returns short-lived session token
router.post('/:slug/verify-pin', (req, res) => {
  const { userId, pin } = req.body;
  const terminal = db.data.terminals.find(t => t.slug === req.params.slug);
  if (!terminal) return res.status(404).json({ error: 'Terminal nicht gefunden' });

  const user = db.data.users.find(u => u.id === userId && u.type === 'drinker');
  if (!user) return res.status(404).json({ error: 'Benutzer nicht gefunden' });

  const pinMatch = user.identifiers.find(i => i.type === 'pin' && i.value === pin);
  if (!pinMatch) return res.status(401).json({ error: 'Ungültige PIN' });

  const sessionToken = jwt.sign(
    { userId: user.id, terminalId: terminal.id, purpose: 'terminal-session' },
    config.jwtSecret,
    { expiresIn: '5m' },
  );

  res.json({
    success: true,
    sessionToken,
    user: { id: user.id, displayName: user.displayName, balance: user.balance },
  });
});

// Helper: validate terminal session token
function verifySession(req, res) {
  const { sessionToken } = req.body;
  if (!sessionToken) {
    res.status(401).json({ error: 'Session-Token erforderlich' });
    return null;
  }
  try {
    const decoded = jwt.verify(sessionToken, config.jwtSecret);
    if (decoded.purpose !== 'terminal-session') throw new Error('Invalid purpose');

    const terminal = db.data.terminals.find(t => t.slug === req.params.slug);
    if (!terminal || terminal.id !== decoded.terminalId) {
      res.status(403).json({ error: 'Ungültige Session' });
      return null;
    }
    const user = db.data.users.find(u => u.id === decoded.userId);
    if (!user) {
      res.status(404).json({ error: 'Benutzer nicht gefunden' });
      return null;
    }
    return { terminal, user };
  } catch {
    res.status(403).json({ error: 'Session abgelaufen oder ungültig' });
    return null;
  }
}

// Count coffee
router.post('/:slug/count-coffee', async (req, res) => {
  const session = verifySession(req, res);
  if (!session) return;

  const { terminal, user } = session;
  const machine = db.data.machines.find(m => m.id === terminal.machineId);
  if (!machine) return res.status(500).json({ error: 'Maschine nicht gefunden' });

  user.balance -= machine.pricePerCoffee;
  user.updatedAt = new Date().toISOString();

  db.data.logs.push({
    id: uuidv4(),
    type: 'coffee',
    userId: user.id,
    machineId: machine.id,
    terminalId: terminal.id,
    details: { price: machine.pricePerCoffee, balanceAfter: user.balance },
    createdAt: new Date().toISOString(),
  });

  await db.write();
  res.json({ success: true, newBalance: user.balance });
});

// Update balance
router.post('/:slug/update-balance', async (req, res) => {
  const session = verifySession(req, res);
  if (!session) return;

  const { user, terminal } = session;
  const { amount } = req.body;
  if (amount === undefined || isNaN(parseFloat(amount))) {
    return res.status(400).json({ error: 'Betrag erforderlich' });
  }

  const oldBalance = user.balance;
  user.balance = parseFloat(amount);
  user.updatedAt = new Date().toISOString();

  db.data.logs.push({
    id: uuidv4(),
    type: 'balance',
    userId: user.id,
    machineId: null,
    terminalId: terminal.id,
    details: { oldBalance, newBalance: user.balance, method: 'terminal' },
    createdAt: new Date().toISOString(),
  });

  await db.write();
  res.json({ success: true, newBalance: user.balance });
});

export default router;
