const { body, param, validationResult } = require('express-validator');

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

const validateFloorId = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName} format`),
  handleValidationErrors
];

const createFloor = [
  body('name').trim().notEmpty().withMessage('Floor name is required').isLength({ max: 100 }).withMessage('Floor name cannot exceed 100 characters'),
  body('width').isFloat({ min: 1 }).withMessage('Width must be a positive number').toFloat(),
  body('height').isFloat({ min: 1 }).withMessage('Height must be a positive number').toFloat(),
  body('order').optional().isInt({ min: 0 }).withMessage('Order must be a non-negative integer').toInt(),
  handleValidationErrors
];

const updateFloor = [
  body('name').optional().trim().notEmpty().withMessage('Floor name cannot be empty').isLength({ max: 100 }).withMessage('Floor name cannot exceed 100 characters'),
  body('width').optional().isFloat({ min: 1 }).withMessage('Width must be a positive number').toFloat(),
  body('height').optional().isFloat({ min: 1 }).withMessage('Height must be a positive number').toFloat(),
  body('order').optional().isInt({ min: 0 }).withMessage('Order must be a non-negative integer').toInt(),
  handleValidationErrors
];

module.exports = { validateFloorId, createFloor, updateFloor };
