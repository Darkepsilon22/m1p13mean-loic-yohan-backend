/**
 * Role-based access control middleware
 * Must be used after verifyToken middleware
 */

/**
 * Check if user has one of the allowed roles
 * @param {...string} allowedRoles - Roles that are allowed to access the route
 * @returns {Function} Express middleware function
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // Check if user is attached to request (should be done by verifyToken)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Check if user's role is in the allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This action requires one of these roles: ${allowedRoles.join(', ')}.`
      });
    }

    next();
  };
};

/**
 * Check if user is an admin
 */
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin role required.'
    });
  }

  next();
};

/**
 * Check if user is a boutique owner
 */
const isBoutique = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (req.user.role !== 'boutique') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Boutique role required.'
    });
  }

  next();
};

/**
 * Check if user is an acheteur (buyer)
 */
const isAcheteur = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (req.user.role !== 'acheteur') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Acheteur role required.'
    });
  }

  next();
};

/**
 * Check if user is admin or the resource owner
 * Useful for routes where users can edit their own resources
 * @param {string} userIdParam - Name of the URL parameter containing the user ID
 */
const isAdminOrOwner = (userIdParam = 'id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const resourceUserId = req.params[userIdParam];
    const isOwner = req.user._id.toString() === resourceUserId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own resources.'
      });
    }

    next();
  };
};

/**
 * Check if user is admin or boutique
 * For routes accessible to both admins and boutique owners
 */
const isAdminOrBoutique = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'boutique') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Boutique role required.'
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
