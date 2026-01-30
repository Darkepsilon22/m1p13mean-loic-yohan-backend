const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { verifyToken } = require('../middlewares/auth');
const { isAdmin } = require('../middlewares/roles');
const {
  validateCategoryId,
  createCategory,
  updateCategory,
  patchCategoryStatus,
  patchCategoryOrder,
  reorderCategories,
  listCategories,
  validateSlug
} = require('../middlewares/categoryValidation');

// ============================================
// PUBLIC ROUTES (no authentication required)
// ============================================

/**
 * @route   GET /api/categories
 * @desc    Get all categories (flat list with pagination)
 * @access  Public
 * @query   active, parent, root, page, limit, sort
 */
router.get('/', listCategories, categoryController.getAll);

/**
 * @route   GET /api/categories/tree
 * @desc    Get categories as hierarchical tree
 * @access  Public
 * @query   active (default: true)
 */
router.get('/tree', categoryController.getTree);

/**
 * @route   GET /api/categories/stats
 * @desc    Get boutiques count per category
 * @access  Public
 */
router.get('/stats', categoryController.getStats);

/**
 * @route   GET /api/categories/slug/:slug
 * @desc    Get category by slug
 * @access  Public
 */
router.get('/slug/:slug', validateSlug, categoryController.getBySlug);

/**
 * @route   GET /api/categories/:id
 * @desc    Get single category by ID
 * @access  Public
 */
router.get('/:id', validateCategoryId('id'), categoryController.getById);

/**
 * @route   GET /api/categories/:id/children
 * @desc    Get children of a category
 * @access  Public
 */
router.get('/:id/children', validateCategoryId('id'), categoryController.getChildren);

// ============================================
// PROTECTED ROUTES (Admin only)
// ============================================
router.use(verifyToken);
router.use(isAdmin);

/**
 * @route   POST /api/categories
 * @desc    Create a new category
 * @access  Private (Admin only)
 * @body    name (required), description, icon, color, image, parentId, order, isActive
 */
router.post('/', createCategory, categoryController.create);

/**
 * @route   PATCH /api/categories/reorder
 * @desc    Reorder multiple categories at once
 * @access  Private (Admin only)
 * @body    orders: [{ id, order }]
 */
router.patch('/reorder', reorderCategories, categoryController.reorder);

/**
 * @route   PUT /api/categories/:id
 * @desc    Update a category (full update)
 * @access  Private (Admin only)
 * @body    name, description, icon, color, image, parentId, order, isActive
 */
router.put('/:id', validateCategoryId('id'), updateCategory, categoryController.update);

/**
 * @route   PATCH /api/categories/:id/status
 * @desc    Update category status (activate/deactivate)
 * @access  Private (Admin only)
 * @body    isActive (required)
 */
router.patch('/:id/status', validateCategoryId('id'), patchCategoryStatus, categoryController.patchStatus);

/**
 * @route   PATCH /api/categories/:id/order
 * @desc    Update category order
 * @access  Private (Admin only)
 * @body    order (required)
 */
router.patch('/:id/order', validateCategoryId('id'), patchCategoryOrder, categoryController.patchOrder);

/**
 * @route   DELETE /api/categories/:id
 * @desc    Delete a category
 * @access  Private (Admin only)
 * @note    Cannot delete if boutiques or subcategories exist
 */
router.delete('/:id', validateCategoryId('id'), categoryController.delete);

module.exports = router;
