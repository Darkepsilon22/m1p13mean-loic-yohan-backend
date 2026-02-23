const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('./validation');
const mongoose = require('mongoose');

// Validation d'ObjectId MongoDB
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

/**
 * Validation du paramètre productId
 */
exports.validateProductId = [
  param('productId')
    .notEmpty().withMessage('L\'ID du produit est requis')
    .custom(isValidObjectId).withMessage('Format d\'ID de produit invalide'),
  handleValidationErrors
];

/**
 * Validation du paramètre boutiqueId
 */
exports.validateBoutiqueId = [
  param('boutiqueId')
    .notEmpty().withMessage('L\'ID de la boutique est requis')
    .custom(isValidObjectId).withMessage('Format d\'ID de boutique invalide'),
  handleValidationErrors
];

/**
 * Validation de la requête d'ajout de stock
 */
exports.addStock = [
  param('productId')
    .notEmpty().withMessage('L\'ID du produit est requis')
    .custom(isValidObjectId).withMessage('Format d\'ID de produit invalide'),
  body('quantity')
    .notEmpty().withMessage('La quantité est requise')
    .isInt({ min: 1 }).withMessage('La quantité doit être un entier positif'),
  body('reason')
    .optional()
    .isString().withMessage('La raison doit être une chaîne de caractères')
    .isLength({ max: 500 }).withMessage('La raison ne peut pas dépasser 500 caractères'),
  body('reference')
    .optional()
    .isString().withMessage('La référence doit être une chaîne de caractères')
    .isLength({ max: 100 }).withMessage('La référence ne peut pas dépasser 100 caractères'),
  handleValidationErrors
];

/**
 * Validation de la requête de retrait de stock
 */
exports.removeStock = [
  param('productId')
    .notEmpty().withMessage('L\'ID du produit est requis')
    .custom(isValidObjectId).withMessage('Format d\'ID de produit invalide'),
  body('quantity')
    .notEmpty().withMessage('La quantité est requise')
    .isInt({ min: 1 }).withMessage('La quantité doit être un entier positif'),
  body('reason')
    .optional()
    .isString().withMessage('La raison doit être une chaîne de caractères')
    .isLength({ max: 500 }).withMessage('La raison ne peut pas dépasser 500 caractères'),
  body('reference')
    .optional()
    .isString().withMessage('La référence doit être une chaîne de caractères')
    .isLength({ max: 100 }).withMessage('La référence ne peut pas dépasser 100 caractères'),
  handleValidationErrors
];

/**
 * Validation de la requête d'ajustement de stock
 */
exports.adjustStock = [
  param('productId')
    .notEmpty().withMessage('L\'ID du produit est requis')
    .custom(isValidObjectId).withMessage('Format d\'ID de produit invalide'),
  body('newStock')
    .notEmpty().withMessage('Le nouveau stock est requis')
    .isInt({ min: 0 }).withMessage('Le nouveau stock doit être un entier positif ou nul'),
  body('reason')
    .optional()
    .isString().withMessage('La raison doit être une chaîne de caractères')
    .isLength({ max: 500 }).withMessage('La raison ne peut pas dépasser 500 caractères'),
  body('reference')
    .optional()
    .isString().withMessage('La référence doit être une chaîne de caractères')
    .isLength({ max: 100 }).withMessage('La référence ne peut pas dépasser 100 caractères'),
  handleValidationErrors
];

/**
 * Validation de la requête de stock initial
 */
exports.setInitialStock = [
  param('productId')
    .notEmpty().withMessage('L\'ID du produit est requis')
    .custom(isValidObjectId).withMessage('Format d\'ID de produit invalide'),
  body('stock')
    .notEmpty().withMessage('Le stock est requis')
    .isInt({ min: 0 }).withMessage('Le stock doit être un entier positif ou nul'),
  body('reason')
    .optional()
    .isString().withMessage('La raison doit être une chaîne de caractères')
    .isLength({ max: 500 }).withMessage('La raison ne peut pas dépasser 500 caractères'),
  handleValidationErrors
];

/**
 * Validation de la requête de liste de stock de boutique
 */
exports.listBoutiqueStock = [
  param('boutiqueId')
    .notEmpty().withMessage('L\'ID de la boutique est requis')
    .custom(isValidObjectId).withMessage('Format d\'ID de boutique invalide'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('La page doit être un entier positif'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('La limite doit être entre 1 et 100'),
  query('lowStock')
    .optional()
    .isIn(['true', 'false']).withMessage('lowStock doit être true ou false'),
  query('outOfStock')
    .optional()
    .isIn(['true', 'false']).withMessage('outOfStock doit être true ou false'),
  handleValidationErrors
];

/**
 * Validation de la requête de liste des mouvements de boutique
 */
exports.listBoutiqueMovements = [
  param('boutiqueId')
    .notEmpty().withMessage('L\'ID de la boutique est requis')
    .custom(isValidObjectId).withMessage('Format d\'ID de boutique invalide'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('La page doit être un entier positif'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('La limite doit être entre 1 et 100'),
  query('type')
    .optional()
    .isIn(['in', 'out', 'adjustment', 'initial']).withMessage('Le type doit être in, out, adjustment ou initial'),
  query('productId')
    .optional()
    .custom(isValidObjectId).withMessage('Format d\'ID de produit invalide'),
  query('search')
    .optional()
    .isString().withMessage('La recherche doit être une chaîne de caractères')
    .isLength({ min: 1, max: 100 }).withMessage('La recherche doit être entre 1 et 100 caractères'),
  query('startDate')
    .optional()
    .isISO8601().withMessage('startDate doit être une date valide'),
  query('endDate')
    .optional()
    .isISO8601().withMessage('endDate doit être une date valide'),
  handleValidationErrors
];

/**
 * Validation de la requête d'historique de produit
 */
exports.listProductHistory = [
  param('productId')
    .notEmpty().withMessage('L\'ID du produit est requis')
    .custom(isValidObjectId).withMessage('Format d\'ID de produit invalide'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('La page doit être un entier positif'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('La limite doit être entre 1 et 100'),
  handleValidationErrors
];
