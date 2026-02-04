const Promotion = require('../models/Promotion');
const Boutique = require('../models/Boutique');
const Product = require('../models/Product');
const { asyncHandler, ApiError } = require('../middlewares/errorHandler');

/**
 * @desc    Get all promotions (with filters)
 * @route   GET /api/promotions
 * @access  Public
 */
exports.getAll = asyncHandler(async (req, res) => {
  const {
    boutiqueId,
    status,
    type,
    activeOnly,
    sort = '-createdAt',
    page = 1,
    limit = 20
  } = req.query;

  const query = {};

  // Filter by boutique
  if (boutiqueId) {
    query.boutiqueId = boutiqueId;
  }

  // Filter by status
  if (status) {
    query.status = status;
  }

  // Filter by type
  if (type) {
    query.type = type;
  }

  // Only show active promotions (for public view)
  if (activeOnly === 'true') {
    query.status = 'active';
  }

  // Only show promotions from active boutiques
  const activeBoutiques = await Boutique.find({ status: 'active' }).select('_id');
  const activeBoutiqueIds = activeBoutiques.map(b => b._id);

  if (query.boutiqueId) {
    // Check if the specified boutique is active
    const isActive = activeBoutiqueIds.some(id => id.equals(query.boutiqueId));
    if (!isActive) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: { page: 1, limit: parseInt(limit), total: 0, pages: 0 }
      });
    }
  } else {
    query.boutiqueId = { $in: activeBoutiqueIds };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [promotions, total] = await Promise.all([
    Promotion.find(query)
      .populate('boutiqueId', 'name slug logo')
      .populate('products', 'name slug price mainPhoto')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit)),
    Promotion.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: promotions,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

/**
 * @desc    Get active promotions (public endpoint)
 * @route   GET /api/promotions/active
 * @access  Public
 */
exports.getActive = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  // Update statuses first
  await Promotion.updateStatuses();

  // Only from active boutiques
  const activeBoutiques = await Boutique.find({ status: 'active' }).select('_id');
  const activeBoutiqueIds = activeBoutiques.map(b => b._id);

  const promotions = await Promotion.find({
    boutiqueId: { $in: activeBoutiqueIds },
    status: 'active'
  })
    .populate('boutiqueId', 'name slug logo')
    .populate('products', 'name slug price mainPhoto')
    .sort('-createdAt')
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    data: promotions
  });
});

/**
 * @desc    Get promotion by ID
 * @route   GET /api/promotions/:id
 * @access  Public
 */
exports.getById = asyncHandler(async (req, res, next) => {
  const promotion = await Promotion.findById(req.params.id)
    .populate('boutiqueId', 'name slug logo contact location')
    .populate('products', 'name slug price mainPhoto availability');

  if (!promotion) {
    return next(new ApiError(404, 'Promotion not found'));
  }

  res.status(200).json({
    success: true,
    data: promotion
  });
});

/**
 * @desc    Get promotions by boutique
 * @route   GET /api/promotions/boutique/:boutiqueId
 * @access  Public
 */
exports.getByBoutique = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, includeExpired } = req.query;

  const query = { boutiqueId: req.params.boutiqueId };

  if (status) {
    query.status = status;
  } else if (includeExpired !== 'true') {
    // By default, don't show ended/cancelled
    query.status = { $in: ['scheduled', 'active'] };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [promotions, total] = await Promise.all([
    Promotion.find(query)
      .populate('products', 'name slug price mainPhoto')
      .sort('-startDate')
      .skip(skip)
      .limit(parseInt(limit)),
    Promotion.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: promotions,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

/**
 * @desc    Create a promotion
 * @route   POST /api/promotions
 * @access  Private (Boutique owner)
 */
exports.create = asyncHandler(async (req, res, next) => {
  const { boutiqueId, title, description, type, value, products, image, startDate, endDate } = req.body;

  // Check if boutique exists and belongs to user
  const boutique = await Boutique.findById(boutiqueId);
  if (!boutique) {
    return next(new ApiError(404, 'Boutique not found'));
  }

  // Check ownership (unless admin)
  if (req.user.role !== 'admin' && !boutique.userId.equals(req.user._id)) {
    return next(new ApiError(403, 'You are not authorized to create promotions for this boutique'));
  }

  // Check boutique status
  if (boutique.status !== 'active') {
    return next(new ApiError(400, 'Cannot create promotions for inactive boutique'));
  }

  // Check max active promotions (RG34)
  const canCreate = await Promotion.canCreateActivePromotion(boutiqueId);
  if (!canCreate) {
    return next(new ApiError(400, 'Maximum 5 active promotions allowed per boutique (RG34)'));
  }

  // Validate products belong to this boutique
  if (products && products.length > 0) {
    const productCount = await Product.countDocuments({
      _id: { $in: products },
      boutiqueId: boutiqueId,
      isArchived: false
    });

    if (productCount !== products.length) {
      return next(new ApiError(400, 'Some products do not exist or do not belong to this boutique'));
    }
  }

  const promotion = await Promotion.create({
    boutiqueId,
    title,
    description,
    type,
    value,
    products,
    image,
    startDate: new Date(startDate),
    endDate: new Date(endDate)
  });

  res.status(201).json({
    success: true,
    message: 'Promotion created successfully',
    data: promotion
  });
});

/**
 * @desc    Update a promotion
 * @route   PUT /api/promotions/:id
 * @access  Private (Boutique owner)
 */
exports.update = asyncHandler(async (req, res, next) => {
  let promotion = await Promotion.findById(req.params.id);

  if (!promotion) {
    return next(new ApiError(404, 'Promotion not found'));
  }

  // Check ownership
  const boutique = await Boutique.findById(promotion.boutiqueId);
  if (req.user.role !== 'admin' && !boutique.userId.equals(req.user._id)) {
    return next(new ApiError(403, 'You are not authorized to update this promotion'));
  }

  // Cannot update ended or cancelled promotions
  if (promotion.status === 'ended' || promotion.status === 'cancelled') {
    return next(new ApiError(400, 'Cannot update ended or cancelled promotions'));
  }

  const allowedFields = ['title', 'description', 'type', 'value', 'products', 'image', 'startDate', 'endDate'];
  const updates = {};

  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  // Convert dates
  if (updates.startDate) updates.startDate = new Date(updates.startDate);
  if (updates.endDate) updates.endDate = new Date(updates.endDate);

  // Validate products if provided
  if (updates.products && updates.products.length > 0) {
    const productCount = await Product.countDocuments({
      _id: { $in: updates.products },
      boutiqueId: promotion.boutiqueId,
      isArchived: false
    });

    if (productCount !== updates.products.length) {
      return next(new ApiError(400, 'Some products do not exist or do not belong to this boutique'));
    }
  }

  promotion = await Promotion.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    message: 'Promotion updated successfully',
    data: promotion
  });
});

/**
 * @desc    Cancel a promotion
 * @route   PATCH /api/promotions/:id/cancel
 * @access  Private (Boutique owner)
 */
exports.cancel = asyncHandler(async (req, res, next) => {
  let promotion = await Promotion.findById(req.params.id);

  if (!promotion) {
    return next(new ApiError(404, 'Promotion not found'));
  }

  // Check ownership
  const boutique = await Boutique.findById(promotion.boutiqueId);
  if (req.user.role !== 'admin' && !boutique.userId.equals(req.user._id)) {
    return next(new ApiError(403, 'You are not authorized to cancel this promotion'));
  }

  // Cannot cancel already ended or cancelled promotions
  if (promotion.status === 'ended' || promotion.status === 'cancelled') {
    return next(new ApiError(400, 'Promotion is already ended or cancelled'));
  }

  promotion = await Promotion.findByIdAndUpdate(
    req.params.id,
    { status: 'cancelled' },
    { new: true }
  );

  res.status(200).json({
    success: true,
    message: 'Promotion cancelled successfully',
    data: promotion
  });
});

/**
 * @desc    Delete a promotion (only scheduled)
 * @route   DELETE /api/promotions/:id
 * @access  Private (Boutique owner or Admin)
 */
exports.delete = asyncHandler(async (req, res, next) => {
  const promotion = await Promotion.findById(req.params.id);

  if (!promotion) {
    return next(new ApiError(404, 'Promotion not found'));
  }

  // Check ownership
  const boutique = await Boutique.findById(promotion.boutiqueId);
  if (req.user.role !== 'admin' && !boutique.userId.equals(req.user._id)) {
    return next(new ApiError(403, 'You are not authorized to delete this promotion'));
  }

  // Only allow deleting scheduled promotions, others should be cancelled
  if (promotion.status !== 'scheduled' && req.user.role !== 'admin') {
    return next(new ApiError(400, 'Only scheduled promotions can be deleted. Use cancel instead.'));
  }

  await Promotion.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Promotion deleted successfully'
  });
});

/**
 * @desc    Get promotion stats for a boutique
 * @route   GET /api/promotions/stats/:boutiqueId
 * @access  Private (Boutique owner)
 */
exports.getStats = asyncHandler(async (req, res, next) => {
  const { boutiqueId } = req.params;

  // Check ownership
  const boutique = await Boutique.findById(boutiqueId);
  if (!boutique) {
    return next(new ApiError(404, 'Boutique not found'));
  }

  if (req.user.role !== 'admin' && !boutique.userId.equals(req.user._id)) {
    return next(new ApiError(403, 'You are not authorized to view these stats'));
  }

  const stats = await Promotion.aggregate([
    { $match: { boutiqueId: boutique._id } },
    {
      $group: {
        _id: null,
        totalPromotions: { $sum: 1 },
        scheduledCount: { $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] } },
        activeCount: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        endedCount: { $sum: { $cond: [{ $eq: ['$status', 'ended'] }, 1, 0] } },
        cancelledCount: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
      }
    }
  ]);

  const typeStats = await Promotion.aggregate([
    { $match: { boutiqueId: boutique._id } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 }
      }
    }
  ]);

  // Get current active promotions
  const activePromotions = await Promotion.find({
    boutiqueId: boutique._id,
    status: 'active'
  })
    .select('title type value startDate endDate')
    .sort('-startDate');

  res.status(200).json({
    success: true,
    data: {
      summary: stats[0] || {
        totalPromotions: 0,
        scheduledCount: 0,
        activeCount: 0,
        endedCount: 0,
        cancelledCount: 0
      },
      byType: typeStats,
      activePromotions,
      canCreateMore: await Promotion.canCreateActivePromotion(boutiqueId)
    }
  });
});

/**
 * @desc    Update promotion statuses (cron job endpoint or manual trigger)
 * @route   POST /api/promotions/update-statuses
 * @access  Private (Admin only)
 */
exports.updateStatuses = asyncHandler(async (req, res) => {
  await Promotion.updateStatuses();

  res.status(200).json({
    success: true,
    message: 'Promotion statuses updated successfully'
  });
});
