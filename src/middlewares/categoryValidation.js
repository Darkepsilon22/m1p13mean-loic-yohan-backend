const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware to handle validation results for category routes
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erreur de validation',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }

  next();
};

/**
 * Validation for MongoDB ObjectId (category routes)
 */
const validateCategoryId = (paramName = 'id') => [
  param(paramName)
    .isMongoId()
    .withMessage(`Format ${paramName} invalide`),
  handleValidationErrors
];

/**
 * Validation rules for category creation (POST /api/categories)
 */
const createCategory = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Le nom de la catégorie est requis')
    .isLength({ max: 100 })
    .withMessage('Le nom de la catégorie ne peut pas dépasser 100 caractères'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La description ne peut pas dépasser 500 caractères'),

  body('icon')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Le nom de l\'icône ne peut pas dépasser 100 caractères'),

  body('color')
    .optional()
    .trim()
    .matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .withMessage('La couleur doit être une couleur hexadécimale valide (ex. : #FF5733)'),

  body('image')
    .optional()
    .trim()
    .isURL()
    .withMessage('L\'image doit être une URL valide'),

  body('parentId')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === '') return true;
      return /^[0-9a-fA-F]{24}$/.test(value);
    })
    .withMessage('parentId doit être un ObjectId MongoDB valide ou null'),

  body('order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('L\'ordre doit être un entier positif ou nul')
    .toInt(),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive doit être une valeur booléenne')
    .toBoolean(),

  handleValidationErrors
];

/**
 * Validation rules for category update (PUT /api/categories/:id)
 */
const updateCategory = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Le nom de la catégorie ne peut pas être vide')
    .isLength({ max: 100 })
    .withMessage('Le nom de la catégorie ne peut pas dépasser 100 caractères'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La description ne peut pas dépasser 500 caractères'),

  body('icon')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Le nom de l\'icône ne peut pas dépasser 100 caractères'),

  body('color')
    .optional()
    .custom((value) => {
      if (value === '' || value === null) return true;
      return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value);
    })
    .withMessage('La couleur doit être une couleur hexadécimale valide (ex. : #FF5733) ou vide'),

  body('image')
    .optional()
    .custom((value) => {
      if (value === '' || value === null) return true;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    })
    .withMessage('L\'image doit être une URL valide ou vide'),

  body('parentId')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === '') return true;
      return /^[0-9a-fA-F]{24}$/.test(value);
    })
    .withMessage('parentId doit être un ObjectId MongoDB valide ou null'),

  body('order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('L\'ordre doit être un entier positif ou nul')
    .toInt(),

  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive doit être une valeur booléenne')
    .toBoolean(),

  handleValidationErrors
];

/**
 * Validation rules for category status update (PATCH /api/categories/:id/status)
 */
const patchCategoryStatus = [
  body('isActive')
    .notEmpty()
    .withMessage('isActive est requis')
    .isBoolean()
    .withMessage('isActive doit être une valeur booléenne')
    .toBoolean(),

  handleValidationErrors
];

/**
 * Validation rules for category order update (PATCH /api/categories/:id/order)
 */
const patchCategoryOrder = [
  body('order')
    .notEmpty()
    .withMessage('L\'ordre est requis')
    .isInt({ min: 0 })
    .withMessage('L\'ordre doit être un entier positif ou nul')
    .toInt(),

  handleValidationErrors
];

/**
 * Validation rules for bulk reorder (PATCH /api/categories/reorder)
 */
const reorderCategories = [
  body('orders')
    .isArray({ min: 1 })
    .withMessage('Les ordres doivent être un tableau non vide'),

  body('orders.*.id')
    .isMongoId()
    .withMessage('Chaque élément d\'ordre doit avoir un identifiant valide'),

  body('orders.*.order')
    .isInt({ min: 0 })
    .withMessage('Chaque élément d\'ordre doit avoir une valeur d\'ordre positive ou nulle')
    .toInt(),

  handleValidationErrors
];

/**
 * Validation for category list query params (GET /api/categories)
 */
const listCategories = [
  query('active')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('active doit être true ou false'),

  query('parent')
    .optional()
    .isMongoId()
    .withMessage('parent doit être un ObjectId valide'),

  query('root')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('root doit être true ou false'),

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

  query('sort')
    .optional()
    .trim()
    .isIn(['order', '-order', 'name', '-name', 'createdAt', '-createdAt'])
    .withMessage('Valeur de tri invalide'),

  handleValidationErrors
];

/**
 * Validation for slug parameter
 */
const validateSlug = [
  param('slug')
    .trim()
    .notEmpty()
    .withMessage('Le slug est requis')
    .isSlug()
    .withMessage('Format de slug invalide'),
  handleValidationErrors
];

module.exports = {
  validateCategoryId,
  createCategory,
  updateCategory,
  patchCategoryStatus,
  patchCategoryOrder,
  reorderCategories,
  listCategories,
  validateSlug
};
