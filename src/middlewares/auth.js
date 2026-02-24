const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Boutique = require('../models/Boutique');

/**
 * Middleware to verify JWT token
 * Extracts token from Authorization header (Bearer token)
 * Attaches user object to request if valid
 */
const verifyToken = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Extract token (remove 'Bearer ' prefix)
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user and check if still exists and is active
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Token is invalid.'
      });
    }

    // Check if user account is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: `Account is ${user.status}. Please contact administrator.`
      });
    }

    // Check if account is locked
    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(403).json({
        success: false,
        message: 'Account is temporarily locked. Please try again later.'
      });
    }

    // Attach user to request object
    req.user = user.toObject();
    req.userId = user._id;

    // If user is a boutique, attach boutiqueId
    if (user.role === 'boutique') {
      const boutique = await Boutique.findOne({ userId: user._id }).select('_id');
      if (boutique) {
        req.user.boutiqueId = boutique._id;
      }
    }

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please login again.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error during authentication.'
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't block if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (user && user.status === 'active') {
      req.user = user;
      req.userId = user._id;
    }

    next();
  } catch (error) {
    // Token invalid but we don't block - just continue without user
    next();
  }
};

module.exports = {
  verifyToken,
  optionalAuth
};
