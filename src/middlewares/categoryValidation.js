const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware to handle validation results for category routes
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
 * Validation for MongoDB ObjectId (category routes)
 */
const validateCategoryId = (paramName = 'id') => [
  param(paramName)
    .isMongoId()
    .withMessage(`Invalid ${paramName} format`),
  handleValidationErrors
];

/**
 * Validation rules for category creation (POST /api/categories)
 */
const createCategory = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Category name is required')
    .isLength({ max: 100 })
    .withMessage('Category name cannot exceed 100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),

  body('icon')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Icon name cannot exceed 100 characters'),

  body('color')
    .optional()
    .trim()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage('Color must be a valid hexadecimal color (e.g., #FF5733)'),

  body('image')
    .optional()
    .trim()
    .isURL()
    .withMessage('Image must be a valid URL'),

  body('parentId')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === '') return true;
      return /^[0-9a-fA-F]{24}$/.test(value);
    })
    .withMessage('parentId must be a valid MongoDB ObjectId or null'),

  body('order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Order must be a non-negative integer')
    .toInt(),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value')
    .toBoolean(),

  handleValidationErrors
];

/**
 * Validation rules for category update (PUT /api/categories/:id)
 */
const updateCategory = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Category name cannot be empty')
    .isLength({ max: 100 })
    .withMessage('Category name cannot exceed 100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),

  body('icon')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Icon name cannot exceed 100 characters'),

  body('color')
    .optional()
    .custom((value) => {
      if (value === '' || value === null) return true;
      return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value);
    })
    .withMessage('Color must be a valid hexadecimal color (e.g., #FF5733) or empty'),

  body('image')
    .optional()
    .custom((value) => {
      if (value === '' || value === null) return true;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    })
    .withMessage('Image must be a valid URL or empty'),

  body('parentId')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === '') return true;
      return /^[0-9a-fA-F]{24}$/.test(value);
    })
    .withMessage('parentId must be a valid MongoDB ObjectId or null'),

  body('order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Order must be a non-negative integer')
    .toInt(),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value')
    .toBoolean(),

  handleValidationErrors
];

/**
 * Validation rules for category status update (PATCH /api/categories/:id/status)
 */
const patchCategoryStatus = [
  body('isActive')
    .notEmpty()
    .withMessage('isActive is required')
    .isBoolean()
    .withMessage('isActive must be a boolean value')
    .toBoolean(),

  handleValidationErrors
];

/**
 * Validation rules for category order update (PATCH /api/categories/:id/order)
 */
const patchCategoryOrder = [
  body('order')
    .notEmpty()
    .withMessage('Order is required')
    .isInt({ min: 0 })
    .withMessage('Order must be a non-negative integer')
    .toInt(),

  handleValidationErrors
];

/**
 * Validation rules for bulk reorder (PATCH /api/categories/reorder)
 */
const reorderCategories = [
  body('orders')
    .isArray({ min: 1 })
    .withMessage('Orders must be a non-empty array'),

  body('orders.*.id')
    .isMongoId()
    .withMessage('Each order item must have a valid id'),

  body('orders.*.order')
    .isInt({ min: 0 })
    .withMessage('Each order item must have a non-negative order value')
    .toInt(),

  handleValidationErrors
];

/**
 * Validation for category list query params (GET /api/categories)
 */
const listCategories = [
  query('active')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('active must be true or false'),

  query('parent')
    .optional()
    .isMongoId()
    .withMessage('parent must be a valid ObjectId'),

  query('root')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('root must be true or false'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100')
    .toInt(),

  query('sort')
    .optional()
    .trim()
    .isIn(['order', '-order', 'name', '-name', 'createdAt', '-createdAt'])
    .withMessage('Invalid sort value'),

  handleValidationErrors
];

/**
 * Validation for slug parameter
 */
const validateSlug = [
  param('slug')
    .trim()
    .notEmpty()
    .withMessage('Slug is required')
    .isSlug()
    .withMessage('Invalid slug format'),
  handleValidationErrors
];

module.exports = {
  validateCategoryId,
  createCategory,
  updateCategory,
  patchCategoryStatus,
  patchCategoryOrder,
  reorderCategories,
  listCategories,
  validateSlug
};
