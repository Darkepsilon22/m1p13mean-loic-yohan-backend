const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const { verifyToken } = require('../middlewares/auth');
const { isAdmin, isBoutique, isAdminOrBoutique } = require('../middlewares/roles');

// ==================== BOUTIQUE ROUTES (avant les routes paramétrées) ====================

router.get('/my/active', verifyToken, isBoutique, contractController.getMyContract);
router.get('/my/history', verifyToken, isBoutique, contractController.getMyHistory);
router.post('/my/:id/pay-deposit', verifyToken, isBoutique, contractController.payDeposit);

// ==================== ADMIN ROUTES ====================

router.get('/', verifyToken, isAdmin, contractController.getAll);
router.post('/', verifyToken, isAdmin, contractController.createContract);

router.get('/:id', verifyToken, isAdminOrBoutique, contractController.getById);
router.post('/:id/send-signature', verifyToken, isAdmin, contractController.sendForSignature);
router.post('/:id/sign', verifyToken, isBoutique, contractController.signContract);
router.post('/:id/confirm-deposit', verifyToken, isAdmin, contractController.confirmDeposit);
router.post('/:id/suspend', verifyToken, isAdmin, contractController.suspendContract);
router.post('/:id/reactivate', verifyToken, isAdmin, contractController.reactivateContract);
router.post('/:id/terminate', verifyToken, isAdmin, contractController.terminateContract);

module.exports = router;
