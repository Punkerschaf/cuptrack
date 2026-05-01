import jwt from 'jsonwebtoken';
import config from '../config.js';
import { users } from '../dal.js';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token erforderlich' });

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = users.findById(decoded.userId);
    if (!user) return res.status(401).json({ error: 'Benutzer nicht gefunden' });
    req.user = user;
    next();
  } catch {
    return res.status(403).json({ error: 'Ungültiges Token' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin-Zugang erforderlich' });
  }
  next();
}
