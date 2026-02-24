const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware pour gérer les résultats de validation pour les routes boutique
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
 * Validation pour ObjectId MongoDB (routes boutique)
 */
const validateBoutiqueId = (paramName = 'id') => [
  param(paramName)
    .isMongoId()
    .withMessage(`Format ${paramName} invalide`),
  handleValidationErrors
];

/**
 * Règles de validation pour la création de boutique (POST /api/boutiques)
 */
const createBoutique = [
  body('userId')
    .optional()
    .isMongoId()
    .withMessage('userId doit être un ObjectId MongoDB valide'),

  body('name')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Le nom ne peut pas dépasser 200 caractères'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('La description ne peut pas dépasser 2000 caractères'),

  body('shortDescription')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('La description courte ne peut pas dépasser 200 caractères'),

  body('categoryId')
    .isMongoId()
    .withMessage('categoryId doit être un ObjectId MongoDB valide'),

  body('logo')
    .optional()
    .trim(),

  body('coverImage')
    .optional()
    .trim(),

  body('photos')
    .optional()
    .isArray()
    .withMessage('Les photos doivent être un tableau'),
  body('photos.*')
    .optional()
    .trim(),

  body('contact.phone')
    .optional()
    .trim(),

  body('contact.email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('L\'e-mail de contact doit être valide'),

  body('contact.website').optional().trim(),
  body('contact.facebook').optional().trim(),
  body('contact.instagram').optional().trim(),

  body('location.floor')
    .optional()
    .isInt({ min: 0 })
    .withMessage('L\'étage doit être un entier positif ou nul')
    .toInt(),

  body('location.zone')
    .optional()
    .trim(),

  body('location.number')
    .optional()
    .trim(),

  body('location.mapCoordinates.x').optional().isNumeric().toFloat(),
  body('location.mapCoordinates.y').optional().isNumeric().toFloat(),

  body('zoneId').optional().isMongoId().withMessage('zoneId doit être un ObjectId valide'),
  body('floorId').optional().isMongoId().withMessage('floorId doit être un ObjectId valide'),
  body('mapShape').optional().isObject().withMessage('mapShape doit être un objet'),
  body('mapShape.x').optional().isNumeric().toFloat(),
  body('mapShape.y').optional().isNumeric().toFloat(),
  body('mapShape.width').optional().isFloat({ min: 0 }).toFloat(),
  body('mapShape.height').optional().isFloat({ min: 0 }).toFloat(),

  body('openingHours')
    .optional()
    .isArray()
    .withMessage('Les heures d\'ouverture doivent être un tableau de 7 objets (Lun-Dim)'),

  body('status')
    .optional()
    .isIn(['pending', 'active', 'inactive', 'rejected'])
    .withMessage('Statut invalide'),

  handleValidationErrors
];

/**
 * Règles de validation pour la mise à jour de boutique (PUT /api/boutiques/:id)
 */
const updateBoutique = [
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

  body('shortDescription')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('La description courte ne peut pas dépasser 200 caractères'),

  body('categoryId')
    .optional()
    .isMongoId()
    .withMessage('categoryId doit être un ObjectId MongoDB valide'),

  body('logo').optional().trim(),
  body('coverImage').optional().trim(),
  body('photos').optional().isArray(),
  body('photos.*').optional().trim(),

  body('contact.phone').optional().trim(),
  body('contact.email').optional().trim().isEmail().withMessage('L\'e-mail de contact doit être valide'),
  body('contact.website').optional().trim(),
  body('contact.facebook').optional().trim(),
  body('contact.instagram').optional().trim(),

  body('location.floor').optional().isInt({ min: 0 }).toInt(),
  body('location.zone').optional().trim(),
  body('location.number').optional().trim(),
  body('location.mapCoordinates.x').optional().isNumeric().toFloat(),
  body('location.mapCoordinates.y').optional().isNumeric().toFloat(),

  body('zoneId').optional().isMongoId().withMessage('zoneId doit être un ObjectId valide'),
  body('floorId').optional().isMongoId().withMessage('floorId doit être un ObjectId valide'),
  body('mapShape').optional().isObject().withMessage('mapShape doit être un objet'),
  body('mapShape.x').optional().isNumeric().toFloat(),
  body('mapShape.y').optional().isNumeric().toFloat(),
  body('mapShape.width').optional().isFloat({ min: 0 }).toFloat(),
  body('mapShape.height').optional().isFloat({ min: 0 }).toFloat(),

  body('openingHours').optional().isArray(),
  body('rejectionReason').optional().trim(),

  handleValidationErrors
];

/**
 * Règles de validation pour le statut de boutique (PATCH /api/boutiques/:id/status)
 */
const patchBoutiqueStatus = [
  body('status')
    .notEmpty()
    .withMessage('Le statut est requis')
    .isIn(['pending', 'active', 'inactive', 'rejected'])
      .withMessage('Le statut doit être en attente, actif, inactif ou rejeté'),

  body('rejectionReason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La raison du rejet ne peut pas dépasser 500 caractères'),

  handleValidationErrors
];

/**
 * Règles de validation pour l'emplacement de boutique (PATCH /api/boutiques/:id/location)
 */
const updateBoutiqueLocation = [
  body('floor')
    .optional()
    .isInt({ min: 0 })
    .withMessage('L\'étage doit être un entier positif ou nul')
    .toInt(),

  body('zone')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('La zone ne peut pas être vide'),

  body('number')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Le numéro ne peut pas être vide'),

  body('mapCoordinates')
    .optional()
    .isObject()
    .withMessage('mapCoordinates doit être un objet'),
  body('mapCoordinates.x').optional().isNumeric().toFloat(),
  body('mapCoordinates.y').optional().isNumeric().toFloat(),

  handleValidationErrors
];

/**
 * Validation pour les paramètres de requête de liste de boutiques (GET /api/boutiques)
 */
const listBoutiques = [
  query('category').optional().isMongoId().withMessage('category doit être un ObjectId valide'),
  query('status').optional().isIn(['pending', 'active', 'inactive', 'rejected']).withMessage('Statut invalide'),
  query('floor').optional().isInt({ min: 0 }).toInt(),
  query('floorId').optional().isMongoId().withMessage('floorId doit être un ObjectId valide'),
  query('zone').optional().trim(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sort').optional().trim(),
  handleValidationErrors
];

module.exports = {
  validateBoutiqueId,
  createBoutique,
  updateBoutique,
  patchBoutiqueStatus,
  updateBoutiqueLocation,
  listBoutiques
};
