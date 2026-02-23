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

const validatePromotionId = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Format ${paramName} invalide`),
  handleValidationErrors
];

const createPromotion = [
  body('boutiqueId')
    .notEmpty()
    .withMessage('L\'ID de la boutique est requis')
    .isMongoId()
    .withMessage('Format d\'ID de boutique invalide'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Le titre de la promotion est requis')
    .isLength({ max: 200 })
    .withMessage('Le titre ne peut pas dépasser 200 caractères'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('La description ne peut pas dépasser 1000 caractères'),
  body('type')
    .notEmpty()
    .withMessage('Le type de promotion est requis')
    .isIn(['percentage', 'fixed', 'special'])
    .withMessage('Le type doit être percentage, fixed ou special'),
  body('value')
    .custom((value, { req }) => {
      const type = req.body.type;
      if ((type === 'percentage' || type === 'fixed') && (value === null || value === undefined)) {
        throw new Error('La valeur est requise pour les promotions percentage et fixed');
      }
      if (type === 'percentage' && (value < 1 || value > 99)) {
        throw new Error('Le pourcentage doit être entre 1 et 99 (RG32)');
      }
      if (value !== undefined && value !== null && value < 0) {
        throw new Error('La valeur doit être au moins 0');
      }
      return true;
    }),
  body('products')
    .optional()
    .isArray()
    .withMessage('Les produits doivent être un tableau'),
  body('products.*')
    .optional()
    .isMongoId()
    .withMessage('Chaque ID de produit doit être un ObjectId MongoDB valide'),
  body('image')
    .optional()
    .isURL()
    .withMessage('L\'image doit être une URL valide'),
  body('startDate')
    .notEmpty()
    .withMessage('La date de début est requise (RG30)')
    .isISO8601()
    .withMessage('La date de début doit être une date valide'),
  body('endDate')
    .notEmpty()
    .withMessage('La date de fin est requise (RG30)')
    .isISO8601()
    .withMessage('La date de fin doit être une date valide')
    .custom((endDate, { req }) => {
      const startDate = new Date(req.body.startDate);
      const end = new Date(endDate);
      if (end <= startDate) {
        throw new Error('La date de fin doit être après la date de début (RG31)');
      }
      return true;
    }),
  handleValidationErrors
];

const updatePromotion = [
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Le titre ne peut pas être vide')
    .isLength({ max: 200 })
    .withMessage('Le titre ne peut pas dépasser 200 caractères'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('La description ne peut pas dépasser 1000 caractères'),
  body('type')
    .optional()
    .isIn(['percentage', 'fixed', 'special'])
    .withMessage('Le type doit être percentage, fixed ou special'),
  body('value')
    .optional()
    .custom((value, { req }) => {
      const type = req.body.type;
      if (type === 'percentage' && value !== undefined && (value < 1 || value > 99)) {
        throw new Error('Le pourcentage doit être entre 1 et 99 (RG32)');
      }
      if (value !== undefined && value !== null && value < 0) {
        throw new Error('La valeur doit être au moins 0');
      }
      return true;
    }),
  body('products')
    .optional()
    .isArray()
    .withMessage('Les produits doivent être un tableau'),
  body('products.*')
    .optional()
    .isMongoId()
    .withMessage('Chaque ID de produit doit être un ObjectId MongoDB valide'),
  body('image')
    .optional()
    .isURL()
    .withMessage('L\'image doit être une URL valide'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('La date de début doit être une date valide'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('La date de fin doit être une date valide')
    .custom((endDate, { req }) => {
      if (req.body.startDate && endDate) {
        const startDate = new Date(req.body.startDate);
        const end = new Date(endDate);
        if (end <= startDate) {
          throw new Error('La date de fin doit être après la date de début (RG31)');
        }
      }
      return true;
    }),
  handleValidationErrors
];

const listPromotions = [
  query('boutiqueId')
    .optional()
    .isMongoId()
    .withMessage('Format d\'ID de boutique invalide'),
  query('status')
    .optional()
    .isIn(['scheduled', 'active', 'ended', 'cancelled'])
    .withMessage('Valeur de statut invalide'),
  query('type')
    .optional()
    .isIn(['percentage', 'fixed', 'special'])
    .withMessage('Valeur de type invalide'),
  query('activeOnly')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('activeOnly doit être true ou false'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La page doit être un entier positif')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('La limite doit être entre 1 et 100')
    .toInt(),
  handleValidationErrors
];

module.exports = {
  validatePromotionId,
  createPromotion,
  updatePromotion,
  listPromotions
};
