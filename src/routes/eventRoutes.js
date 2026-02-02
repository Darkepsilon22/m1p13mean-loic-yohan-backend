const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { verifyToken } = require('../middlewares/auth');
const { isAdmin } = require('../middlewares/roles');
const {
  validateEventId,
  createEvent,
  updateEvent,
  patchEventStatus,
  listEvents
} = require('../middlewares/eventValidation');

router.get('/', listEvents, eventController.getAll);
router.get('/:id', validateEventId('id'), eventController.getById);

router.use(verifyToken);
router.use(isAdmin);

router.post('/', createEvent, eventController.create);
router.put('/:id', validateEventId('id'), updateEvent, eventController.update);
router.patch('/:id/status', validateEventId('id'), patchEventStatus, eventController.patchStatus);
router.delete('/:id', validateEventId('id'), eventController.delete);

module.exports = router;
