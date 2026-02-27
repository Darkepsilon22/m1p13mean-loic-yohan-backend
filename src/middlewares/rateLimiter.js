const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedis } = require('../config');

/**
 * Crée un store Redis si disponible, sinon fallback mémoire
 */
const createStore = (prefix) => {
  const client = getRedis();
  if (!client) return undefined; // fallback mémoire par défaut

  return new RedisStore({
    sendCommand: (...args) => client.call(...args),
    prefix: `rl:${prefix}:`
  });
};

/**
 * Rate limiter pour les routes d'authentification (login, register, forgot-password)
 * 10 tentatives par IP toutes les 15 minutes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Trop de tentatives. Réessayez dans 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('auth')
});

/**
 * Rate limiter pour l'OTP et la vérification email
 * 5 tentatives par IP toutes les 15 minutes
 */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Trop de tentatives de vérification. Réessayez dans 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('otp')
});

/**
 * Rate limiter global pour toutes les API
 * 200 requêtes par IP par minute
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: {
    success: false,
    message: 'Trop de requêtes. Réessayez dans un instant.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('api')
});

module.exports = { authLimiter, otpLimiter, apiLimiter };
