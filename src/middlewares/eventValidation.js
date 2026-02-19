const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('[EventValidation] Errors:', JSON.stringify(errors.array(), null, 2));
    console.log('[EventValidation] Body:', JSON.stringify(req.body, null, 2));
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
  body('title').optional().trim().notEmpty().withMessage('Le titre ne peut pas être vide').isLength({ max: 200 }).withMessage('Le titre ne peut pas dépasser 200 caractères'),
  body('description').optional().trim().notEmpty().withMessage('La description ne peut pas être vide'),
  body('shortDescription').optional({ nullable: true }).trim(),
  body('image').optional().trim().notEmpty().withMessage('L\'URL de l\'image ne peut pas être vide'),
  body('startDate').optional().isISO8601().withMessage('La date de début doit être au format ISO 8601'),
  body('endDate')
    .optional()
    .isISO8601().withMessage('La date de fin doit être au format ISO 8601')
    .custom((value, { req }) => {
      const start = req.body.startDate;
      if (start && value) {
        const startMs = new Date(start).getTime();
        const endMs = new Date(value).getTime();
        if (endMs <= startMs) {
          throw new Error('La date de fin doit être après la date de début');
        }
      }
      return true;
    }),
  body('visibility').optional().isIn(['public', 'boutiques']).withMessage('La visibilité doit être public ou boutiques'),
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
