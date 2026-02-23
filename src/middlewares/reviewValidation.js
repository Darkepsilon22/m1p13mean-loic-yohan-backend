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

const validateReviewId = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Format ${paramName} invalide`),
  handleValidationErrors
];

const createReview = [
  body('boutiqueId').isMongoId().withMessage('boutiqueId doit être un ObjectId MongoDB valide'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('La note doit être un entier entre 1 et 5')
    .toInt(),
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Le commentaire ne peut pas dépasser 1000 caractères'),
  handleValidationErrors
];

const updateReview = [
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('La note doit être un entier entre 1 et 5')
    .toInt(),
  body('comment')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Le commentaire ne peut pas dépasser 1000 caractères'),
  handleValidationErrors
];

const patchResponse = [
  body('text')
    .trim()
    .notEmpty()
    .withMessage('Le texte de réponse est requis')
    .isLength({ max: 500 })
    .withMessage('La réponse ne peut pas dépasser 500 caractères'),
  handleValidationErrors
];

const patchStatus = [
  body('status')
    .notEmpty()
    .withMessage('Le statut est requis')
    .isIn(['published', 'hidden', 'reported', 'deleted'])
    .withMessage('Le statut doit être published, hidden, reported ou deleted'),
  handleValidationErrors
];

const reportReview = [
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('La raison du signalement est requise')
    .isLength({ max: 500 })
    .withMessage('La raison ne peut pas dépasser 500 caractères'),
  handleValidationErrors
];

const listReviews = [
  query('boutiqueId').notEmpty().withMessage('boutiqueId est requis').isMongoId().withMessage('boutiqueId doit être un ObjectId valide'),
  query('status').optional().isIn(['published', 'hidden', 'reported', 'deleted']).withMessage('Statut invalide'),
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
