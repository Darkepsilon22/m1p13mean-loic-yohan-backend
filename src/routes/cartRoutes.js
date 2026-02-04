const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { verifyToken } = require('../middlewares/auth');
const { isAcheteur } = require('../middlewares/roles');
const {
  addItemToCart,
  updateItemQuantity,
  removeItemFromCart
} = require('../middlewares/cartValidation');

// All cart routes require authentication as acheteur
router.use(verifyToken);
router.use(isAcheteur);

/**
 * @route   GET /api/cart
 * @desc    Get user's cart
 * @access  Private (acheteur)
 */
router.get('/', cartController.getCart);

/**
 * @route   GET /api/cart/summary
 * @desc    Get cart summary for checkout preview
 * @access  Private (acheteur)
 */
router.get('/summary', cartController.getCartSummary);

/**
 * @route   POST /api/cart/validate
 * @desc    Validate cart (check stock availability)
 * @access  Private (acheteur)
 */
router.post('/validate', cartController.validateCart);

/**
 * @route   POST /api/cart/items
 * @desc    Add item to cart
 * @access  Private (acheteur)
 */
router.post('/items', addItemToCart, cartController.addItem);

/**
 * @route   PUT /api/cart/items/:productId
 * @desc    Update item quantity
 * @access  Private (acheteur)
 */
router.put('/items/:productId', updateItemQuantity, cartController.updateItemQuantity);

/**
 * @route   DELETE /api/cart/items/:productId
 * @desc    Remove item from cart
 * @access  Private (acheteur)
 */
router.delete('/items/:productId', removeItemFromCart, cartController.removeItem);

/**
 * @route   DELETE /api/cart
 * @desc    Clear cart
 * @access  Private (acheteur)
 */
router.delete('/', cartController.clearCart);

module.exports = router;
