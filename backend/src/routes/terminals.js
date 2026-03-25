import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken, requireAdmin);

// List all terminals (with machine info)
router.get('/', (req, res) => {
  const terminals = db.data.terminals.map(t => {
    const machine = db.data.machines.find(m => m.id === t.machineId);
    return { ...t, machine: machine || null };
  });
  res.json(terminals);
});

// Get single terminal
router.get('/:id', (req, res) => {
  const terminal = db.data.terminals.find(t => t.id === req.params.id);
  if (!terminal) return res.status(404).json({ error: 'Terminal nicht gefunden' });
  const machine = db.data.machines.find(m => m.id === terminal.machineId);
  res.json({ ...terminal, machine: machine || null });
});

// Get terminal activity log
router.get('/:id/log', (req, res) => {
  const logs = db.data.logs.filter(l => l.terminalId === req.params.id);
  res.json(logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// Create terminal
router.post('/', async (req, res) => {
  const { name, machineId } = req.body;
  if (!name || !machineId) {
    return res.status(400).json({ error: 'Name und Maschine erforderlich' });
  }
  const machine = db.data.machines.find(m => m.id === machineId);
  if (!machine) return res.status(404).json({ error: 'Maschine nicht gefunden' });

  const slug = name
    .toLowerCase()
    .replace(/[äöüß]/g, c => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[c] || c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  if (db.data.terminals.some(t => t.slug === slug)) {
    return res.status(409).json({ error: 'Terminal-Name existiert bereits' });
  }

  const terminal = {
    id: uuidv4(),
    name,
    slug,
    machineId,
    type: 'web',
    quickButtons: { enabled: false, button1: 5, button2: 10 },
    alphabetFilter: { enabled: true },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.data.terminals.push(terminal);
  await db.write();
  res.status(201).json({ ...terminal, machine });
});

// Update terminal
router.put('/:id', async (req, res) => {
  const terminal = db.data.terminals.find(t => t.id === req.params.id);
  if (!terminal) return res.status(404).json({ error: 'Terminal nicht gefunden' });

  const { name, machineId, quickButtons, alphabetFilter } = req.body;
  if (quickButtons !== undefined) {
    terminal.quickButtons = {
      enabled: !!quickButtons.enabled,
      button1: parseFloat(quickButtons.button1) || 5,
      button2: parseFloat(quickButtons.button2) || 10,
    };
  }
  if (alphabetFilter !== undefined) {
    terminal.alphabetFilter = {
      enabled: !!alphabetFilter.enabled,
    };
  }
  if (name !== undefined) {
    const slug = name
      .toLowerCase()
      .replace(/[äöüß]/g, c => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[c] || c)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    if (db.data.terminals.some(t => t.slug === slug && t.id !== req.params.id)) {
      return res.status(409).json({ error: 'Terminal-Name existiert bereits' });
    }
    terminal.name = name;
    terminal.slug = slug;
  }
  if (machineId !== undefined) {
    const machine = db.data.machines.find(m => m.id === machineId);
    if (!machine) return res.status(404).json({ error: 'Maschine nicht gefunden' });
    terminal.machineId = machineId;
  }
  terminal.updatedAt = new Date().toISOString();

  await db.write();
  const machine = db.data.machines.find(m => m.id === terminal.machineId);
  res.json({ ...terminal, machine: machine || null });
});

// Delete terminal
router.delete('/:id', async (req, res) => {
  if (!db.data.terminals.some(t => t.id === req.params.id)) {
    return res.status(404).json({ error: 'Terminal nicht gefunden' });
  }
  db.data.terminals = db.data.terminals.filter(t => t.id !== req.params.id);
  await db.write();
  res.json({ success: true });
});

export default router;
