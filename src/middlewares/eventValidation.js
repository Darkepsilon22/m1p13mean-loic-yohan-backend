const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erreur de validation',
      errors: errors.array().map(err => ({ field: err.path, message: err.msg }))
    });
  }
  next();
};

const validateEventId = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Format ${paramName} invalide`),
  handleValidationErrors
];

const createEvent = [
  body('title').trim().notEmpty().withMessage('Le titre est requis').isLength({ max: 200 }).withMessage('Le titre ne peut pas dépasser 200 caractères'),
  body('description').trim().notEmpty().withMessage('La description est requise'),
  body('shortDescription').optional().trim(),
  body('image').trim().notEmpty().withMessage('L\'URL de l\'image est requise'),
  body('startDate').isISO8601().withMessage('La date de début doit être une date ISO 8601 valide').toDate(),
  body('endDate')
    .isISO8601().withMessage('La date de fin doit être une date ISO 8601 valide').toDate()
    .custom((value, { req }) => {
      if (req.body.startDate && value && new Date(value) <= new Date(req.body.startDate)) {
        throw new Error('La date de fin doit être après la date de début');
      }
      return true;
    }),
  body('visibility').optional().isIn(['public', 'boutiques']).withMessage('La visibilité doit être public ou boutiques'),
  body('isFeatured').optional().isBoolean().withMessage('isFeatured doit être un booléen').toBoolean(),
  body('status').optional().isIn(['draft', 'published', 'ended', 'cancelled']).withMessage('Statut invalide'),
  handleValidationErrors
];

const updateEventValidation = [
  body('title').optional().trim().notEmpty().withMessage('Le titre ne peut pas être vide').isLength({ max: 200 }).withMessage('Le titre ne peut pas dépasser 200 caractères'),
  body('description').optional().trim().notEmpty().withMessage('La description ne peut pas être vide'),
  body('shortDescription').optional().trim(),
  body('image').optional().trim().notEmpty().withMessage('L\'URL de l\'image ne peut pas être vide'),
  body('startDate').optional().isISO8601().withMessage('La date de début doit être une date ISO 8601 valide').toDate(),
  body('endDate')
    .optional()
    .isISO8601().withMessage('La date de fin doit être une date ISO 8601 valide').toDate()
    .custom((value, { req }) => {
      const start = req.body.startDate;
      if (start && value && new Date(value) <= new Date(start)) {
        throw new Error('La date de fin doit être après la date de début');
      }
      return true;
    }),
  body('visibility').optional().isIn(['public', 'boutiques']).withMessage('La visibilité doit être public ou boutiques'),
  body('isFeatured').optional().isBoolean().toBoolean(),
  handleValidationErrors
];

const patchEventStatus = [
  body('status').notEmpty().withMessage('Le statut est requis').isIn(['draft', 'published', 'ended', 'cancelled']).withMessage('Le statut doit être draft, published, ended ou cancelled'),
  handleValidationErrors
];

const listEvents = [
  query('status').optional().isIn(['draft', 'published', 'ended', 'cancelled']).withMessage('Statut invalide'),
  query('visibility').optional().isIn(['public', 'boutiques']).withMessage('Visibilité invalide'),
  query('isFeatured').optional().isIn(['true', 'false']).withMessage('isFeatured doit être true ou false'),
  query('startDate').optional().isISO8601().withMessage('startDate doit être une date ISO 8601 valide'),
  query('endDate').optional().isISO8601().withMessage('endDate doit être une date ISO 8601 valide'),
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
