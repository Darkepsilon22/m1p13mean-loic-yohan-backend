const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware to handle validation results for boutique routes
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }

  next();
};

/**
 * Validation for MongoDB ObjectId (boutique routes)
 */
const validateBoutiqueId = (paramName = 'id') => [
  param(paramName)
    .isMongoId()
    .withMessage(`Invalid ${paramName} format`),
  handleValidationErrors
];

/**
 * Validation rules for boutique creation (POST /api/boutiques)
 */
const createBoutique = [
  body('userId')
    .optional()
    .isMongoId()
    .withMessage('userId must be a valid MongoDB ObjectId'),

  body('name')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Name cannot exceed 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),

  body('shortDescription')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Short description cannot exceed 200 characters'),

  body('categoryId')
    .isMongoId()
    .withMessage('categoryId must be a valid MongoDB ObjectId'),

  body('logo')
    .optional()
    .trim(),

  body('coverImage')
    .optional()
    .trim(),

  body('photos')
    .optional()
    .isArray()
    .withMessage('Photos must be an array'),
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
    .withMessage('Contact email must be valid'),

  body('contact.website').optional().trim(),
  body('contact.facebook').optional().trim(),
  body('contact.instagram').optional().trim(),

  body('location.floor')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Floor must be a non-negative integer')
    .toInt(),

  body('location.zone')
    .optional()
    .trim(),

  body('location.number')
    .optional()
    .trim(),

  body('location.mapCoordinates.x').optional().isNumeric().toFloat(),
  body('location.mapCoordinates.y').optional().isNumeric().toFloat(),

  body('zoneId').optional().isMongoId().withMessage('zoneId must be a valid ObjectId'),
  body('floorId').optional().isMongoId().withMessage('floorId must be a valid ObjectId'),
  body('mapShape').optional().isObject().withMessage('mapShape must be an object'),
  body('mapShape.x').optional().isNumeric().toFloat(),
  body('mapShape.y').optional().isNumeric().toFloat(),
  body('mapShape.width').optional().isFloat({ min: 0 }).toFloat(),
  body('mapShape.height').optional().isFloat({ min: 0 }).toFloat(),

  body('openingHours')
    .optional()
    .isArray()
    .withMessage('Opening hours must be an array of 7 objects (Mon-Sun)'),

  body('status')
    .optional()
    .isIn(['pending', 'active', 'inactive', 'rejected'])
    .withMessage('Invalid status'),

  handleValidationErrors
];

/**
 * Validation rules for boutique update (PUT /api/boutiques/:id)
 */
const updateBoutique = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .isLength({ max: 200 })
    .withMessage('Name cannot exceed 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),

  body('shortDescription')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Short description cannot exceed 200 characters'),

  body('categoryId')
    .optional()
    .isMongoId()
    .withMessage('categoryId must be a valid MongoDB ObjectId'),

  body('logo').optional().trim(),
  body('coverImage').optional().trim(),
  body('photos').optional().isArray(),
  body('photos.*').optional().trim(),

  body('contact.phone').optional().trim(),
  body('contact.email').optional().trim().isEmail().withMessage('Contact email must be valid'),
  body('contact.website').optional().trim(),
  body('contact.facebook').optional().trim(),
  body('contact.instagram').optional().trim(),

  body('location.floor').optional().isInt({ min: 0 }).toInt(),
  body('location.zone').optional().trim(),
  body('location.number').optional().trim(),
  body('location.mapCoordinates.x').optional().isNumeric().toFloat(),
  body('location.mapCoordinates.y').optional().isNumeric().toFloat(),

  body('zoneId').optional().isMongoId().withMessage('zoneId must be a valid ObjectId'),
  body('floorId').optional().isMongoId().withMessage('floorId must be a valid ObjectId'),
  body('mapShape').optional().isObject().withMessage('mapShape must be an object'),
  body('mapShape.x').optional().isNumeric().toFloat(),
  body('mapShape.y').optional().isNumeric().toFloat(),
  body('mapShape.width').optional().isFloat({ min: 0 }).toFloat(),
  body('mapShape.height').optional().isFloat({ min: 0 }).toFloat(),

  body('openingHours').optional().isArray(),
  body('rejectionReason').optional().trim(),

  handleValidationErrors
];

/**
 * Validation rules for boutique status (PATCH /api/boutiques/:id/status)
 */
const patchBoutiqueStatus = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['pending', 'active', 'inactive', 'rejected'])
    .withMessage('Status must be pending, active, inactive, or rejected'),

  body('rejectionReason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Rejection reason cannot exceed 500 characters'),

  handleValidationErrors
];

/**
 * Validation rules for boutique location (PATCH /api/boutiques/:id/location)
 */
const updateBoutiqueLocation = [
  body('floor')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Floor must be a non-negative integer')
    .toInt(),

  body('zone')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Zone cannot be empty'),

  body('number')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Number cannot be empty'),

  body('mapCoordinates')
    .optional()
    .isObject()
    .withMessage('mapCoordinates must be an object'),
  body('mapCoordinates.x').optional().isNumeric().toFloat(),
  body('mapCoordinates.y').optional().isNumeric().toFloat(),

  handleValidationErrors
];

/**
 * Validation for boutique list query params (GET /api/boutiques)
 */
const listBoutiques = [
  query('category').optional().isMongoId().withMessage('category must be a valid ObjectId'),
  query('status').optional().isIn(['pending', 'active', 'inactive', 'rejected']).withMessage('Invalid status'),
  query('floor').optional().isInt({ min: 0 }).toInt(),
  query('floorId').optional().isMongoId().withMessage('floorId must be a valid ObjectId'),
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
