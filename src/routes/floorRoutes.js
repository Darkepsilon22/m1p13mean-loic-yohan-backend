const express = require('express');
const router = express.Router();
const floorController = require('../controllers/floorController');
const { verifyToken } = require('../middlewares/auth');
const { isAdmin } = require('../middlewares/roles');
const { validateFloorId, createFloor, updateFloor } = require('../middlewares/floorValidation');

// Public
router.get('/', floorController.getAll);
router.get('/:id', validateFloorId('id'), floorController.getById);

// Admin only
router.use(verifyToken);
router.use(isAdmin);
router.post('/', createFloor, floorController.create);
router.put('/:id', validateFloorId('id'), updateFloor, floorController.update);
router.delete('/:id', validateFloorId('id'), floorController.delete);

module.exports = router;
