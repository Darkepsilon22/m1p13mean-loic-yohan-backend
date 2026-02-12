const { body, param, query, validationResult } = require('express-validator');
const { SPECIAL_SPACE_TYPES } = require('../models/SpecialSpace');

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

const validateSpecialSpaceId = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName} format`),
  handleValidationErrors
];

const createSpecialSpace = [
  body('floorId').isMongoId().withMessage('floorId must be a valid ObjectId'),
  body('type').isIn(SPECIAL_SPACE_TYPES).withMessage(`Type must be one of: ${SPECIAL_SPACE_TYPES.join(', ')}`),
  body('name').optional().trim().isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
  body('x').isFloat({ min: 0 }).withMessage('X must be non-negative').toFloat(),
  body('y').isFloat({ min: 0 }).withMessage('Y must be non-negative').toFloat(),
  body('width').isFloat({ min: 1 }).withMessage('Width must be positive').toFloat(),
  body('height').isFloat({ min: 1 }).withMessage('Height must be positive').toFloat(),
  handleValidationErrors
];

const updateSpecialSpace = [
  body('floorId').optional().isMongoId().withMessage('floorId must be a valid ObjectId'),
  body('type').optional().isIn(SPECIAL_SPACE_TYPES).withMessage(`Type must be one of: ${SPECIAL_SPACE_TYPES.join(', ')}`),
  body('name').optional().trim().isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
  body('x').optional().isFloat({ min: 0 }).withMessage('X must be non-negative').toFloat(),
  body('y').optional().isFloat({ min: 0 }).withMessage('Y must be non-negative').toFloat(),
  body('width').optional().isFloat({ min: 1 }).withMessage('Width must be positive').toFloat(),
  body('height').optional().isFloat({ min: 1 }).withMessage('Height must be positive').toFloat(),
  handleValidationErrors
];

const listSpecialSpaces = [
  query('floorId').optional().isMongoId().withMessage('floorId must be a valid ObjectId'),
  handleValidationErrors
];

module.exports = { validateSpecialSpaceId, createSpecialSpace, updateSpecialSpace, listSpecialSpaces };
