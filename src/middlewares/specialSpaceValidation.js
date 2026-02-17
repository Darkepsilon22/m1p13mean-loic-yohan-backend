const { body, param, query, validationResult } = require('express-validator');
const { SPECIAL_SPACE_TYPES } = require('../models/SpecialSpace');

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

const validateSpecialSpaceId = (paramName = 'id') => [
  param(paramName).isMongoId().withMessage(`Format ${paramName} invalide`),
  handleValidationErrors
];

const createSpecialSpace = [
  body('floorId').isMongoId().withMessage('floorId doit être un ObjectId valide'),
  body('type').isIn(SPECIAL_SPACE_TYPES).withMessage(`Le type doit être parmi : ${SPECIAL_SPACE_TYPES.join(', ')}`),
  body('name').optional().trim().isLength({ max: 100 }).withMessage('Le nom ne peut pas dépasser 100 caractères'),
  body('x').isFloat({ min: 0 }).withMessage('X doit être positif ou nul').toFloat(),
  body('y').isFloat({ min: 0 }).withMessage('Y doit être positif ou nul').toFloat(),
  body('width').isFloat({ min: 1 }).withMessage('La largeur doit être positive').toFloat(),
  body('height').isFloat({ min: 1 }).withMessage('La hauteur doit être positive').toFloat(),
  handleValidationErrors
];

const updateSpecialSpace = [
  body('floorId').optional().isMongoId().withMessage('floorId doit être un ObjectId valide'),
  body('type').optional().isIn(SPECIAL_SPACE_TYPES).withMessage(`Le type doit être parmi : ${SPECIAL_SPACE_TYPES.join(', ')}`),
  body('name').optional().trim().isLength({ max: 100 }).withMessage('Le nom ne peut pas dépasser 100 caractères'),
  body('x').optional().isFloat({ min: 0 }).withMessage('X doit être positif ou nul').toFloat(),
  body('y').optional().isFloat({ min: 0 }).withMessage('Y doit être positif ou nul').toFloat(),
  body('width').optional().isFloat({ min: 1 }).withMessage('La largeur doit être positive').toFloat(),
  body('height').optional().isFloat({ min: 1 }).withMessage('La hauteur doit être positive').toFloat(),
  handleValidationErrors
];

const listSpecialSpaces = [
  query('floorId').optional().isMongoId().withMessage('floorId doit être un ObjectId valide'),
  handleValidationErrors
];

module.exports = { validateSpecialSpaceId, createSpecialSpace, updateSpecialSpace, listSpecialSpaces };
