const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
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
    body('orderId').notEmpty().withMessage('Order ID is required'),
    body('paymentMethod')
      .notEmpty().withMessage('Payment method is required')
      .isIn(['mvola', 'orange', 'airtel', 'card', 'cash', 'bank_transfer'])
      .withMessage('Invalid payment method'),
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
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['pending', 'processing', 'success', 'failed', 'refunded', 'cancelled'])
      .withMessage('Invalid status filter'),
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
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['pending', 'processing', 'success', 'failed', 'refunded', 'cancelled'])
      .withMessage('Invalid status filter'),
    query('paymentMethod').optional()
      .isIn(['mvola', 'orange', 'airtel', 'card', 'cash', 'bank_transfer'])
      .withMessage('Invalid payment method filter'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
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
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
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
    param('reference').notEmpty().withMessage('Payment reference is required'),
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
    param('reference').notEmpty().withMessage('Payment reference is required'),
    body('providerReference').optional().isString(),
    body('notes').optional().isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
    handleValidationErrors
  ],
  paymentController.confirmPayment
);

/**
 * @route   POST /api/payments/:reference/fail
 * @desc    Mark payment as failed
 * @access  Private (admin)
 */
router.post('/:reference/fail',
  verifyToken,
  isAdmin,
  [
    param('reference').notEmpty().withMessage('Payment reference is required'),
    body('reason').optional().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
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
    param('reference').notEmpty().withMessage('Payment reference is required'),
    body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be positive'),
    body('reason').optional().isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters'),
    handleValidationErrors
  ],
  paymentController.refundPayment
);

module.exports = router;
