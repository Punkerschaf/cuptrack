import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { cashBook, logs } from '../dal.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { cashBookEntrySchema } from '../validators/index.js';

const router = Router();
router.use(authenticateToken, requireAdmin);

// Get all cash book entries (newest first)
router.get('/', (_req, res) => {
  res.json(cashBook.findAll());
});

// Get current balance (computed from all entries)
router.get('/balance', (_req, res) => {
  res.json({ balance: cashBook.computeBalance() });
});

// Create deposit
router.post('/deposit', (req, res, next) => {
  try {
    const { amount, comment } = cashBookEntrySchema.parse(req.body);

    const entry = cashBook.create({
      id: uuidv4(),
      type: 'deposit',
      amount: Math.round(amount * 100) / 100,
      comment,
      machineId: null,
      terminalId: null,
      performedBy: req.user.id,
      createdAt: new Date().toISOString(),
    });

    logs.create({
      id: uuidv4(),
      type: 'cashbook',
      userId: req.user.id,
      machineId: null,
      terminalId: null,
      details: { action: 'deposit', amount: entry.amount, comment: entry.comment },
      createdAt: entry.createdAt,
    });

    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

// Create withdrawal
router.post('/withdrawal', (req, res, next) => {
  try {
    const { amount, comment } = cashBookEntrySchema.parse(req.body);

    const entry = cashBook.create({
      id: uuidv4(),
      type: 'withdrawal',
      amount: Math.round(amount * 100) / 100,
      comment,
      machineId: null,
      terminalId: null,
      performedBy: req.user.id,
      createdAt: new Date().toISOString(),
    });

    logs.create({
      id: uuidv4(),
      type: 'cashbook',
      userId: req.user.id,
      machineId: null,
      terminalId: null,
      details: { action: 'withdrawal', amount: entry.amount, comment: entry.comment },
      createdAt: entry.createdAt,
    });

    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

// Delete entry (only manual deposit/withdrawal, not anonymous_coffee)
router.delete('/:id', (req, res) => {
  const entry = cashBook.findById(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Eintrag nicht gefunden' });

  if (entry.type === 'anonymous_coffee') {
    return res.status(403).json({ error: 'Gast-Kaffee-Einträge können nicht gelöscht werden' });
  }

  cashBook.delete(req.params.id);

  logs.create({
    id: uuidv4(),
    type: 'cashbook',
    userId: req.user.id,
    machineId: null,
    terminalId: null,
    details: { action: 'delete', deletedEntry: { type: entry.type, amount: entry.amount, comment: entry.comment } },
    createdAt: new Date().toISOString(),
  });

  res.json({ success: true });
});

export default router;
