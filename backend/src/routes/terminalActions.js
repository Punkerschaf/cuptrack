import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import config from '../config.js';
import { users, machines, terminals, logs, cashBook } from '../dal.js';
import { verifyPinSchema, verifyNfcSchema, sessionTokenSchema, updateBalanceSchema, changePinSchema, registerUserSchema } from '../validators/index.js';

const router = Router();

// Get terminal info + eligible users (public – no JWT required)
router.get('/:slug', (req, res) => {
  const terminal = terminals.findBySlug(req.params.slug);
  if (!terminal) return res.status(404).json({ error: 'Terminal nicht gefunden' });

  const machine = machines.findById(terminal.machineId);
  const eligibleUsers = users.findDrinkersForTerminal();

  res.json({
    terminal: {
      id: terminal.id,
      name: terminal.name,
      slug: terminal.slug,
      quickButtons: terminal.quickButtons || { enabled: false, button1: 5, button2: 10 },
      alphabetFilter: terminal.alphabetFilter || { enabled: true },
      pinChangeEnabled: terminal.pinChangeEnabled ?? false,
      selfRegistrationEnabled: terminal.selfRegistrationEnabled ?? false,
    },
    machine: machine
      ? { id: machine.id, name: machine.name, room: machine.room, pricePerCoffee: machine.pricePerCoffee }
      : null,
    users: eligibleUsers,
  });
});

// Verify NFC serial number → returns short-lived session token (no PIN needed)
router.post('/:slug/verify-nfc', (req, res, next) => {
  try {
    const { serialNumber } = verifyNfcSchema.parse(req.body);

    const terminal = terminals.findBySlug(req.params.slug);
    if (!terminal) return res.status(404).json({ error: 'Terminal nicht gefunden' });

    const user = users.findByNfcSerial(serialNumber);
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
  } catch (err) {
    next(err);
  }
});

// Verify PIN → returns short-lived session token
router.post('/:slug/verify-pin', (req, res, next) => {
  try {
    const { userId, pin } = verifyPinSchema.parse(req.body);

    const terminal = terminals.findBySlug(req.params.slug);
    if (!terminal) return res.status(404).json({ error: 'Terminal nicht gefunden' });

    const user = users.findById(userId);
    if (!user || user.type !== 'drinker') return res.status(404).json({ error: 'Benutzer nicht gefunden' });

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
  } catch (err) {
    next(err);
  }
});

// Anonymous coffee (guest – no auth required)
router.post('/:slug/anonymous-coffee', (req, res) => {
  const terminal = terminals.findBySlug(req.params.slug);
  if (!terminal) return res.status(404).json({ error: 'Terminal nicht gefunden' });

  const machine = machines.findById(terminal.machineId);
  if (!machine) return res.status(500).json({ error: 'Maschine nicht gefunden' });

  const price = machine.pricePerCoffee;
  const now = new Date().toISOString();

  cashBook.create({
    id: uuidv4(),
    type: 'anonymous_coffee',
    amount: price,
    comment: '',
    machineId: machine.id,
    terminalId: terminal.id,
    performedBy: 'terminal',
    createdAt: now,
  });

  logs.create({
    id: uuidv4(),
    type: 'anonymous_coffee',
    userId: null,
    machineId: machine.id,
    terminalId: terminal.id,
    details: { price },
    createdAt: now,
  });

  res.json({ success: true, price });
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

    const terminal = terminals.findBySlug(req.params.slug);
    if (!terminal || terminal.id !== decoded.terminalId) {
      res.status(403).json({ error: 'Ungültige Session' });
      return null;
    }
    const user = users.findById(decoded.userId);
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
router.post('/:slug/count-coffee', (req, res) => {
  const session = verifySession(req, res);
  if (!session) return;

  const { terminal, user } = session;
  const machine = machines.findById(terminal.machineId);
  if (!machine) return res.status(500).json({ error: 'Maschine nicht gefunden' });

  const newBalance = user.balance - machine.pricePerCoffee;
  const now = new Date().toISOString();

  users.update(user.id, { balance: newBalance, updatedAt: now });

  logs.create({
    id: uuidv4(),
    type: 'coffee',
    userId: user.id,
    machineId: machine.id,
    terminalId: terminal.id,
    details: { price: machine.pricePerCoffee, balanceAfter: newBalance },
    createdAt: now,
  });

  res.json({ success: true, newBalance });
});

// Update balance
router.post('/:slug/update-balance', (req, res, next) => {
  try {
    const session = verifySession(req, res);
    if (!session) return;

    const { user, terminal } = session;
    const { amount, mode } = req.body;

    const oldBalance = user.balance;
    let newBalance;

    if (mode === 'reset') {
      newBalance = 0;
    } else {
      if (amount === undefined || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ error: 'Gültiger Betrag erforderlich' });
      }
      newBalance = oldBalance + parseFloat(amount);
    }

    const now = new Date().toISOString();
    users.update(user.id, { balance: newBalance, updatedAt: now });

    logs.create({
      id: uuidv4(),
      type: 'balance',
      userId: user.id,
      machineId: null,
      terminalId: terminal.id,
      details: { oldBalance, newBalance, method: mode === 'reset' ? 'terminal-reset' : 'terminal-add' },
      createdAt: now,
    });

    // Cash book: terminal top-ups = real money deposited into the cash box
    let cashBookAmount = 0;
    if (mode === 'reset' && oldBalance < 0) {
      cashBookAmount = Math.round(Math.abs(oldBalance) * 100) / 100;
    } else if (mode !== 'reset') {
      cashBookAmount = Math.round(parseFloat(amount) * 100) / 100;
    }

    if (cashBookAmount > 0) {
      cashBook.create({
        id: uuidv4(),
        type: 'deposit',
        amount: cashBookAmount,
        comment: '',
        machineId: null,
        terminalId: terminal.id,
        performedBy: user.id,
        createdAt: now,
      });
    }

    res.json({ success: true, newBalance });
  } catch (err) {
    next(err);
  }
});

// Check username/displayName availability (no auth required)
router.post('/:slug/check-user-availability', (req, res, next) => {
  try {
    const terminal = terminals.findBySlug(req.params.slug);
    if (!terminal) return res.status(404).json({ error: 'Terminal nicht gefunden' });
    if (!terminal.selfRegistrationEnabled) {
      return res.status(403).json({ error: 'Selbstregistrierung an diesem Terminal nicht aktiviert' });
    }

    const { username, displayName } = req.body;
    const usernameAvailable = username ? !users.usernameExists(username.trim()) : true;
    const displayNameAvailable = displayName ? !users.displayNameExists(displayName.trim()) : true;

    res.json({ usernameAvailable, displayNameAvailable });
  } catch (err) {
    next(err);
  }
});

// Change PIN (requires active session)
router.post('/:slug/change-pin', (req, res, next) => {
  try {
    const session = verifySession(req, res);
    if (!session) return;

    const { terminal, user } = session;

    if (!terminal.pinChangeEnabled) {
      return res.status(403).json({ error: 'PIN-Änderung an diesem Terminal nicht aktiviert' });
    }

    const { newPin } = changePinSchema.parse(req.body);

    users.updatePinIdentifier(user.id, newPin);

    logs.create({
      id: uuidv4(),
      type: 'pin_change',
      userId: user.id,
      machineId: null,
      terminalId: terminal.id,
      details: {},
      createdAt: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Self-register new user (no auth required)
router.post('/:slug/register-user', (req, res, next) => {
  try {
    const terminal = terminals.findBySlug(req.params.slug);
    if (!terminal) return res.status(404).json({ error: 'Terminal nicht gefunden' });

    if (!terminal.selfRegistrationEnabled) {
      return res.status(403).json({ error: 'Selbstregistrierung an diesem Terminal nicht aktiviert' });
    }

    const { username, displayName, pin } = registerUserSchema.parse(req.body);

    if (users.usernameExists(username)) {
      return res.status(409).json({ error: 'Benutzername bereits vergeben', field: 'username' });
    }
    if (users.displayNameExists(displayName)) {
      return res.status(409).json({ error: 'Anzeigename bereits vergeben', field: 'displayName' });
    }

    const now = new Date().toISOString();
    const newUser = users.create({
      id: uuidv4(),
      username,
      displayName,
      password: '',
      type: 'drinker',
      isRoot: false,
      balance: 0,
      apiKey: null,
      createdAt: now,
      updatedAt: now,
      identifiers: [{ id: uuidv4(), type: 'pin', value: pin }],
    });

    logs.create({
      id: uuidv4(),
      type: 'user_registered',
      userId: newUser.id,
      machineId: null,
      terminalId: terminal.id,
      details: { username, displayName },
      createdAt: now,
    });

    res.json({ success: true, user: { id: newUser.id, displayName: newUser.displayName } });
  } catch (err) {
    next(err);
  }
});

export default router;
