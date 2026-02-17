const { body, param, validationResult } = require('express-validator');

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

const validateFloorId = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Format ${paramName} invalide`),
  handleValidationErrors
];

const createFloor = [
  body('name').trim().notEmpty().withMessage('Le nom de l\'étage est requis').isLength({ max: 100 }).withMessage('Le nom ne peut pas dépasser 100 caractères'),
  body('width').isFloat({ min: 1 }).withMessage('La largeur doit être un nombre positif').toFloat(),
  body('height').isFloat({ min: 1 }).withMessage('La hauteur doit être un nombre positif').toFloat(),
  body('order').optional().isInt({ min: 0 }).withMessage('L\'ordre doit être un entier positif ou nul').toInt(),
  handleValidationErrors
];

const updateFloor = [
  body('name').optional().trim().notEmpty().withMessage('Le nom de l\'étage ne peut pas être vide').isLength({ max: 100 }).withMessage('Le nom ne peut pas dépasser 100 caractères'),
  body('width').optional().isFloat({ min: 1 }).withMessage('La largeur doit être un nombre positif').toFloat(),
  body('height').optional().isFloat({ min: 1 }).withMessage('La hauteur doit être un nombre positif').toFloat(),
  body('order').optional().isInt({ min: 0 }).withMessage('L\'ordre doit être un entier positif ou nul').toInt(),
  handleValidationErrors
];

module.exports = { validateFloorId, createFloor, updateFloor };
