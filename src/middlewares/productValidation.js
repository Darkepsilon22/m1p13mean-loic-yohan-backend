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

const validateProductId = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Format ${paramName} invalide`),
  handleValidationErrors
];

const createProduct = [
  body('boutiqueId')
    .notEmpty()
    .withMessage('L\'ID de la boutique est requis')
    .isMongoId()
    .withMessage('Format d\'ID de boutique invalide'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Le nom du produit est requis')
    .isLength({ max: 200 })
    .withMessage('Le nom ne peut pas dépasser 200 caractères'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('La description ne peut pas dépasser 2000 caractères'),
  body('price')
    .notEmpty()
    .withMessage('Le prix est requis (RG20)')
    .isFloat({ min: 0 })
    .withMessage('Le prix doit être au moins 0 (RG21)')
    .toFloat(),
  body('originalPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Le prix original doit être au moins 0')
    .toFloat(),
  body('photos')
    .optional()
    .isArray({ max: 5 })
    .withMessage('Les photos ne peuvent pas dépasser 5 éléments (RG22)'),
  body('photos.*')
    .optional()
    .isURL()
    .withMessage('Chaque photo doit être une URL valide'),
  body('categoryInternal')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('La catégorie interne ne peut pas dépasser 100 caractères'),
  body('availability')
    .optional()
    .isIn(['available', 'outOfStock', 'onOrder'])
    .withMessage('La disponibilité doit être available, outOfStock ou onOrder'),
  body('isFeatured')
    .optional()
    .isBoolean()
    .withMessage('isFeatured doit être un booléen'),
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Le stock doit être un entier positif ou nul')
    .toInt(),
  body('lowStockThreshold')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Le seuil de stock bas doit être un entier positif ou nul')
    .toInt(),
  handleValidationErrors
];

const updateProduct = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Le nom ne peut pas être vide')
    .isLength({ max: 200 })
    .withMessage('Le nom ne peut pas dépasser 200 caractères'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('La description ne peut pas dépasser 2000 caractères'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Le prix doit être au moins 0 (RG21)')
    .toFloat(),
  body('originalPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Le prix original doit être au moins 0')
    .toFloat(),
  body('photos')
    .optional()
    .isArray({ max: 5 })
    .withMessage('Les photos ne peuvent pas dépasser 5 éléments (RG22)'),
  body('photos.*')
    .optional()
    .isURL()
    .withMessage('Chaque photo doit être une URL valide'),
  body('mainPhoto')
    .optional()
    .isURL()
    .withMessage('La photo principale doit être une URL valide'),
  body('categoryInternal')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('La catégorie interne ne peut pas dépasser 100 caractères'),
  body('availability')
    .optional()
    .isIn(['available', 'outOfStock', 'onOrder'])
    .withMessage('La disponibilité doit être available, outOfStock ou onOrder'),
  body('isFeatured')
    .optional()
    .isBoolean()
    .withMessage('isFeatured doit être un booléen'),
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Le stock doit être un entier positif ou nul')
    .toInt(),
  body('lowStockThreshold')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Le seuil de stock bas doit être un entier positif ou nul')
    .toInt(),
  handleValidationErrors
];

const patchAvailability = [
  body('availability')
    .notEmpty()
    .withMessage('La disponibilité est requise')
    .isIn(['available', 'outOfStock', 'onOrder'])
    .withMessage('La disponibilité doit être available, outOfStock ou onOrder'),
  handleValidationErrors
];

const listProducts = [
  query('boutiqueId')
    .optional()
    .isMongoId()
    .withMessage('Format d\'ID de boutique invalide'),
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('minPrice doit être un nombre positif'),
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('maxPrice doit être un nombre positif'),
  query('availability')
    .optional()
    .isIn(['available', 'outOfStock', 'onOrder'])
    .withMessage('Valeur de disponibilité invalide'),
  query('isFeatured')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('isFeatured doit être true ou false'),
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
  validateProductId,
  createProduct,
  updateProduct,
  patchAvailability,
  listProducts
};
