const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { verifyToken } = require('../middlewares/auth');
const { isAdmin, isBoutique, isAdminOrBoutique } = require('../middlewares/roles');

// ==================== BOUTIQUE ROUTES (avant les routes paramétrées) ====================

router.get('/my', verifyToken, isBoutique, invoiceController.getMyInvoices);
router.get('/my/:id', verifyToken, isBoutique, invoiceController.getMyInvoiceById);
router.post('/my/:id/pay', verifyToken, isBoutique, invoiceController.payMyInvoice);

// ==================== ADMIN ROUTES ====================

router.get('/admin/late', verifyToken, isAdmin, invoiceController.getLateInvoices);
router.get('/', verifyToken, isAdmin, invoiceController.getAll);

router.get('/:id', verifyToken, isAdminOrBoutique, invoiceController.getById);
router.post('/:id/pay', verifyToken, isAdmin, invoiceController.recordPayment);
router.post('/:id/cancel', verifyToken, isAdmin, invoiceController.cancelInvoice);

module.exports = router;
