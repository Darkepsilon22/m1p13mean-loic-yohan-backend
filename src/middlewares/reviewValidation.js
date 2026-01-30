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

const validateReviewId = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName} format`),
  handleValidationErrors
];

const createReview = [
  body('boutiqueId').isMongoId().withMessage('boutiqueId must be a valid MongoDB ObjectId'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be an integer between 1 and 5')
    .toInt(),
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Comment cannot exceed 1000 characters'),
  handleValidationErrors
];

const updateReview = [
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be an integer between 1 and 5')
    .toInt(),
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Comment cannot exceed 1000 characters'),
  handleValidationErrors
];

const patchResponse = [
  body('text')
    .trim()
    .notEmpty()
    .withMessage('Response text is required')
    .isLength({ max: 500 })
    .withMessage('Response cannot exceed 500 characters'),
  handleValidationErrors
];

const patchStatus = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['published', 'hidden', 'reported', 'deleted'])
    .withMessage('Status must be published, hidden, reported, or deleted'),
  handleValidationErrors
];

const reportReview = [
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Report reason is required')
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters'),
  handleValidationErrors
];

const listReviews = [
  query('boutiqueId').notEmpty().withMessage('boutiqueId is required').isMongoId().withMessage('boutiqueId must be a valid ObjectId'),
  query('status').optional().isIn(['published', 'hidden', 'reported', 'deleted']).withMessage('Invalid status'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sort').optional().trim(),
  handleValidationErrors
];

module.exports = {
  validateReviewId,
  createReview,
  updateReview,
  patchResponse,
  patchStatus,
  reportReview,
  listReviews
};
