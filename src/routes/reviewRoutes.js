const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { verifyToken } = require('../middlewares/auth');
const { isAcheteur, isAdmin, isAdminOrBoutique } = require('../middlewares/roles');
const {
  validateReviewId,
  createReview,
  updateReview,
  patchResponse,
  patchStatus,
  reportReview,
  listReviews
} = require('../middlewares/reviewValidation');

router.get('/', listReviews, reviewController.getAll);
router.get('/:id', validateReviewId('id'), reviewController.getById);

router.use(verifyToken);

router.post('/', isAcheteur, createReview, reviewController.create);
router.post('/:id/report', validateReviewId('id'), reportReview, reviewController.report);
router.put('/:id', validateReviewId('id'), updateReview, reviewController.update);
router.patch('/:id/response', validateReviewId('id'), isAdminOrBoutique, patchResponse, reviewController.patchResponse);
router.patch('/:id/status', validateReviewId('id'), patchStatus, reviewController.patchStatus);
router.delete('/:id', validateReviewId('id'), reviewController.delete);

module.exports = router;
