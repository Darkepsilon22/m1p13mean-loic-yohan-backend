const rateLimit = require('express-rate-limit');

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
  legacyHeaders: false
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
  legacyHeaders: false
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
  legacyHeaders: false
});

module.exports = { authLimiter, otpLimiter, apiLimiter };
