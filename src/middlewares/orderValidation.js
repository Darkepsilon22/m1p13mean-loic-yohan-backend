const { body, param, query, validationResult } = require('express-validator');
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
const validateOrderId = (paramName = 'id') => [
  param(paramName)
    .notEmpty().withMessage('L\'ID de la commande est requis')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Format d\'ID de commande invalide');
      }
      return true;
    }),
  handleValidationErrors
];

// Validation du paramètre de référence de commande
const validateOrderReference = [
  param('reference')
    .notEmpty().withMessage('La référence de commande est requise')
    .matches(/^CC-\d{8}-\d{5}$/).withMessage('Format de référence de commande invalide'),
  handleValidationErrors
];

// Validation de création de commande
const createOrder = [
  body('shippingAddress')
    .notEmpty().withMessage('L\'adresse de livraison est requise'),
  body('shippingAddress.street')
    .notEmpty().withMessage('L\'adresse de rue est requise')
    .isLength({ max: 200 }).withMessage('La rue ne peut pas dépasser 200 caractères'),
  body('shippingAddress.city')
    .notEmpty().withMessage('La ville est requise')
    .isLength({ max: 100 }).withMessage('La ville ne peut pas dépasser 100 caractères'),
  body('shippingAddress.postalCode')
    .optional()
    .isLength({ max: 20 }).withMessage('Le code postal ne peut pas dépasser 20 caractères'),
  body('shippingAddress.country')
    .optional()
    .isLength({ max: 100 }).withMessage('Le pays ne peut pas dépasser 100 caractères'),
  body('shippingAddress.additionalInfo')
    .optional()
    .isLength({ max: 500 }).withMessage('Les informations supplémentaires ne peuvent pas dépasser 500 caractères'),
  body('billingAddress')
    .optional(),
  body('billingAddress.street')
    .optional()
    .isLength({ max: 200 }).withMessage('La rue de facturation ne peut pas dépasser 200 caractères'),
  body('billingAddress.city')
    .optional()
    .isLength({ max: 100 }).withMessage('La ville de facturation ne peut pas dépasser 100 caractères'),
  body('customerName')
    .optional()
    .isLength({ max: 100 }).withMessage('Le nom du client ne peut pas dépasser 100 caractères'),
  body('customerEmail')
    .optional()
    .isEmail().withMessage('Format d\'e-mail invalide'),
  body('customerPhone')
    .optional()
    .isLength({ max: 20 }).withMessage('Le téléphone ne peut pas dépasser 20 caractères'),
  body('paymentMethod')
    .optional()
    .isIn(['mvola', 'orange', 'airtel', 'card', 'cash', 'pending'])
    .withMessage('Méthode de paiement invalide'),
  body('customerNotes')
    .optional()
    .isLength({ max: 500 }).withMessage('Les notes du client ne peuvent pas dépasser 500 caractères'),
  handleValidationErrors
];

// Validation de mise à jour du statut de commande
const updateOrderStatus = [
  param('id')
    .notEmpty().withMessage('L\'ID de la commande est requis')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Format d\'ID de commande invalide');
      }
      return true;
    }),
  body('status')
    .notEmpty().withMessage('Le statut est requis')
    .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'])
    .withMessage('Statut de commande invalide'),
  body('trackingNumber')
    .optional()
    .isLength({ max: 100 }).withMessage('Le numéro de suivi ne peut pas dépasser 100 caractères'),
  body('carrier')
    .optional()
    .isLength({ max: 100 }).withMessage('Le transporteur ne peut pas dépasser 100 caractères'),
  body('adminNotes')
    .optional()
    .isLength({ max: 500 }).withMessage('Les notes administrateur ne peuvent pas dépasser 500 caractères'),
  handleValidationErrors
];

// Validation de liste de commandes (paramètres de requête)
const listOrders = [
  query('status')
    .optional()
    .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'])
    .withMessage('Filtre de statut invalide'),
  query('paymentStatus')
    .optional()
    .isIn(['pending', 'processing', 'success', 'failed', 'refunded'])
    .withMessage('Filtre de statut de paiement invalide'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('La page doit être un entier positif'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('La limite doit être entre 1 et 100'),
  query('startDate')
    .optional()
    .isISO8601().withMessage('Format de date de début invalide'),
  query('endDate')
    .optional()
    .isISO8601().withMessage('Format de date de fin invalide'),
  handleValidationErrors
];

module.exports = {
  validateOrderId,
  validateOrderReference,
  createOrder,
  updateOrderStatus,
  listOrders
};
