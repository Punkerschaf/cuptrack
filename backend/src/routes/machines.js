import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { machines, terminals, logs } from '../dal.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { createMachineSchema, updateMachineSchema } from '../validators/index.js';

const router = Router();
router.use(authenticateToken, requireAdmin);

// List all machines
router.get('/', (_req, res) => {
  res.json(machines.findAll());
});

// Get single machine
router.get('/:id', (req, res) => {
  const machine = machines.findById(req.params.id);
  if (!machine) return res.status(404).json({ error: 'Maschine nicht gefunden' });
  res.json(machine);
});

// Get machine activity log
router.get('/:id/log', (req, res) => {
  res.json(logs.findByMachineId(req.params.id));
});

// Create machine
router.post('/', (req, res, next) => {
  try {
    const data = createMachineSchema.parse(req.body);
    const now = new Date().toISOString();
    const machine = machines.create({
      id: uuidv4(),
      name: data.name,
      room: data.room || '',
      pricePerCoffee: data.pricePerCoffee,
      createdAt: now,
      updatedAt: now,
    });
    res.status(201).json(machine);
  } catch (err) {
    next(err);
  }
});

// Update machine
router.put('/:id', (req, res, next) => {
  try {
    const data = updateMachineSchema.parse(req.body);
    const machine = machines.findById(req.params.id);
    if (!machine) return res.status(404).json({ error: 'Maschine nicht gefunden' });

    const updates = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.room !== undefined) updates.room = data.room;
    if (data.pricePerCoffee !== undefined) updates.pricePerCoffee = data.pricePerCoffee;
    updates.updatedAt = new Date().toISOString();

    const updated = machines.update(req.params.id, updates);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Delete machine
router.delete('/:id', (req, res) => {
  const machine = machines.findById(req.params.id);
  if (!machine) return res.status(404).json({ error: 'Maschine nicht gefunden' });

  if (terminals.machineInUse(req.params.id)) {
    return res.status(409).json({ error: 'Maschine wird noch von einem Terminal verwendet' });
  }

  machines.delete(req.params.id);
  res.json({ success: true });
});

export default router;
