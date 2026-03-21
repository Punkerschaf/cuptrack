import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken, requireAdmin);

// List all machines
router.get('/', (req, res) => {
  res.json(db.data.machines);
});

// Get single machine
router.get('/:id', (req, res) => {
  const machine = db.data.machines.find(m => m.id === req.params.id);
  if (!machine) return res.status(404).json({ error: 'Maschine nicht gefunden' });
  res.json(machine);
});

// Get machine activity log
router.get('/:id/log', (req, res) => {
  const logs = db.data.logs.filter(l => l.machineId === req.params.id);
  res.json(logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// Create machine
router.post('/', async (req, res) => {
  const { name, room, pricePerCoffee } = req.body;
  if (!name || pricePerCoffee === undefined) {
    return res.status(400).json({ error: 'Name und Preis pro Kaffee erforderlich' });
  }
  const machine = {
    id: uuidv4(),
    name,
    room: room || '',
    pricePerCoffee: parseFloat(pricePerCoffee),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.data.machines.push(machine);
  await db.write();
  res.status(201).json(machine);
});

// Update machine
router.put('/:id', async (req, res) => {
  const machine = db.data.machines.find(m => m.id === req.params.id);
  if (!machine) return res.status(404).json({ error: 'Maschine nicht gefunden' });

  const { name, room, pricePerCoffee } = req.body;
  if (name !== undefined) machine.name = name;
  if (room !== undefined) machine.room = room;
  if (pricePerCoffee !== undefined) machine.pricePerCoffee = parseFloat(pricePerCoffee);
  machine.updatedAt = new Date().toISOString();

  await db.write();
  res.json(machine);
});

// Delete machine
router.delete('/:id', async (req, res) => {
  const machine = db.data.machines.find(m => m.id === req.params.id);
  if (!machine) return res.status(404).json({ error: 'Maschine nicht gefunden' });

  const terminalUsingMachine = db.data.terminals.find(t => t.machineId === req.params.id);
  if (terminalUsingMachine) {
    return res.status(409).json({ error: 'Maschine wird noch von einem Terminal verwendet' });
  }

  db.data.machines = db.data.machines.filter(m => m.id !== req.params.id);
  await db.write();
  res.json({ success: true });
});

export default router;
