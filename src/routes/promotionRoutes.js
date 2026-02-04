const express = require('express');
const router = express.Router();
const promotionController = require('../controllers/promotionController');
const { verifyToken } = require('../middlewares/auth');
const { isAdminOrBoutique, isAdmin } = require('../middlewares/roles');
const {
  validatePromotionId,
  createPromotion,
  updatePromotion,
  listPromotions
} = require('../middlewares/promotionValidation');

// Public routes
router.get('/', listPromotions, promotionController.getAll);
router.get('/active', promotionController.getActive);
router.get('/boutique/:boutiqueId', validatePromotionId('boutiqueId'), promotionController.getByBoutique);
router.get('/:id', validatePromotionId('id'), promotionController.getById);

// Protected routes (Boutique owner or Admin)
router.use(verifyToken);

// Admin only route for cron job
router.post('/update-statuses', isAdmin, promotionController.updateStatuses);

// Boutique owner routes
router.use(isAdminOrBoutique);

router.post('/', createPromotion, promotionController.create);
router.put('/:id', validatePromotionId('id'), updatePromotion, promotionController.update);
router.patch('/:id/cancel', validatePromotionId('id'), promotionController.cancel);
router.delete('/:id', validatePromotionId('id'), promotionController.delete);
router.get('/stats/:boutiqueId', validatePromotionId('boutiqueId'), promotionController.getStats);

module.exports = router;
