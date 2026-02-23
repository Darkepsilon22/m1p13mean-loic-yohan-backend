const Review = require('../models/Review');
const Boutique = require('../models/Boutique');
const { ApiError, asyncHandler } = require('../middlewares/errorHandler');
const { recalculateBoutiqueRating } = require('../services/reviewService');
const { emitToAdmin, emitToUser, emitToBoutique } = require('../socket');

/**
 * @desc    List reviews (by boutique, with filters)
 * @route   GET /api/reviews
 * @access  Public
 */
exports.getAll = asyncHandler(async (req, res, next) => {
  const { boutiqueId, status, page = 1, limit = 20, sort = '-createdAt' } = req.query;

  if (!boutiqueId) {
    return next(new ApiError(400, 'Le paramètre boutiqueId est requis'));
  }

  const filter = { boutiqueId };
  if (status) filter.status = status;

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, Math.max(1, parseInt(limit, 10)));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .populate('userId', 'firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Review.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    data: {
      reviews,
      pagination: {
        page: Math.floor(skip / limitNum) + 1,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1
      }
    }
  });
});

/**
 * @desc    Get single review by ID
 * @route   GET /api/reviews/:id
 * @access  Public
 */
exports.getById = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id)
    .populate('userId', 'firstName lastName')
    .populate('boutiqueId', 'name slug');

  if (!review) {
    return next(new ApiError(404, 'Avis introuvable'));
  }

  res.status(200).json({
    success: true,
    data: { review }
  });
});

/**
 * @desc    Create a review (acheteur only, one per user per boutique)
 * @route   POST /api/reviews
 * @access  Private (acheteur)
 */
exports.create = asyncHandler(async (req, res, next) => {
  const { boutiqueId, rating, comment } = req.body;
  const userId = req.user._id;

  const boutique = await Boutique.findById(boutiqueId);
  if (!boutique) {
    return next(new ApiError(404, 'Boutique introuvable'));
  }

  const existing = await Review.findOne({ boutiqueId, userId });
  if (existing) {
    return next(new ApiError(400, 'Vous avez déjà laissé un avis pour cette boutique. Vous pouvez le modifier.'));
  }

  const review = await Review.create({
    boutiqueId,
    userId,
    rating: Math.round(Number(rating)),
    comment: comment || undefined,
    status: 'published'
  });

  await recalculateBoutiqueRating(boutiqueId);

  const populated = await Review.findById(review._id)
    .populate('userId', 'firstName lastName')
    .populate('boutiqueId', 'name slug');

  emitToBoutique(review.boutiqueId.toString(), 'review:created', { reviewId: review._id, boutiqueId: review.boutiqueId, rating: review.rating });

  res.status(201).json({
    success: true,
    message: 'Avis créé avec succès',
    data: { review: populated }
  });
});

/**
 * @desc    Update own review (rating, comment)
 * @route   PUT /api/reviews/:id
 * @access  Private (author or admin)
 */
exports.update = asyncHandler(async (req, res, next) => {
  let review = await Review.findById(req.params.id);

  if (!review) {
    return next(new ApiError(404, 'Avis introuvable'));
  }

  const isAuthor = review.userId && review.userId.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isAuthor && !isAdmin) {
    return next(new ApiError(403, 'Vous ne pouvez modifier que votre propre avis'));
  }

  const { rating, comment } = req.body;
  if (rating !== undefined) review.rating = Math.round(Number(rating));
  if (comment !== undefined) review.comment = comment;

  await review.save();

  await recalculateBoutiqueRating(review.boutiqueId);

  const populated = await Review.findById(review._id)
    .populate('userId', 'firstName lastName')
    .populate('boutiqueId', 'name slug');

  emitToBoutique(review.boutiqueId.toString(), 'review:updated', { reviewId: review._id, boutiqueId: review.boutiqueId });

  res.status(200).json({
    success: true,
    message: 'Avis mis à jour avec succès',
    data: { review: populated }
  });
});

/**
 * @desc    Boutique owner responds to a review
 * @route   PATCH /api/reviews/:id/response
 * @access  Private (boutique owner or admin)
 */
exports.patchResponse = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new ApiError(404, 'Avis introuvable'));
  }

  const boutique = await Boutique.findById(review.boutiqueId);
  if (!boutique) {
    return next(new ApiError(404, 'Boutique introuvable'));
  }

  const isBoutiqueOwner = boutique.userId && boutique.userId.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isBoutiqueOwner && !isAdmin) {
    return next(new ApiError(403, 'Seul le propriétaire de la boutique ou l\'administrateur peut répondre à cet avis'));
  }

  const { text } = req.body;
  review.response = {
    text: text || '',
    respondedAt: new Date()
  };
  await review.save();

  const populated = await Review.findById(review._id)
    .populate('userId', 'firstName lastName')
    .populate('boutiqueId', 'name slug');

  emitToUser(review.userId.toString(), 'review:responseAdded', { reviewId: review._id, boutiqueId: review.boutiqueId });

  res.status(200).json({
    success: true,
    message: 'Réponse ajoutée avec succès',
    data: { review: populated }
  });
});

/**
 * @desc    Update review status (published, hidden, reported, deleted)
 * @route   PATCH /api/reviews/:id/status
 * @access  Private (admin or boutique owner for hidden; author can delete)
 */
exports.patchStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;

  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new ApiError(404, 'Avis introuvable'));
  }

  const boutique = await Boutique.findById(review.boutiqueId);
  const isAdmin = req.user.role === 'admin';
  const isAuthor = review.userId && review.userId.toString() === req.user._id.toString();
  const isBoutiqueOwner = boutique && boutique.userId && boutique.userId.toString() === req.user._id.toString();

  if (status === 'hidden' && !isAdmin && !isBoutiqueOwner) {
    return next(new ApiError(403, 'Seul l\'administrateur ou le propriétaire de la boutique peut masquer un avis'));
  }
  if (status === 'reported' && !isAdmin) {
    return next(new ApiError(403, 'Seul l\'administrateur peut définir le statut signalé'));
  }
  if (status === 'deleted' && !isAdmin && !isAuthor) {
    return next(new ApiError(403, 'Seul l\'auteur ou l\'administrateur peut supprimer un avis'));
  }
  if (status === 'published' && !isAdmin) {
    return next(new ApiError(403, 'Seul l\'administrateur peut republier un avis'));
  }

  const previousStatus = review.status;
  review.status = status;
  await review.save();

  if (previousStatus !== status && (previousStatus === 'published' || status === 'published')) {
    await recalculateBoutiqueRating(review.boutiqueId);
  }

  const populated = await Review.findById(review._id)
    .populate('userId', 'firstName lastName')
    .populate('boutiqueId', 'name slug');

  emitToUser(review.userId.toString(), 'review:statusChanged', { reviewId: review._id, status: review.status });

  res.status(200).json({
    success: true,
    message: 'Statut de l\'avis mis à jour avec succès',
    data: { review: populated }
  });
});

/**
 * @desc    Report a review (any authenticated user)
 * @route   POST /api/reviews/:id/report
 * @access  Private (any authenticated user)
 */
exports.report = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;

  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new ApiError(404, 'Avis introuvable'));
  }

  // Check if user already reported this review
  const userId = req.user._id.toString();
  const alreadyReported = review.reportReasons.some(r => r.startsWith(`[${userId}]`));
  if (alreadyReported) {
    return next(new ApiError(400, 'Vous avez déjà signalé cet avis'));
  }

  // Add report with user ID prefix for tracking
  review.reportReasons.push(`[${userId}] ${reason}`);
  review.reportCount = (review.reportCount || 0) + 1;

  // Auto-set status to 'reported' after 3 reports
  if (review.reportCount >= 3 && review.status === 'published') {
    review.status = 'reported';
  }

  await review.save();

  // Recalculate if status changed to reported
  if (review.status === 'reported') {
    await recalculateBoutiqueRating(review.boutiqueId);
  }

  emitToAdmin('review:reported', { reviewId: review._id, boutiqueId: review.boutiqueId, reportCount: review.reportCount });

  res.status(200).json({
    success: true,
    message: 'Avis signalé avec succès',
    data: {
      reportCount: review.reportCount,
      status: review.status
    }
  });
});

/**
 * @desc    Delete a review
 * @route   DELETE /api/reviews/:id
 * @access  Private (author or admin)
 */
exports.delete = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new ApiError(404, 'Avis introuvable'));
  }

  const isAuthor = review.userId && review.userId.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isAuthor && !isAdmin) {
    return next(new ApiError(403, 'Vous ne pouvez supprimer que votre propre avis'));
  }

  const boutiqueId = review.boutiqueId;
  await Review.findByIdAndDelete(req.params.id);

  await recalculateBoutiqueRating(boutiqueId);

  emitToAdmin('review:deleted', { reviewId: req.params.id });

  res.status(200).json({
    success: true,
    message: 'Avis supprimé avec succès'
  });
});
