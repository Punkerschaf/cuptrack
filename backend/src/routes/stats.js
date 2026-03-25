import { Router } from 'express';
import { logs, users, machines, terminals, archivedStats } from '../dal.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken, requireAdmin);

router.get('/dashboard', (_req, res) => {
  const now = new Date();
  const archived = archivedStats.get();

  // Coffees today
  const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    .toISOString()
    .split('T')[0];
  const coffeesToday = logs.countCoffeesForDate(todayStr);

  // Total coffees (current + archived) — we need the count of current coffee logs
  const currentCoffeeCounts = logs.coffeeCountsByUser();
  const currentTotal = currentCoffeeCounts.reduce((sum, row) => sum + row.count, 0);
  const totalCoffees = currentTotal + archived.totalCoffees;

  // Coffees per day (last 30 days)
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 29);
  const startDateStr = startDate.toISOString().split('T')[0];

  const dbCoffeesPerDay = logs.coffeesPerDay(startDateStr);
  const dayMap = {};
  for (const row of dbCoffeesPerDay) dayMap[row.date] = row.count;

  const coffeesPerDay = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayStr = date.toISOString().split('T')[0];
    coffeesPerDay.push({ date: dayStr, count: dayMap[dayStr] || 0 });
  }

  // Top drinkers (current + archived)
  const drinkerCounts = { ...archived.coffeesByUser };
  for (const row of currentCoffeeCounts) {
    drinkerCounts[row.userId] = (drinkerCounts[row.userId] || 0) + row.count;
  }
  const allUsers = users.findAll();
  const userMap = {};
  for (const u of allUsers) userMap[u.id] = u.displayName;

  const topDrinkers = Object.entries(drinkerCounts)
    .map(([userId, count]) => ({
      userId,
      displayName: userMap[userId] || 'Unbekannt',
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Popular machines (current + archived)
  const machineCounts = { ...archived.coffeesByMachine };
  for (const row of logs.coffeeCountsByMachine()) {
    machineCounts[row.machineId] = (machineCounts[row.machineId] || 0) + row.count;
  }
  const allMachines = machines.findAll();
  const machineMap = {};
  for (const m of allMachines) machineMap[m.id] = m.name;

  const popularMachines = Object.entries(machineCounts)
    .map(([machineId, count]) => ({
      machineId,
      name: machineMap[machineId] || 'Unbekannt',
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Totals
  const totalUsers = users.countDrinkers();
  const totalMachines = machines.count();
  const totalTerminals = terminals.count();

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
