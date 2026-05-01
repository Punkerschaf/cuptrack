import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { machines, terminals, logs } from '../dal.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { createTerminalSchema, updateTerminalSchema } from '../validators/index.js';

const router = Router();
router.use(authenticateToken, requireAdmin);

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[äöüß]/g, c => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[c] || c)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// List all terminals (with machine info)
router.get('/', (_req, res) => {
  res.json(terminals.findAll());
});

// Get single terminal
router.get('/:id', (req, res) => {
  const terminal = terminals.findByIdWithMachine(req.params.id);
  if (!terminal) return res.status(404).json({ error: 'Terminal nicht gefunden' });
  res.json(terminal);
});

// Get terminal activity log
router.get('/:id/log', (req, res) => {
  res.json(logs.findByTerminalId(req.params.id));
});

// Create terminal
router.post('/', (req, res, next) => {
  try {
    const data = createTerminalSchema.parse(req.body);
    const machine = machines.findById(data.machineId);
    if (!machine) return res.status(404).json({ error: 'Maschine nicht gefunden' });

    const slug = generateSlug(data.name);
    if (terminals.slugExists(slug)) {
      return res.status(409).json({ error: 'Terminal-Name existiert bereits' });
    }

    const now = new Date().toISOString();
    const created = terminals.create({
      id: uuidv4(),
      name: data.name,
      slug,
      machineId: data.machineId,
      type: 'web',
      quickButtonsEnabled: 0,
      quickButton1: 5,
      quickButton2: 10,
      alphabetFilterEnabled: 1,
      createdAt: now,
      updatedAt: now,
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// Update terminal
router.put('/:id', (req, res, next) => {
  try {
    const data = updateTerminalSchema.parse(req.body);
    const terminal = terminals.findById(req.params.id);
    if (!terminal) return res.status(404).json({ error: 'Terminal nicht gefunden' });

    const updates = {};

    if (data.quickButtons !== undefined) {
      updates.quickButtonsEnabled = data.quickButtons.enabled ? 1 : 0;
      updates.quickButton1 = data.quickButtons.button1 || 5;
      updates.quickButton2 = data.quickButtons.button2 || 10;
    }
    if (data.alphabetFilter !== undefined) {
      updates.alphabetFilterEnabled = data.alphabetFilter.enabled ? 1 : 0;
    }
    if (data.pinChangeEnabled !== undefined) {
      updates.pinChangeEnabled = data.pinChangeEnabled ? 1 : 0;
    }
    if (data.selfRegistrationEnabled !== undefined) {
      updates.selfRegistrationEnabled = data.selfRegistrationEnabled ? 1 : 0;
    }
    if (data.name !== undefined) {
      const slug = generateSlug(data.name);
      if (terminals.slugExists(slug, req.params.id)) {
        return res.status(409).json({ error: 'Terminal-Name existiert bereits' });
      }
      updates.name = data.name;
      updates.slug = slug;
    }
    if (data.machineId !== undefined) {
      const machine = machines.findById(data.machineId);
      if (!machine) return res.status(404).json({ error: 'Maschine nicht gefunden' });
      updates.machineId = data.machineId;
    }
    updates.updatedAt = new Date().toISOString();

    const updated = terminals.update(req.params.id, updates);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Delete terminal
router.delete('/:id', (req, res) => {
  if (!terminals.exists(req.params.id)) {
    return res.status(404).json({ error: 'Terminal nicht gefunden' });
  }
  terminals.delete(req.params.id);
  res.json({ success: true });
});

export default router;
