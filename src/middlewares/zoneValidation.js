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

const validateZoneId = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName} format`),
  handleValidationErrors
];

const createZone = [
  body('floorId').isMongoId().withMessage('floorId must be a valid ObjectId'),
  body('name').trim().notEmpty().withMessage('Zone name is required').isLength({ max: 100 }).withMessage('Zone name cannot exceed 100 characters'),
  body('surfaceTotal').isFloat({ min: 1 }).withMessage('Surface must be a positive number').toFloat(),
  body('x').isFloat({ min: 0 }).withMessage('X must be non-negative').toFloat(),
  body('y').isFloat({ min: 0 }).withMessage('Y must be non-negative').toFloat(),
  body('width').isFloat({ min: 1 }).withMessage('Width must be positive').toFloat(),
  body('height').isFloat({ min: 1 }).withMessage('Height must be positive').toFloat(),
  handleValidationErrors
];

const updateZone = [
  body('floorId').optional().isMongoId().withMessage('floorId must be a valid ObjectId'),
  body('name').optional().trim().notEmpty().withMessage('Zone name cannot be empty').isLength({ max: 100 }).withMessage('Zone name cannot exceed 100 characters'),
  body('surfaceTotal').optional().isFloat({ min: 1 }).withMessage('Surface must be a positive number').toFloat(),
  body('x').optional().isFloat({ min: 0 }).withMessage('X must be non-negative').toFloat(),
  body('y').optional().isFloat({ min: 0 }).withMessage('Y must be non-negative').toFloat(),
  body('width').optional().isFloat({ min: 1 }).withMessage('Width must be positive').toFloat(),
  body('height').optional().isFloat({ min: 1 }).withMessage('Height must be positive').toFloat(),
  handleValidationErrors
];

const listZones = [
  query('floorId').optional().isMongoId().withMessage('floorId must be a valid ObjectId'),
  handleValidationErrors
];

module.exports = { validateZoneId, createZone, updateZone, listZones };
