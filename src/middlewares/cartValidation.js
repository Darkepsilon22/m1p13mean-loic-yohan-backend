const { body, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// Validate ObjectId parameter
const validateObjectId = (paramName) => [
  param(paramName)
    .notEmpty().withMessage(`${paramName} is required`)
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error(`Invalid ${paramName} format`);
      }
      return true;
    }),
  handleValidationErrors
];

// Add item to cart validation
const addItemToCart = [
  body('productId')
    .notEmpty().withMessage('Product ID is required')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid product ID format');
      }
      return true;
    }),
  body('quantity')
    .optional()
    .isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  handleValidationErrors
];

// Update item quantity validation
const updateItemQuantity = [
  param('productId')
    .notEmpty().withMessage('Product ID is required')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid product ID format');
      }
      return true;
    }),
  body('quantity')
    .notEmpty().withMessage('Quantity is required')
    .isInt({ min: 0 }).withMessage('Quantity must be 0 or greater'),
  handleValidationErrors
];

// Remove item from cart validation
const removeItemFromCart = [
  param('productId')
    .notEmpty().withMessage('Product ID is required')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid product ID format');
      }
      return true;
    }),
  handleValidationErrors
];

module.exports = {
  validateObjectId,
  addItemToCart,
  updateItemQuantity,
  removeItemFromCart
};
