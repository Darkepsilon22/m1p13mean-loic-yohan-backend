const express = require('express');
const router = express.Router();
const zoneController = require('../controllers/zoneController');
const { verifyToken } = require('../middlewares/auth');
const { isAdmin } = require('../middlewares/roles');
const { validateZoneId, createZone, updateZone, listZones } = require('../middlewares/zoneValidation');

// Public
router.get('/', listZones, zoneController.getAll);
router.get('/by-floor/:floorId', validateZoneId('floorId'), zoneController.getByFloor);
router.get('/:id', validateZoneId('id'), zoneController.getById);

// Admin only
router.use(verifyToken);
router.use(isAdmin);
router.post('/', createZone, zoneController.create);
router.put('/:id', validateZoneId('id'), updateZone, zoneController.update);
router.delete('/:id', validateZoneId('id'), zoneController.delete);

module.exports = router;
