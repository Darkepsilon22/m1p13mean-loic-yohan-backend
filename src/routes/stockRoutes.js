const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const { verifyToken } = require('../middlewares/auth');
const { isBoutique } = require('../middlewares/roles');
const {
  validateProductId,
  validateBoutiqueId,
  addStock,
  removeStock,
  adjustStock,
  setInitialStock,
  listBoutiqueStock,
  listBoutiqueMovements,
  listProductHistory
} = require('../middlewares/stockValidation');

// All routes require authentication
router.use(verifyToken);

// Boutique owner only routes (stock management)
// Admin ne peut PAS voir les stocks et mouvements des boutiques
router.use(isBoutique);

// Export PDF/Excel (must be before /:productId)
router.get('/export/pdf', stockController.exportStockPDF);
router.get('/export/excel', stockController.exportStockExcel);

// Stock operations with productId in body (alternative routes)
router.post('/add', stockController.addStock);
router.post('/remove', stockController.removeStock);
router.post('/adjust', stockController.adjustStock);

// Stock operations on products with productId in URL
router.post('/:productId/add', addStock, stockController.addStock);
router.post('/:productId/remove', removeStock, stockController.removeStock);
router.post('/:productId/adjust', adjustStock, stockController.adjustStock);
router.post('/:productId/initial', setInitialStock, stockController.setInitialStock);
router.get('/:productId/history', listProductHistory, stockController.getProductHistory);

// Boutique stock overview
router.get('/boutique/:boutiqueId', listBoutiqueStock, stockController.getBoutiqueStock);
router.get('/boutique/:boutiqueId/movements', listBoutiqueMovements, stockController.getBoutiqueMovements);

module.exports = router;
