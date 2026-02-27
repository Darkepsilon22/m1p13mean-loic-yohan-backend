const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { verifyToken, optionalAuth } = require('../middlewares/auth');
const { isAdmin } = require('../middlewares/roles');
const {
  validateEventId,
  createEvent,
  updateEvent,
  patchEventStatus,
  listEvents
} = require('../middlewares/eventValidation');

const { cache } = require('../middlewares/cache');

// Public routes (cached)
router.get('/', listEvents, cache(60), eventController.getAll);
router.get('/upcoming', cache(60), eventController.getUpcoming);
router.get('/current', cache(60), eventController.getCurrent);
router.get('/featured', cache(60), eventController.getFeatured);
router.get('/banners', optionalAuth, cache(60), eventController.getBanners);
router.get('/:id', validateEventId('id'), cache(60), eventController.getById);

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
