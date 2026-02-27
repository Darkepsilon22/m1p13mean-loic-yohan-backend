const Redis = require('ioredis');

let redisClient = null;

const connectRedis = () => {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn('[Redis] REDIS_URL non définie — Redis désactivé (fallback mémoire)');
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
      reconnectOnError(err) {
        return err.message.includes('READONLY');
      }
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Connecté avec succès');
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Erreur :', err.message);
    });

    return redisClient;
  } catch (err) {
    console.error('[Redis] Impossible de se connecter :', err.message);
    return null;
  }
};

const getRedis = () => redisClient;

module.exports = { connectRedis, getRedis };
