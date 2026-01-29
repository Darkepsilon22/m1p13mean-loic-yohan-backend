const express = require('express');
const router = express.Router();
const boutiqueController = require('../controllers/boutiqueController');
const { verifyToken } = require('../middlewares/auth');
const { isAdminOrBoutique } = require('../middlewares/roles');
const {
  validateBoutiqueId,
  createBoutique,
  updateBoutique,
  patchBoutiqueStatus,
  updateBoutiqueLocation,
  listBoutiques
} = require('../middlewares/boutiqueValidation');

// Public routes (no auth)
router.get('/', listBoutiques, boutiqueController.getAll);
router.get('/:id', validateBoutiqueId('id'), boutiqueController.getById);

// Protected routes (require authentication)
router.use(verifyToken);

router.post('/', isAdminOrBoutique, createBoutique, boutiqueController.create);
router.put('/:id', validateBoutiqueId('id'), isAdminOrBoutique, updateBoutique, boutiqueController.update);
router.patch('/:id/status', validateBoutiqueId('id'), isAdminOrBoutique, patchBoutiqueStatus, boutiqueController.patchStatus);
router.patch('/:id/location', validateBoutiqueId('id'), isAdminOrBoutique, updateBoutiqueLocation, boutiqueController.updateLocation);
router.delete('/:id', validateBoutiqueId('id'), isAdminOrBoutique, boutiqueController.delete);

module.exports = router;
