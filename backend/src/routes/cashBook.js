import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken, requireAdmin);

// Get all cash book entries (newest first)
router.get('/', (req, res) => {
  const entries = [...(db.data.cashBook || [])].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );
  res.json(entries);
});

// Get current balance (computed from all entries)
router.get('/balance', (req, res) => {
  const entries = db.data.cashBook || [];
  let balance = 0;
  for (const entry of entries) {
    if (entry.type === 'deposit' || entry.type === 'anonymous_coffee') {
      balance += entry.amount;
    } else if (entry.type === 'withdrawal') {
      balance -= entry.amount;
    }
  }
  res.json({ balance: Math.round(balance * 100) / 100 });
});

// Create deposit
router.post('/deposit', async (req, res) => {
  const { amount, comment } = req.body;

  if (amount === undefined || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Gültiger Betrag erforderlich' });
  }
  if (!comment || !comment.trim()) {
    return res.status(400).json({ error: 'Kommentar erforderlich' });
  }

  const entry = {
    id: uuidv4(),
    type: 'deposit',
    amount: Math.round(parseFloat(amount) * 100) / 100,
    comment: comment.trim(),
    machineId: null,
    terminalId: null,
    performedBy: req.user.id,
    createdAt: new Date().toISOString(),
  };

  if (!db.data.cashBook) db.data.cashBook = [];
  db.data.cashBook.push(entry);

  db.data.logs.push({
    id: uuidv4(),
    type: 'cashbook',
    userId: req.user.id,
    machineId: null,
    terminalId: null,
    details: { action: 'deposit', amount: entry.amount, comment: entry.comment },
    createdAt: entry.createdAt,
  });

  await db.write();
  res.status(201).json(entry);
});

// Create withdrawal
router.post('/withdrawal', async (req, res) => {
  const { amount, comment } = req.body;

  if (amount === undefined || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Gültiger Betrag erforderlich' });
  }
  if (!comment || !comment.trim()) {
    return res.status(400).json({ error: 'Kommentar erforderlich' });
  }

  const entry = {
    id: uuidv4(),
    type: 'withdrawal',
    amount: Math.round(parseFloat(amount) * 100) / 100,
    comment: comment.trim(),
    machineId: null,
    terminalId: null,
    performedBy: req.user.id,
    createdAt: new Date().toISOString(),
  };

  if (!db.data.cashBook) db.data.cashBook = [];
  db.data.cashBook.push(entry);

  db.data.logs.push({
    id: uuidv4(),
    type: 'cashbook',
    userId: req.user.id,
    machineId: null,
    terminalId: null,
    details: { action: 'withdrawal', amount: entry.amount, comment: entry.comment },
    createdAt: entry.createdAt,
  });

  await db.write();
  res.status(201).json(entry);
});

// Delete entry (only manual deposit/withdrawal, not anonymous_coffee)
router.delete('/:id', async (req, res) => {
  const entries = db.data.cashBook || [];
  const entry = entries.find(e => e.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Eintrag nicht gefunden' });

  if (entry.type === 'anonymous_coffee') {
    return res.status(403).json({ error: 'Gast-Kaffee-Einträge können nicht gelöscht werden' });
  }

  db.data.cashBook = entries.filter(e => e.id !== req.params.id);

  db.data.logs.push({
    id: uuidv4(),
    type: 'cashbook',
    userId: req.user.id,
    machineId: null,
    terminalId: null,
    details: { action: 'delete', deletedEntry: { type: entry.type, amount: entry.amount, comment: entry.comment } },
    createdAt: new Date().toISOString(),
  });

  await db.write();
  res.json({ success: true });
});

export default router;
