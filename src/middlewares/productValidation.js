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

const validateProductId = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName} format`),
  handleValidationErrors
];

const createProduct = [
  body('boutiqueId')
    .notEmpty()
    .withMessage('Boutique ID is required')
    .isMongoId()
    .withMessage('Invalid boutique ID format'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ max: 200 })
    .withMessage('Name cannot exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),
  body('price')
    .notEmpty()
    .withMessage('Price is required (RG20)')
    .isFloat({ min: 0 })
    .withMessage('Price must be at least 0 (RG21)')
    .toFloat(),
  body('originalPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Original price must be at least 0')
    .toFloat(),
  body('photos')
    .optional()
    .isArray({ max: 5 })
    .withMessage('Photos cannot exceed 5 items (RG22)'),
  body('photos.*')
    .optional()
    .isURL()
    .withMessage('Each photo must be a valid URL'),
  body('categoryInternal')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Internal category cannot exceed 100 characters'),
  body('availability')
    .optional()
    .isIn(['available', 'outOfStock', 'onOrder'])
    .withMessage('Availability must be available, outOfStock, or onOrder'),
  body('isFeatured')
    .optional()
    .isBoolean()
    .withMessage('isFeatured must be a boolean'),
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer')
    .toInt(),
  body('lowStockThreshold')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Low stock threshold must be a non-negative integer')
    .toInt(),
  handleValidationErrors
];

const updateProduct = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ max: 200 })
    .withMessage('Name cannot exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be at least 0 (RG21)')
    .toFloat(),
  body('originalPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Original price must be at least 0')
    .toFloat(),
  body('photos')
    .optional()
    .isArray({ max: 5 })
    .withMessage('Photos cannot exceed 5 items (RG22)'),
  body('photos.*')
    .optional()
    .isURL()
    .withMessage('Each photo must be a valid URL'),
  body('mainPhoto')
    .optional()
    .isURL()
    .withMessage('Main photo must be a valid URL'),
  body('categoryInternal')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Internal category cannot exceed 100 characters'),
  body('availability')
    .optional()
    .isIn(['available', 'outOfStock', 'onOrder'])
    .withMessage('Availability must be available, outOfStock, or onOrder'),
  body('isFeatured')
    .optional()
    .isBoolean()
    .withMessage('isFeatured must be a boolean'),
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer')
    .toInt(),
  body('lowStockThreshold')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Low stock threshold must be a non-negative integer')
    .toInt(),
  handleValidationErrors
];

const patchAvailability = [
  body('availability')
    .notEmpty()
    .withMessage('Availability is required')
    .isIn(['available', 'outOfStock', 'onOrder'])
    .withMessage('Availability must be available, outOfStock, or onOrder'),
  handleValidationErrors
];

const listProducts = [
  query('boutiqueId')
    .optional()
    .isMongoId()
    .withMessage('Invalid boutique ID format'),
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('minPrice must be a positive number'),
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('maxPrice must be a positive number'),
  query('availability')
    .optional()
    .isIn(['available', 'outOfStock', 'onOrder'])
    .withMessage('Invalid availability value'),
  query('isFeatured')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isFeatured must be true or false'),
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
  validateProductId,
  createProduct,
  updateProduct,
  patchAvailability,
  listProducts
};
