const express = require('express');
const router = express.Router();
const specialSpaceController = require('../controllers/specialSpaceController');
const { verifyToken } = require('../middlewares/auth');
const { isAdmin } = require('../middlewares/roles');
const {
  validateSpecialSpaceId,
  createSpecialSpace,
  updateSpecialSpace,
  listSpecialSpaces
} = require('../middlewares/specialSpaceValidation');

// Public
router.get('/', listSpecialSpaces, specialSpaceController.getAll);
router.get('/by-floor/:floorId', validateSpecialSpaceId('floorId'), specialSpaceController.getByFloor);
router.get('/:id', validateSpecialSpaceId('id'), specialSpaceController.getById);

// Admin only
router.use(verifyToken);
router.use(isAdmin);
router.post('/', createSpecialSpace, specialSpaceController.create);
router.put('/:id', validateSpecialSpaceId('id'), updateSpecialSpace, specialSpaceController.update);
router.delete('/:id', validateSpecialSpaceId('id'), specialSpaceController.delete);

module.exports = router;
