import { Router } from 'express';
import db from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken, requireAdmin);

router.get('/dashboard', (req, res) => {
  const now = new Date();
  const coffeeLogs = db.data.logs.filter(l => l.type === 'coffee');

  // Total coffees
  const totalCoffees = coffeeLogs.length;

  // Coffees today
  const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    .toISOString()
    .split('T')[0];
  const coffeesToday = coffeeLogs.filter(l => l.createdAt.startsWith(todayStr)).length;

  // Coffees per day (last 30 days)
  const coffeesPerDay = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayStr = date.toISOString().split('T')[0];
    const count = coffeeLogs.filter(l => l.createdAt.startsWith(dayStr)).length;
    coffeesPerDay.push({ date: dayStr, count });
  }

  // Top drinkers
  const drinkerCounts = {};
  coffeeLogs.forEach(l => {
    drinkerCounts[l.userId] = (drinkerCounts[l.userId] || 0) + 1;
  });
  const topDrinkers = Object.entries(drinkerCounts)
    .map(([userId, count]) => {
      const user = db.data.users.find(u => u.id === userId);
      return { userId, displayName: user?.displayName || 'Unbekannt', count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Popular machines
  const machineCounts = {};
  coffeeLogs.forEach(l => {
    if (l.machineId) machineCounts[l.machineId] = (machineCounts[l.machineId] || 0) + 1;
  });
  const popularMachines = Object.entries(machineCounts)
    .map(([machineId, count]) => {
      const machine = db.data.machines.find(m => m.id === machineId);
      return { machineId, name: machine?.name || 'Unbekannt', count };
    })
    .sort((a, b) => b.count - a.count);

  // Totals
  const totalUsers = db.data.users.filter(u => u.type === 'drinker').length;
  const totalMachines = db.data.machines.length;
  const totalTerminals = db.data.terminals.length;

  res.json({
    totalCoffees,
    coffeesToday,
    coffeesPerDay,
    topDrinkers,
    popularMachines,
    totalUsers,
    totalMachines,
    totalTerminals,
  });
});

export default router;
