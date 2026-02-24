const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({ field: err.path, message: err.msg }))
    });
  }
  next();
};

const validatePromotionId = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName} format`),
  handleValidationErrors
];

const createPromotion = [
  body('boutiqueId')
    .notEmpty()
    .withMessage('Boutique ID is required')
    .isMongoId()
    .withMessage('Invalid boutique ID format'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Promotion title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('type')
    .notEmpty()
    .withMessage('Promotion type is required')
    .isIn(['percentage', 'fixed', 'special'])
    .withMessage('Type must be percentage, fixed, or special'),
  body('value')
    .custom((value, { req }) => {
      const type = req.body.type;
      if ((type === 'percentage' || type === 'fixed') && (value === null || value === undefined)) {
        throw new Error('Value is required for percentage and fixed promotions');
      }
      if (type === 'percentage' && (value < 1 || value > 99)) {
        throw new Error('Percentage must be between 1 and 99 (RG32)');
      }
      if (value !== undefined && value !== null && value < 0) {
        throw new Error('Value must be at least 0');
      }
      return true;
    }),
  body('products')
    .optional()
    .isArray()
    .withMessage('Products must be an array'),
  body('products.*')
    .optional()
    .isMongoId()
    .withMessage('Each product ID must be a valid MongoDB ObjectId'),
  body('image')
    .optional()
    .isURL()
    .withMessage('Image must be a valid URL'),
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required (RG30)')
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('endDate')
    .notEmpty()
    .withMessage('End date is required (RG30)')
    .isISO8601()
    .withMessage('End date must be a valid date')
    .custom((endDate, { req }) => {
      const startDate = new Date(req.body.startDate);
      const end = new Date(endDate);
      if (end <= startDate) {
        throw new Error('End date must be after start date (RG31)');
      }
      return true;
    }),
  handleValidationErrors
];

const updatePromotion = [
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Title cannot be empty')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('type')
    .optional()
    .isIn(['percentage', 'fixed', 'special'])
    .withMessage('Type must be percentage, fixed, or special'),
  body('value')
    .optional()
    .custom((value, { req }) => {
      const type = req.body.type;
      if (type === 'percentage' && value !== undefined && (value < 1 || value > 99)) {
        throw new Error('Percentage must be between 1 and 99 (RG32)');
      }
      if (value !== undefined && value !== null && value < 0) {
        throw new Error('Value must be at least 0');
      }
      return true;
    }),
  body('products')
    .optional()
    .isArray()
    .withMessage('Products must be an array'),
  body('products.*')
    .optional()
    .isMongoId()
    .withMessage('Each product ID must be a valid MongoDB ObjectId'),
  body('image')
    .optional()
    .isURL()
    .withMessage('Image must be a valid URL'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date')
    .custom((endDate, { req }) => {
      if (req.body.startDate && endDate) {
        const startDate = new Date(req.body.startDate);
        const end = new Date(endDate);
        if (end <= startDate) {
          throw new Error('End date must be after start date (RG31)');
        }
      }
      return true;
    }),
  handleValidationErrors
];

const listPromotions = [
  query('boutiqueId')
    .optional()
    .isMongoId()
    .withMessage('Invalid boutique ID format'),
  query('status')
    .optional()
    .isIn(['scheduled', 'active', 'ended', 'cancelled'])
    .withMessage('Invalid status value'),
  query('type')
    .optional()
    .isIn(['percentage', 'fixed', 'special'])
    .withMessage('Invalid type value'),
  query('activeOnly')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('activeOnly must be true or false'),
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
  handleValidationErrors
];

module.exports = {
  validatePromotionId,
  createPromotion,
  updatePromotion,
  listPromotions
};
