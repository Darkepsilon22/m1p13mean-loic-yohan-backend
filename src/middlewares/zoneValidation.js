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

const validateZoneId = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Format ${paramName} invalide`),
  handleValidationErrors
];

const createZone = [
  body('floorId').isMongoId().withMessage('floorId doit être un ObjectId valide'),
  body('name').trim().notEmpty().withMessage('Le nom de la zone est requis').isLength({ max: 100 }).withMessage('Le nom ne peut pas dépasser 100 caractères'),
  body('surfaceTotal').isFloat({ min: 1 }).withMessage('La surface doit être un nombre positif').toFloat(),
  body('x').isFloat({ min: 0 }).withMessage('X doit être positif ou nul').toFloat(),
  body('y').isFloat({ min: 0 }).withMessage('Y doit être positif ou nul').toFloat(),
  body('width').isFloat({ min: 1 }).withMessage('La largeur doit être positive').toFloat(),
  body('height').isFloat({ min: 1 }).withMessage('La hauteur doit être positive').toFloat(),
  handleValidationErrors
];

const updateZone = [
  body('floorId').optional().isMongoId().withMessage('floorId doit être un ObjectId valide'),
  body('name').optional().trim().notEmpty().withMessage('Le nom de la zone ne peut pas être vide').isLength({ max: 100 }).withMessage('Le nom ne peut pas dépasser 100 caractères'),
  body('surfaceTotal').optional().isFloat({ min: 1 }).withMessage('La surface doit être un nombre positif').toFloat(),
  body('x').optional().isFloat({ min: 0 }).withMessage('X doit être positif ou nul').toFloat(),
  body('y').optional().isFloat({ min: 0 }).withMessage('Y doit être positif ou nul').toFloat(),
  body('width').optional().isFloat({ min: 1 }).withMessage('La largeur doit être positive').toFloat(),
  body('height').optional().isFloat({ min: 1 }).withMessage('La hauteur doit être positive').toFloat(),
  handleValidationErrors
];

const listZones = [
  query('floorId').optional().isMongoId().withMessage('floorId doit être un ObjectId valide'),
  handleValidationErrors
];

module.exports = { validateZoneId, createZone, updateZone, listZones };
