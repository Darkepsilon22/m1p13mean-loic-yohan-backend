const { getRedis } = require('../config');

/**
 * Middleware de cache Redis pour les routes GET
 * @param {number} ttl - Durée du cache en secondes (défaut 60s)
 */
const cache = (ttl = 60) => {
  return async (req, res, next) => {
    const client = getRedis();
    if (!client || req.method !== 'GET') return next();

    const key = `cache:${req.originalUrl}`;

    try {
      const cached = await client.get(key);
      if (cached) {
        return res.status(200).json(JSON.parse(cached));
      }
    } catch (err) {
      // Redis down — continue sans cache
    }

    // Intercepter res.json pour mettre en cache la réponse
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode === 200 && client) {
        client.setex(key, ttl, JSON.stringify(data)).catch(() => {});
      }
      return originalJson(data);
    };

    next();
  };
};

/**
 * Invalider le cache pour un pattern de clés
 * @param {string} pattern - ex: 'cache:/api/products*'
 */
const invalidateCache = async (pattern) => {
  const client = getRedis();
  if (!client) return;

  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch (err) {
    // Silently fail
  }
};

module.exports = { cache, invalidateCache };
