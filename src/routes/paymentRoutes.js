const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const stripeController = require('../controllers/stripeController');
const { verifyToken } = require('../middlewares/auth');
const { isAcheteur, isAdmin } = require('../middlewares/roles');
const { body, param, query, validationResult } = require('express-validator');

// Validation result handler
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

// ==================== PUBLIC ROUTES ====================

/**
 * @route   GET /api/payments/methods
 * @desc    Get available payment methods
 * @access  Public
 */
router.get('/methods', paymentController.getPaymentMethods);

/**
 * @route   POST /api/payments/webhook
 * @desc    Webhook handler for payment notifications
 * @access  Public (signature verification required)
 */
router.post('/webhook', paymentController.handleWebhook);

// ==================== STRIPE ROUTES ====================

/**
 * @route   GET /api/payments/stripe/config
 * @desc    Get Stripe publishable key
 * @access  Public
 */
router.get('/stripe/config', stripeController.getStripeConfig);

/**
 * @route   POST /api/payments/stripe/create-checkout-session
 * @desc    Create Stripe Checkout Session
 * @access  Private (acheteur)
 */
router.post('/stripe/create-checkout-session',
  verifyToken,
  isAcheteur,
  [
    body('orderId').notEmpty().withMessage('L\'ID de commande est requis'),
    handleValidationErrors
  ],
  stripeController.createCheckoutSession
);

/**
 * @route   GET /api/payments/stripe/verify/:sessionId
 * @desc    Verify Stripe payment
 * @access  Private (acheteur)
 */
router.get('/stripe/verify/:sessionId', verifyToken, isAcheteur, stripeController.verifyPayment);

/**
 * @route   POST /api/payments/stripe/webhook
 * @desc    Stripe Webhook (needs raw body)
 * @access  Public
 */
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), stripeController.stripeWebhook);

// ==================== ACHETEUR ROUTES ====================

/**
 * @route   POST /api/payments/initialize
 * @desc    Initialize payment for an order
 * @access  Private (acheteur)
 */
router.post('/initialize',
  verifyToken,
  isAcheteur,
  [
    body('orderId').notEmpty().withMessage('L\'ID de commande est requis'),
    body('paymentMethod')
      .notEmpty().withMessage('La méthode de paiement est requise')
      .isIn(['mvola', 'orange', 'airtel', 'card', 'cash', 'bank_transfer'])
      .withMessage('Méthode de paiement invalide'),
    handleValidationErrors
  ],
  paymentController.initializePayment
);

/**
 * @route   GET /api/payments/history
 * @desc    Get user's payment history
 * @access  Private (acheteur)
 */
router.get('/history',
  verifyToken,
  isAcheteur,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('La page doit être un entier positif'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('La limite doit être entre 1 et 100'),
    query('status').optional().isIn(['pending', 'processing', 'success', 'failed', 'refunded', 'cancelled'])
      .withMessage('Filtre de statut invalide'),
    handleValidationErrors
  ],
  paymentController.getPaymentHistory
);

// ==================== ADMIN ROUTES ====================
// Note: Admin routes MUST be before /:reference to avoid route conflicts

/**
 * @route   GET /api/payments/admin/all
 * @desc    Get all payments
 * @access  Private (admin)
 */
router.get('/admin/all',
  verifyToken,
  isAdmin,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('La page doit être un entier positif'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('La limite doit être entre 1 et 100'),
    query('status').optional().isIn(['pending', 'processing', 'success', 'failed', 'refunded', 'cancelled'])
      .withMessage('Filtre de statut invalide'),
    query('paymentMethod').optional()
      .isIn(['mvola', 'orange', 'airtel', 'card', 'cash', 'bank_transfer'])
      .withMessage('Filtre de méthode de paiement invalide'),
    query('startDate').optional().isISO8601().withMessage('Format de date de début invalide'),
    query('endDate').optional().isISO8601().withMessage('Format de date de fin invalide'),
    handleValidationErrors
  ],
  paymentController.getAllPayments
);

/**
 * @route   GET /api/payments/admin/stats
 * @desc    Get payment statistics
 * @access  Private (admin)
 */
router.get('/admin/stats',
  verifyToken,
  isAdmin,
  [
    query('startDate').optional().isISO8601().withMessage('Format de date de début invalide'),
    query('endDate').optional().isISO8601().withMessage('Format de date de fin invalide'),
    handleValidationErrors
  ],
  paymentController.getPaymentStats
);

/**
 * @route   POST /api/payments/admin/expire-pending
 * @desc    Expire pending payments (cron job)
 * @access  Private (admin)
 */
router.post('/admin/expire-pending',
  verifyToken,
  isAdmin,
  paymentController.expirePendingPayments
);

// ==================== PARAMETERIZED ROUTES ====================
// Note: These routes MUST be after all specific routes to avoid conflicts

/**
 * @route   GET /api/payments/:reference
 * @desc    Get payment status
 * @access  Private
 */
router.get('/:reference',
  verifyToken,
  [
    param('reference').notEmpty().withMessage('La référence de paiement est requise'),
    handleValidationErrors
  ],
  paymentController.getPaymentStatus
);

/**
 * @route   POST /api/payments/:reference/confirm
 * @desc    Manually confirm payment
 * @access  Private (admin)
 */
router.post('/:reference/confirm',
  verifyToken,
  isAdmin,
  [
    param('reference').notEmpty().withMessage('La référence de paiement est requise'),
    body('providerReference').optional().isString(),
    body('notes').optional().isLength({ max: 500 }).withMessage('Les notes ne peuvent pas dépasser 500 caractères'),
    handleValidationErrors
  ],
  paymentController.confirmPayment
);

/**
 * @route   POST /api/payments/:reference/fail
 * @desc    Marquer le paiement comme échoué
 * @access  Private (admin)
 */
router.post('/:reference/fail',
  verifyToken,
  isAdmin,
  [
    param('reference').notEmpty().withMessage('La référence de paiement est requise'),
    body('reason').optional().isLength({ max: 500 }).withMessage('La raison ne peut pas dépasser 500 caractères'),
    handleValidationErrors
  ],
  paymentController.failPayment
);

/**
 * @route   POST /api/payments/:reference/refund
 * @desc    Process refund
 * @access  Private (admin)
 */
router.post('/:reference/refund',
  verifyToken,
  isAdmin,
  [
    param('reference').notEmpty().withMessage('La référence de paiement est requise'),
    body('amount').optional().isFloat({ min: 0 }).withMessage('Le montant doit être positif'),
    body('reason').optional().isLength({ max: 500 }).withMessage('La raison ne peut pas dépasser 500 caractères'),
    handleValidationErrors
  ],
  paymentController.refundPayment
);

module.exports = router;
