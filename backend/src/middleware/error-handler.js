import { ZodError } from 'zod';

export function errorHandler(logger) {
  return (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      const messages = err.errors.map(e => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }

    logger.error({ err: err.message, stack: err.stack }, 'Unerwarteter Fehler');
    res.status(500).json({ error: 'Interner Serverfehler' });
  };
}
