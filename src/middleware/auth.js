import { logger } from '../utils/logger.js';

let warnedNoApiKey = false;

/**
 * Gates a route behind an `x-api-key` header matching API_KEY.
 *
 * API_KEY is optional: when unset the middleware is a no-op (with a one-time
 * startup warning), so local development and the existing test suite keep
 * working without configuring a key.
 */
export function requireApiKey(req, res, next) {
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    if (!warnedNoApiKey) {
      logger.warn('API_KEY is not set - proxy and dashboard routes are unauthenticated. Set API_KEY to require an x-api-key header.');
      warnedNoApiKey = true;
    }
    return next();
  }

  const provided = req.get('x-api-key');
  if (!provided || provided !== apiKey) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid x-api-key header' });
  }

  next();
}
