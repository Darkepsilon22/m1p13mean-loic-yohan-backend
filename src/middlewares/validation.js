const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware pour gérer les résultats de validation
 * Retourne 400 avec les erreurs si la validation échoue
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
 * Règles de validation pour l'inscription d'utilisateur
 */
const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Veuillez fournir une adresse e-mail valide')
    .normalizeEmail()
    .toLowerCase(),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères')
    .matches(/[a-z]/)
    .withMessage('Le mot de passe doit contenir au moins une lettre minuscule')
    .matches(/[A-Z]/)
    .withMessage('Le mot de passe doit contenir au moins une lettre majuscule')
    .matches(/[0-9]/)
    .withMessage('Le mot de passe doit contenir au moins un chiffre'),

  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('Le prénom est requis')
    .isLength({ max: 50 })
    .withMessage('Le prénom ne peut pas dépasser 50 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/)
    .withMessage('Le prénom ne peut contenir que des lettres'),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Le nom est requis')
    .isLength({ max: 50 })
    .withMessage('Le nom ne peut pas dépasser 50 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/)
    .withMessage('Le nom ne peut contenir que des lettres'),

  body('role')
    .isIn(['admin', 'boutique', 'acheteur'])
    .withMessage('Le rôle doit être admin, boutique ou acheteur'),

  body('phone')
    .optional()
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/)
    .withMessage('Veuillez fournir un numéro de téléphone valide'),

  handleValidationErrors
];

/**
 * Règles de validation pour la connexion d'utilisateur
 */
const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Veuillez fournir une adresse e-mail valide')
    .normalizeEmail()
    .toLowerCase(),

  body('password')
    .notEmpty()
    .withMessage('Le mot de passe est requis'),

  handleValidationErrors
];

/**
 * Règles de validation pour la mise à jour du profil
 */
const updateProfileValidation = [
  body('firstName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Le prénom ne peut pas être vide')
    .isLength({ max: 50 })
    .withMessage('Le prénom ne peut pas dépasser 50 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/)
    .withMessage('Le prénom ne peut contenir que des lettres'),

  body('lastName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Le nom ne peut pas être vide')
    .isLength({ max: 50 })
    .withMessage('Le nom ne peut pas dépasser 50 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/)
    .withMessage('Le nom ne peut contenir que des lettres'),

  body('phone')
    .optional()
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/)
    .withMessage('Veuillez fournir un numéro de téléphone valide'),

  body('avatar')
    .optional()
    .isURL()
    .withMessage('L\'avatar doit être une URL valide'),

  handleValidationErrors
];

/**
 * Validation pour mot de passe oublié (demande de lien de réinitialisation)
 */
const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .withMessage('Veuillez fournir une adresse e-mail valide')
    .normalizeEmail()
    .toLowerCase(),

  handleValidationErrors
];

/**
 * Validation pour réinitialiser le mot de passe (avec jeton de l'e-mail)
 */
const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Le jeton de réinitialisation est requis'),

  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Le nouveau mot de passe doit contenir au moins 8 caractères')
    .matches(/[a-z]/)
    .withMessage('Le nouveau mot de passe doit contenir au moins une lettre minuscule')
    .matches(/[A-Z]/)
    .withMessage('Le nouveau mot de passe doit contenir au moins une lettre majuscule')
    .matches(/[0-9]/)
    .withMessage('Le nouveau mot de passe doit contenir au moins un chiffre'),

  body('confirmPassword')
    .notEmpty()
    .withMessage('La confirmation du mot de passe est requise')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('La confirmation du mot de passe ne correspond pas');
      }
      return true;
    }),

  handleValidationErrors
];

/**
 * Règles de validation pour le changement de mot de passe
 */
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Le mot de passe actuel est requis'),

  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Le nouveau mot de passe doit contenir au moins 8 caractères')
    .matches(/[a-z]/)
    .withMessage('Le nouveau mot de passe doit contenir au moins une lettre minuscule')
    .matches(/[A-Z]/)
    .withMessage('Le nouveau mot de passe doit contenir au moins une lettre majuscule')
    .matches(/[0-9]/)
    .withMessage('Le nouveau mot de passe doit contenir au moins un chiffre')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('Le nouveau mot de passe doit être différent du mot de passe actuel');
      }
      return true;
    }),

  body('confirmPassword')
    .notEmpty()
    .withMessage('La confirmation du mot de passe est requise')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('La confirmation du mot de passe ne correspond pas');
      }
      return true;
    }),

  handleValidationErrors
];

/**
 * Validation pour les paramètres ObjectId MongoDB
 */
const validateObjectId = (paramName = 'id') => [
  param(paramName)
    .isMongoId()
    .withMessage(`Format ${paramName} invalide`),

  handleValidationErrors
];

/**
 * Validation pour les paramètres de requête de pagination
 */
const paginationValidation = [
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
    .isIn(['createdAt', '-createdAt', 'name', '-name', 'email', '-email'])
    .withMessage('Champ de tri invalide'),

  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  registerValidation,
  loginValidation,
  updateProfileValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  validateObjectId,
  paginationValidation
};
