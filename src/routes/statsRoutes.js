const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { verifyToken } = require('../middlewares/auth');
const { isAdmin, isBoutique } = require('../middlewares/roles');

// ==================== ADMIN ROUTES - Statistiques globales du centre ====================

/**
 * @route   GET /api/stats/admin/dashboard
 * @desc    Get admin dashboard overview
 * @access  Private (admin)
 */
router.get('/admin/dashboard', verifyToken, isAdmin, statsController.getAdminDashboard);

/**
 * @route   GET /api/stats/admin/revenue
 * @desc    Get global center revenue statistics (CA total)
 * @access  Private (admin)
 * @query   startDate, endDate, period (day|week|month)
 */
router.get('/admin/revenue', verifyToken, isAdmin, statsController.getGlobalRevenue);

/**
 * @route   GET /api/stats/admin/customers
 * @desc    Get customer acquisition metrics
 * @access  Private (admin)
 * @query   startDate, endDate, period (day|week|month)
 */
router.get('/admin/customers', verifyToken, isAdmin, statsController.getCustomerMetrics);

/**
 * @route   GET /api/stats/admin/comparison
 * @desc    Get period comparison statistics
 * @access  Private (admin)
 * @query   compareType (day|week|month|year)
 */
router.get('/admin/comparison', verifyToken, isAdmin, statsController.getPeriodComparison);

/**
 * @route   GET /api/stats/admin/boutiques-trends
 * @desc    Get boutique revenue trends over time (monthly per boutique)
 * @access  Private (admin)
 * @query   months (default: 12)
 */
router.get('/admin/boutiques-trends', verifyToken, isAdmin, statsController.getAdminBoutiquesTrends);

/**
 * @route   GET /api/stats/admin/rental-dashboard
 * @desc    Get rental dashboard (KPIs, charts, tables for location management)
 * @access  Private (admin)
 */
router.get('/admin/rental-dashboard', verifyToken, isAdmin, statsController.getAdminRentalDashboard);

// ==================== BOUTIQUE ROUTES - Statistiques financières ====================

/**
 * @route   GET /api/stats/boutique/dashboard
 * @desc    Get boutique dashboard overview
 * @access  Private (boutique)
 */
router.get('/boutique/dashboard', verifyToken, isBoutique, statsController.getBoutiqueDashboard);

/**
 * @route   GET /api/stats/boutique/revenue
 * @desc    Get boutique revenue (CA) statistics
 * @access  Private (boutique)
 * @query   startDate, endDate, period (day|week|month)
 */
router.get('/boutique/revenue', verifyToken, isBoutique, statsController.getBoutiqueRevenue);

/**
 * @route   GET /api/stats/boutique/trends
 * @desc    Get boutique sales trends
 * @access  Private (boutique)
 * @query   months (default: 12)
 */
router.get('/boutique/trends', verifyToken, isBoutique, statsController.getBoutiqueSalesTrends);

/**
 * @route   GET /api/stats/boutique/margins
 * @desc    Get boutique margin analysis
 * @access  Private (boutique)
 * @query   startDate, endDate
 */
router.get('/boutique/margins', verifyToken, isBoutique, statsController.getBoutiqueMargins);

/**
 * @route   GET /api/stats/boutique/products-trends
 * @desc    Get product sales trends over time (monthly per product)
 * @access  Private (boutique)
 * @query   months (default: 12), type (top|low)
 */
router.get('/boutique/products-trends', verifyToken, isBoutique, statsController.getBoutiqueProductsTrends);

module.exports = router;
