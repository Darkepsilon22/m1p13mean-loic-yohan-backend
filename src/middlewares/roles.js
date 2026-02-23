/**
 * Middleware de contrôle d'accès basé sur les rôles
 * Doit être utilisé après le middleware verifyToken
 */

/**
 * Vérifie si l'utilisateur a l'un des rôles autorisés
 * @param {...string} allowedRoles - Rôles autorisés à accéder à la route
 * @returns {Function} Fonction middleware Express
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // Vérifie si l'utilisateur est attaché à la requête (devrait être fait par verifyToken)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise.'
      });
    }

    // Vérifie si le rôle de l'utilisateur est dans les rôles autorisés
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Accès refusé. Cette action nécessite l'un de ces rôles : ${allowedRoles.join(', ')}.`
      });
    }

    next();
  };
};

/**
 * Vérifie si l'utilisateur est un administrateur
 */
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
        message: 'Authentification requise.'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Accès refusé. Rôle administrateur requis.'
    });
  }

  next();
};

/**
 * Vérifie si l'utilisateur est propriétaire d'une boutique
 */
const isBoutique = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
        message: 'Authentification requise.'
    });
  }

  if (req.user.role !== 'boutique') {
    return res.status(403).json({
      success: false,
      message: 'Accès refusé. Rôle boutique requis.'
    });
  }

  next();
};

/**
 * Vérifie si l'utilisateur est un acheteur
 */
const isAcheteur = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
        message: 'Authentification requise.'
    });
  }

  if (req.user.role !== 'acheteur') {
    return res.status(403).json({
      success: false,
      message: 'Accès refusé. Rôle acheteur requis.'
    });
  }

  next();
};

/**
 * Vérifie si l'utilisateur est administrateur ou propriétaire de la ressource
 * Utile pour les routes où les utilisateurs peuvent modifier leurs propres ressources
 * @param {string} userIdParam - Nom du paramètre URL contenant l'ID utilisateur
 */
const isAdminOrOwner = (userIdParam = 'id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise.'
      });
    }

    const resourceUserId = req.params[userIdParam];
    const isOwner = req.user._id.toString() === resourceUserId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Vous ne pouvez accéder qu\'à vos propres ressources.'
      });
    }

    next();
  };
};

/**
 * Vérifie si l'utilisateur est administrateur ou boutique
 * Pour les routes accessibles aux administrateurs et aux propriétaires de boutique
 */
const isAdminOrBoutique = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
        message: 'Authentification requise.'
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'boutique') {
    return res.status(403).json({
      success: false,
      message: 'Accès refusé. Rôle administrateur ou boutique requis.'
    });
  }

  next();
};

module.exports = {
  authorize,
  isAdmin,
  isBoutique,
  isAcheteur,
  isAdminOrOwner,
  isAdminOrBoutique
};
