const { body, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Gestionnaire des résultats de validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// Validation du paramètre ObjectId
const validateObjectId = (paramName) => [
  param(paramName)
    .notEmpty().withMessage(`${paramName} est requis`)
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error(`Format ${paramName} invalide`);
      }
      return true;
    }),
  handleValidationErrors
];

// Validation de l'ajout d'un article au panier
const addItemToCart = [
  body('productId')
    .notEmpty().withMessage('L\'ID du produit est requis')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Format d\'ID de produit invalide');
      }
      return true;
    }),
  body('quantity')
    .optional()
    .isInt({ min: 1 }).withMessage('La quantité doit être au moins 1'),
  handleValidationErrors
];

// Validation de la mise à jour de la quantité d'un article
const updateItemQuantity = [
  param('productId')
    .notEmpty().withMessage('L\'ID du produit est requis')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Format d\'ID de produit invalide');
      }
      return true;
    }),
  body('quantity')
    .notEmpty().withMessage('La quantité est requise')
    .isInt({ min: 0 }).withMessage('La quantité doit être 0 ou supérieure'),
  handleValidationErrors
];

// Validation de la suppression d'un article du panier
const removeItemFromCart = [
  param('productId')
    .notEmpty().withMessage('L\'ID du produit est requis')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Format d\'ID de produit invalide');
      }
      return true;
    }),
  handleValidationErrors
];

module.exports = {
  validateObjectId,
  addItemToCart,
  updateItemQuantity,
  removeItemFromCart
};
