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

// Public routes
router.get('/', listEvents, eventController.getAll);
router.get('/upcoming', eventController.getUpcoming);
router.get('/current', eventController.getCurrent);
router.get('/featured', eventController.getFeatured);
router.get('/:id', validateEventId('id'), eventController.getById);

// Admin routes
router.use(verifyToken);
router.use(isAdmin);

router.post('/update-statuses', eventController.updateStatuses);

router.post('/', createEvent, eventController.create);
router.put('/:id', validateEventId('id'), updateEvent, eventController.update);
router.patch('/:id/status', validateEventId('id'), patchEventStatus, eventController.patchStatus);
router.patch('/:id/publish', validateEventId('id'), eventController.publish);
router.patch('/:id/cancel', validateEventId('id'), eventController.cancel);
router.delete('/:id', validateEventId('id'), eventController.delete);

module.exports = router;
