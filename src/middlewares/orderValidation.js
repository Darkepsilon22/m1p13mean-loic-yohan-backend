const { body, param, query, validationResult } = require('express-validator');
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
const validateOrderId = (paramName = 'id') => [
  param(paramName)
    .notEmpty().withMessage('Order ID is required')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid order ID format');
      }
      return true;
    }),
  handleValidationErrors
];

// Validate order reference parameter
const validateOrderReference = [
  param('reference')
    .notEmpty().withMessage('Order reference is required')
    .matches(/^CC-\d{8}-\d{5}$/).withMessage('Invalid order reference format'),
  handleValidationErrors
];

// Create order validation
const createOrder = [
  body('shippingAddress')
    .notEmpty().withMessage('Shipping address is required'),
  body('shippingAddress.street')
    .notEmpty().withMessage('Street address is required')
    .isLength({ max: 200 }).withMessage('Street cannot exceed 200 characters'),
  body('shippingAddress.city')
    .notEmpty().withMessage('City is required')
    .isLength({ max: 100 }).withMessage('City cannot exceed 100 characters'),
  body('shippingAddress.postalCode')
    .optional()
    .isLength({ max: 20 }).withMessage('Postal code cannot exceed 20 characters'),
  body('shippingAddress.country')
    .optional()
    .isLength({ max: 100 }).withMessage('Country cannot exceed 100 characters'),
  body('shippingAddress.additionalInfo')
    .optional()
    .isLength({ max: 500 }).withMessage('Additional info cannot exceed 500 characters'),
  body('billingAddress')
    .optional(),
  body('billingAddress.street')
    .optional()
    .isLength({ max: 200 }).withMessage('Billing street cannot exceed 200 characters'),
  body('billingAddress.city')
    .optional()
    .isLength({ max: 100 }).withMessage('Billing city cannot exceed 100 characters'),
  body('customerName')
    .optional()
    .isLength({ max: 100 }).withMessage('Customer name cannot exceed 100 characters'),
  body('customerEmail')
    .optional()
    .isEmail().withMessage('Invalid email format'),
  body('customerPhone')
    .optional()
    .isLength({ max: 20 }).withMessage('Phone cannot exceed 20 characters'),
  body('paymentMethod')
    .optional()
    .isIn(['mvola', 'orange', 'airtel', 'card', 'cash', 'pending'])
    .withMessage('Invalid payment method'),
  body('customerNotes')
    .optional()
    .isLength({ max: 500 }).withMessage('Customer notes cannot exceed 500 characters'),
  handleValidationErrors
];

// Update order status validation
const updateOrderStatus = [
  param('id')
    .notEmpty().withMessage('Order ID is required')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid order ID format');
      }
      return true;
    }),
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'])
    .withMessage('Invalid order status'),
  body('trackingNumber')
    .optional()
    .isLength({ max: 100 }).withMessage('Tracking number cannot exceed 100 characters'),
  body('carrier')
    .optional()
    .isLength({ max: 100 }).withMessage('Carrier cannot exceed 100 characters'),
  body('adminNotes')
    .optional()
    .isLength({ max: 500 }).withMessage('Admin notes cannot exceed 500 characters'),
  handleValidationErrors
];

// List orders validation (query params)
const listOrders = [
  query('status')
    .optional()
    .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'])
    .withMessage('Invalid status filter'),
  query('paymentStatus')
    .optional()
    .isIn(['pending', 'processing', 'success', 'failed', 'refunded'])
    .withMessage('Invalid payment status filter'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('startDate')
    .optional()
    .isISO8601().withMessage('Invalid start date format'),
  query('endDate')
    .optional()
    .isISO8601().withMessage('Invalid end date format'),
  handleValidationErrors
];

module.exports = {
  validateOrderId,
  validateOrderReference,
  createOrder,
  updateOrderStatus,
  listOrders
};
