const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken } = require('../middlewares/auth');
const { isAcheteur, isBoutique, isAdmin } = require('../middlewares/roles');
const {
  validateOrderId,
  validateOrderReference,
  createOrder,
  updateOrderStatus,
  listOrders
} = require('../middlewares/orderValidation');

// ==================== PUBLIC ROUTES ====================
// None - all order routes require authentication

// ==================== ACHETEUR ROUTES ====================

/**
 * @route   POST /api/orders
 * @desc    Create order from cart
 * @access  Private (acheteur)
 */
router.post('/', verifyToken, isAcheteur, createOrder, orderController.createOrder);

/**
 * @route   GET /api/orders/my-orders
 * @desc    Get user's orders
 * @access  Private (acheteur)
 */
router.get('/my-orders', verifyToken, isAcheteur, listOrders, orderController.getMyOrders);

/**
 * @route   GET /api/orders/reference/:reference
 * @desc    Get order by reference
 * @access  Private (acheteur - own orders only)
 */
router.get('/reference/:reference', verifyToken, validateOrderReference, orderController.getOrderByReference);

/**
 * @route   PATCH /api/orders/:id/cancel
 * @desc    Cancel order
 * @access  Private (acheteur - own orders only)
 */
router.patch('/:id/cancel', verifyToken, isAcheteur, validateOrderId(), orderController.cancelOrder);

// ==================== BOUTIQUE ROUTES ====================

/**
 * @route   GET /api/orders/boutique
 * @desc    Get boutique's orders
 * @access  Private (boutique)
 */
router.get('/boutique', verifyToken, isBoutique, listOrders, orderController.getBoutiqueOrders);

/**
 * @route   GET /api/orders/boutique/stats
 * @desc    Get boutique order statistics
 * @access  Private (boutique)
 */
router.get('/boutique/stats', verifyToken, isBoutique, orderController.getBoutiqueOrderStats);

/**
 * @route   GET /api/orders/boutique/:id
 * @desc    Get boutique order by ID
 * @access  Private (boutique)
 */
router.get('/boutique/:id', verifyToken, isBoutique, validateOrderId(), orderController.getBoutiqueOrderById);

// ==================== ADMIN ROUTES ====================

/**
 * @route   GET /api/orders/admin
 * @desc    Get all orders
 * @access  Private (admin)
 */
router.get('/admin', verifyToken, isAdmin, listOrders, orderController.getAllOrders);

/**
 * @route   GET /api/orders/admin/stats
 * @desc    Get admin order statistics
 * @access  Private (admin)
 */
router.get('/admin/stats', verifyToken, isAdmin, orderController.getAdminOrderStats);

/**
 * @route   POST /api/orders/admin/expire-pending
 * @desc    Expire pending orders (cron job)
 * @access  Private (admin)
 */
router.post('/admin/expire-pending', verifyToken, isAdmin, orderController.expirePendingOrders);

/**
 * @route   PATCH /api/orders/admin/:id/status
 * @desc    Update order status
 * @access  Private (admin)
 */
router.patch('/admin/:id/status', verifyToken, isAdmin, updateOrderStatus, orderController.updateOrderStatus);

// ==================== SHARED ROUTES ====================
// Place these at the end to avoid conflicts with specific routes

/**
 * @route   GET /api/orders/:id
 * @desc    Get order by ID
 * @access  Private (acheteur - own orders only, admin - all)
 */
router.get('/:id', verifyToken, validateOrderId(), orderController.getOrderById);

module.exports = router;
