const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('./validation');
const mongoose = require('mongoose');

// Validate MongoDB ObjectId
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

/**
 * Validate productId parameter
 */
exports.validateProductId = [
  param('productId')
    .notEmpty().withMessage('Product ID is required')
    .custom(isValidObjectId).withMessage('Invalid product ID format'),
  handleValidationErrors
];

/**
 * Validate boutiqueId parameter
 */
exports.validateBoutiqueId = [
  param('boutiqueId')
    .notEmpty().withMessage('Boutique ID is required')
    .custom(isValidObjectId).withMessage('Invalid boutique ID format'),
  handleValidationErrors
];

/**
 * Validate add stock request
 */
exports.addStock = [
  param('productId')
    .notEmpty().withMessage('Product ID is required')
    .custom(isValidObjectId).withMessage('Invalid product ID format'),
  body('quantity')
    .notEmpty().withMessage('Quantity is required')
    .isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('reason')
    .optional()
    .isString().withMessage('Reason must be a string')
    .isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  body('reference')
    .optional()
    .isString().withMessage('Reference must be a string')
    .isLength({ max: 100 }).withMessage('Reference cannot exceed 100 characters'),
  handleValidationErrors
];

/**
 * Validate remove stock request
 */
exports.removeStock = [
  param('productId')
    .notEmpty().withMessage('Product ID is required')
    .custom(isValidObjectId).withMessage('Invalid product ID format'),
  body('quantity')
    .notEmpty().withMessage('Quantity is required')
    .isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('reason')
    .optional()
    .isString().withMessage('Reason must be a string')
    .isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  body('reference')
    .optional()
    .isString().withMessage('Reference must be a string')
    .isLength({ max: 100 }).withMessage('Reference cannot exceed 100 characters'),
  handleValidationErrors
];

/**
 * Validate adjust stock request
 */
exports.adjustStock = [
  param('productId')
    .notEmpty().withMessage('Product ID is required')
    .custom(isValidObjectId).withMessage('Invalid product ID format'),
  body('newStock')
    .notEmpty().withMessage('New stock is required')
    .isInt({ min: 0 }).withMessage('New stock must be a non-negative integer'),
  body('reason')
    .optional()
    .isString().withMessage('Reason must be a string')
    .isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  body('reference')
    .optional()
    .isString().withMessage('Reference must be a string')
    .isLength({ max: 100 }).withMessage('Reference cannot exceed 100 characters'),
  handleValidationErrors
];

/**
 * Validate initial stock request
 */
exports.setInitialStock = [
  param('productId')
    .notEmpty().withMessage('Product ID is required')
    .custom(isValidObjectId).withMessage('Invalid product ID format'),
  body('stock')
    .notEmpty().withMessage('Stock is required')
    .isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('reason')
    .optional()
    .isString().withMessage('Reason must be a string')
    .isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
  handleValidationErrors
];

/**
 * Validate list boutique stock query
 */
exports.listBoutiqueStock = [
  param('boutiqueId')
    .notEmpty().withMessage('Boutique ID is required')
    .custom(isValidObjectId).withMessage('Invalid boutique ID format'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('lowStock')
    .optional()
    .isIn(['true', 'false']).withMessage('lowStock must be true or false'),
  query('outOfStock')
    .optional()
    .isIn(['true', 'false']).withMessage('outOfStock must be true or false'),
  handleValidationErrors
];

/**
 * Validate list boutique movements query
 */
exports.listBoutiqueMovements = [
  param('boutiqueId')
    .notEmpty().withMessage('Boutique ID is required')
    .custom(isValidObjectId).withMessage('Invalid boutique ID format'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('type')
    .optional()
    .isIn(['in', 'out', 'adjustment', 'initial']).withMessage('Type must be in, out, adjustment, or initial'),
  query('productId')
    .optional()
    .custom(isValidObjectId).withMessage('Invalid product ID format'),
  query('search')
    .optional()
    .isString().withMessage('Search must be a string')
    .isLength({ min: 1, max: 100 }).withMessage('Search must be between 1 and 100 characters'),
  query('startDate')
    .optional()
    .isISO8601().withMessage('startDate must be a valid date'),
  query('endDate')
    .optional()
    .isISO8601().withMessage('endDate must be a valid date'),
  handleValidationErrors
];

/**
 * Validate product history query
 */
exports.listProductHistory = [
  param('productId')
    .notEmpty().withMessage('Product ID is required')
    .custom(isValidObjectId).withMessage('Invalid product ID format'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];
