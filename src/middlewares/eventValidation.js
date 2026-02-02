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

const validateEventId = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Invalid ${paramName} format`),
  handleValidationErrors
];

const createEvent = [
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('shortDescription').optional().trim(),
  body('image').trim().notEmpty().withMessage('Image URL is required'),
  body('startDate').isISO8601().withMessage('Start date must be a valid ISO 8601 date').toDate(),
  body('endDate')
    .isISO8601().withMessage('End date must be a valid ISO 8601 date').toDate()
    .custom((value, { req }) => {
      if (req.body.startDate && value && new Date(value) <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('visibility').optional().isIn(['public', 'boutiques']).withMessage('Visibility must be public or boutiques'),
  body('isFeatured').optional().isBoolean().withMessage('isFeatured must be a boolean').toBoolean(),
  body('status').optional().isIn(['draft', 'published', 'ended', 'cancelled']).withMessage('Invalid status'),
  handleValidationErrors
];

const updateEventValidation = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty').isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('shortDescription').optional().trim(),
  body('image').optional().trim().notEmpty().withMessage('Image URL cannot be empty'),
  body('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date').toDate(),
  body('endDate')
    .optional()
    .isISO8601().withMessage('End date must be a valid ISO 8601 date').toDate()
    .custom((value, { req }) => {
      const start = req.body.startDate;
      if (start && value && new Date(value) <= new Date(start)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('visibility').optional().isIn(['public', 'boutiques']).withMessage('Visibility must be public or boutiques'),
  body('isFeatured').optional().isBoolean().toBoolean(),
  handleValidationErrors
];

const patchEventStatus = [
  body('status').notEmpty().withMessage('Status is required').isIn(['draft', 'published', 'ended', 'cancelled']).withMessage('Status must be draft, published, ended, or cancelled'),
  handleValidationErrors
];

const listEvents = [
  query('status').optional().isIn(['draft', 'published', 'ended', 'cancelled']).withMessage('Invalid status'),
  query('visibility').optional().isIn(['public', 'boutiques']).withMessage('Invalid visibility'),
  query('isFeatured').optional().isIn(['true', 'false']).withMessage('isFeatured must be true or false'),
  query('startDate').optional().isISO8601().withMessage('startDate must be valid ISO 8601'),
  query('endDate').optional().isISO8601().withMessage('endDate must be valid ISO 8601'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sort').optional().trim(),
  handleValidationErrors
];

module.exports = {
  validateEventId,
  createEvent,
  updateEvent: updateEventValidation,
  patchEventStatus,
  listEvents
};
