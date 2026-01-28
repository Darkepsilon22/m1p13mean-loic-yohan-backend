const { verifyToken, optionalAuth } = require('./auth');
const { authorize, isAdmin, isBoutique, isAcheteur, isAdminOrOwner, isAdminOrBoutique } = require('./roles');
const {
  handleValidationErrors,
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
  validateObjectId,
  paginationValidation
} = require('./validation');
const { ApiError, errorHandler, notFound, asyncHandler } = require('./errorHandler');

module.exports = {
  // Authentication
  verifyToken,
  optionalAuth,

  // Authorization (Roles)
  authorize,
  isAdmin,
  isBoutique,
  isAcheteur,
  isAdminOrOwner,
  isAdminOrBoutique,

  // Validation
  handleValidationErrors,
  registerValidation,
  loginValidation,
  updateProfileValidation,
  changePasswordValidation,
  validateObjectId,
  paginationValidation,

  // Error Handling
  ApiError,
  errorHandler,
  notFound,
  asyncHandler
};
