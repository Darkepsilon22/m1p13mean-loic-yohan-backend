const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware to handle validation results
 * Returns 400 with errors if validation fails
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }

  next();
};

/**
 * Validation rules for user registration
 */
const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number'),

  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters')
    .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/)
    .withMessage('First name can only contain letters'),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters')
    .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/)
    .withMessage('Last name can only contain letters'),

  body('role')
    .isIn(['admin', 'boutique', 'acheteur'])
    .withMessage('Role must be admin, boutique, or acheteur'),

  body('phone')
    .optional()
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/)
    .withMessage('Please provide a valid phone number'),

  handleValidationErrors
];

/**
 * Validation rules for user login
 */
const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  handleValidationErrors
];

/**
 * Validation rules for profile update
 */
const updateProfileValidation = [
  body('firstName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('First name cannot be empty')
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters')
    .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/)
    .withMessage('First name can only contain letters'),

  body('lastName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Last name cannot be empty')
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters')
    .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/)
    .withMessage('Last name can only contain letters'),

  body('phone')
    .optional()
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/)
    .withMessage('Please provide a valid phone number'),

  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL'),

  handleValidationErrors
];

/**
 * Validation for forgot password (request reset link)
 */
const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),

  handleValidationErrors
];

/**
 * Validation for reset password (with token from email)
 */
const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),

  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/[a-z]/)
    .withMessage('New password must contain at least one lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('New password must contain at least one uppercase letter')
    .matches(/[0-9]/)
    .withMessage('New password must contain at least one number'),

  body('confirmPassword')
    .notEmpty()
    .withMessage('Password confirmation is required')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    }),

  handleValidationErrors
];

/**
 * Validation rules for password change
 */
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/[a-z]/)
    .withMessage('New password must contain at least one lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('New password must contain at least one uppercase letter')
    .matches(/[0-9]/)
    .withMessage('New password must contain at least one number')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    }),

  body('confirmPassword')
    .notEmpty()
    .withMessage('Password confirmation is required')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    }),

  handleValidationErrors
];

/**
 * Validation for MongoDB ObjectId parameters
 */
const validateObjectId = (paramName = 'id') => [
  param(paramName)
    .isMongoId()
    .withMessage(`Invalid ${paramName} format`),

  handleValidationErrors
];

/**
 * Validation for pagination query parameters
 */
const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),

  query('sort')
    .optional()
    .isIn(['createdAt', '-createdAt', 'name', '-name', 'email', '-email'])
    .withMessage('Invalid sort field'),

  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  registerValidation,
  loginValidation,
  updateProfileValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  validateObjectId,
  paginationValidation
};
