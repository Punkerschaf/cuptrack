import { Router } from 'express';
import db from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// GET /api/settings — public, no auth required (needed for terminal views too)
router.get('/', async (_req, res) => {
  await db.read();
  const settings = db.data.settings || { language: 'de' };
  res.json(settings);
});

// PUT /api/settings — admin only
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  const { language } = req.body;
  const allowedLanguages = ['de', 'en'];
  if (!language || !allowedLanguages.includes(language)) {
    return res.status(400).json({ error: 'Ungültige Sprache' });
  }

  await db.read();
  db.data.settings = { ...(db.data.settings || {}), language };
  await db.write();

  res.json(db.data.settings);
});

export default router;
