const Boutique = require('../models/Boutique');
const Category = require('../models/Category');
const User = require('../models/User');
const ReservationBoutique = require('../models/ReservationBoutique');
const BoutiqueReservationService = require('../services/boutiqueReservationService');
const { ApiError, asyncHandler } = require('../middlewares/errorHandler');

const DAYS = [0, 1, 2, 3, 4, 5, 6];

/**
 * Build default opening hours (7 days, all closed)
 */
const defaultOpeningHours = () =>
  DAYS.map(day => ({ day, open: null, close: null, isClosed: true }));

/**
 * Ensure openingHours has exactly 7 entries (Mon-Sun)
 */
const normalizeOpeningHours = (hours) => {
  if (!hours || !Array.isArray(hours)) return defaultOpeningHours();
  const map = new Map(hours.map(h => [h.day, h]));
  return DAYS.map(day => ({
    day,
    open: (map.get(day) && map.get(day).open) || null,
    close: (map.get(day) && map.get(day).close) || null,
    isClosed: map.get(day) ? !!map.get(day).isClosed : true
  }));
};

/**
 * Check if current user can edit this boutique (admin or owner)
 */
const canEditBoutique = (boutique, userId, userRole) => {
  return userRole === 'admin' || (boutique.userId && boutique.userId.toString() === userId.toString());
};

/**
 * @desc    Get all boutiques (with filters)
 * @route   GET /api/boutiques
 * @access  Public
 */
exports.getAll = asyncHandler(async (req, res, next) => {
  const { category, status, floor, zone, page = 1, limit = 20, sort = '-createdAt' } = req.query;

  const filter = {};

  if (category) filter.categoryId = category;
  if (status) filter.status = status;
  if (floor !== undefined && floor !== '') filter['location.floor'] = Number(floor);
  if (zone) filter['location.zone'] = new RegExp(zone, 'i');

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, Math.max(1, parseInt(limit, 10)));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const [boutiques, total] = await Promise.all([
    Boutique.find(filter)
      .populate('categoryId', 'name slug')
      .populate('userId', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Boutique.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    data: {
      boutiques,
      pagination: {
        page: Math.ceil(skip / limitNum) + 1,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1
      }
    }
  });
});

/**
 * @desc    Get single boutique by ID
 * @route   GET /api/boutiques/:id
 * @access  Public
 */
exports.getById = asyncHandler(async (req, res, next) => {
  const boutique = await Boutique.findById(req.params.id)
    .populate('categoryId', 'name slug')
    .populate('userId', 'firstName lastName email');

  if (!boutique) {
    return next(new ApiError(404, 'Boutique not found'));
  }

  res.status(200).json({
    success: true,
    data: { boutique }
  });
});

/**
 * @desc    Create a new boutique
 * @route   POST /api/boutiques
 * @access  Private (boutique role or admin)
 */
exports.create = asyncHandler(async (req, res, next) => {
  const body = { ...req.body };
  if (body.openingHours == null) body.openingHours = defaultOpeningHours();
  else body.openingHours = normalizeOpeningHours(body.openingHours);

  const userId = req.body.userId || req.user._id;
  if (req.user.role !== 'admin' && userId.toString() !== req.user._id.toString()) {
    return next(new ApiError(403, 'You can only create a boutique for your own account'));
  }

  const existingBoutique = await Boutique.findOne({ userId });
  if (existingBoutique) {
    return next(new ApiError(400, 'This user already has a boutique'));
  }

  const categoryExists = await Category.findById(body.categoryId);
  if (!categoryExists) {
    return next(new ApiError(400, 'Invalid categoryId'));
  }

  const userExists = await User.findById(userId);
  if (!userExists) {
    return next(new ApiError(400, 'Invalid userId'));
  }

  body.userId = userId;
  const boutique = await Boutique.create(body);

  const populated = await Boutique.findById(boutique._id)
    .populate('categoryId', 'name slug')
    .populate('userId', 'firstName lastName email');

  res.status(201).json({
    success: true,
    message: 'Boutique created successfully',
    data: { boutique: populated }
  });
});

/**
 * @desc    Update boutique (full update)
 * @route   PUT /api/boutiques/:id
 * @access  Private (admin or owner)
 */
exports.update = asyncHandler(async (req, res, next) => {
  let boutique = await Boutique.findById(req.params.id);

  if (!boutique) {
    return next(new ApiError(404, 'Boutique not found'));
  }

  if (!canEditBoutique(boutique, req.user._id, req.user.role)) {
    return next(new ApiError(403, 'You can only update your own boutique'));
  }

  const body = { ...req.body };
  delete body._id;
  delete body.userId;
  if (body.openingHours != null) body.openingHours = normalizeOpeningHours(body.openingHours);

  if (body.categoryId) {
    const categoryExists = await Category.findById(body.categoryId);
    if (!categoryExists) return next(new ApiError(400, 'Invalid categoryId'));
  }

  boutique = await Boutique.findByIdAndUpdate(
    req.params.id,
    body,
    { new: true, runValidators: true }
  )
    .populate('categoryId', 'name slug')
    .populate('userId', 'firstName lastName email');

  res.status(200).json({
    success: true,
    message: 'Boutique updated successfully',
    data: { boutique }
  });
});

/**
 * @desc    Update boutique status (validation, activation, deactivation)
 * @route   PATCH /api/boutiques/:id/status
 * @access  Private (admin for validation/blocking; admin or owner for activate/deactivate)
 */
exports.patchStatus = asyncHandler(async (req, res, next) => {
  const { status, rejectionReason } = req.body;

  const boutique = await Boutique.findById(req.params.id);

  if (!boutique) {
    return next(new ApiError(404, 'Boutique not found'));
  }

  const isAdmin = req.user.role === 'admin';
  const isOwner = boutique.userId && boutique.userId.toString() === req.user._id.toString();

  if (status === 'active' || status === 'rejected' || status === 'inactive') {
    if (!isAdmin) {
      if (status === 'rejected') return next(new ApiError(403, 'Only admin can reject a boutique'));
      if (status === 'inactive' && !isOwner && !isAdmin) return next(new ApiError(403, 'Only admin or owner can set inactive'));
    }
  }

  if (!['pending', 'active', 'inactive', 'rejected'].includes(status)) {
    return next(new ApiError(400, 'Invalid status. Use: pending, active, inactive, rejected'));
  }

  boutique.status = status;
  if (status === 'rejected' && rejectionReason != null) boutique.rejectionReason = rejectionReason;
  if (status !== 'rejected') boutique.rejectionReason = undefined;
  await boutique.save();

  const populated = await Boutique.findById(boutique._id)
    .populate('categoryId', 'name slug')
    .populate('userId', 'firstName lastName email');

  res.status(200).json({
    success: true,
    message: 'Boutique status updated successfully',
    data: { boutique: populated }
  });
});

/**
 * @desc    Update boutique location only
 * @route   PATCH /api/boutiques/:id/location
 * @access  Private (admin or owner)
 */
exports.updateLocation = asyncHandler(async (req, res, next) => {
  const boutique = await Boutique.findById(req.params.id);

  if (!boutique) {
    return next(new ApiError(404, 'Boutique not found'));
  }

  if (!canEditBoutique(boutique, req.user._id, req.user.role)) {
    return next(new ApiError(403, 'You can only update your own boutique location'));
  }

  const { floor, zone, number, mapCoordinates } = req.body;
  if (floor !== undefined) boutique.location.floor = floor;
  if (zone !== undefined) boutique.location.zone = zone;
  if (number !== undefined) boutique.location.number = number;
  if (mapCoordinates !== undefined) {
    boutique.location.mapCoordinates = boutique.location.mapCoordinates || {};
    if (mapCoordinates.x !== undefined) boutique.location.mapCoordinates.x = mapCoordinates.x;
    if (mapCoordinates.y !== undefined) boutique.location.mapCoordinates.y = mapCoordinates.y;
  }
  await boutique.save();

  const populated = await Boutique.findById(boutique._id)
    .populate('categoryId', 'name slug')
    .populate('userId', 'firstName lastName email');

  res.status(200).json({
    success: true,
    message: 'Boutique location updated successfully',
    data: { boutique: populated }
  });
});

/**
 * @desc    Delete boutique
 * @route   DELETE /api/boutiques/:id
 * @access  Private (admin or owner)
 */
exports.delete = asyncHandler(async (req, res, next) => {
  const boutique = await Boutique.findById(req.params.id);

  if (!boutique) {
    return next(new ApiError(404, 'Boutique not found'));
  }

  if (!canEditBoutique(boutique, req.user._id, req.user.role)) {
    return next(new ApiError(403, 'You can only delete your own boutique'));
  }

  await Boutique.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Boutique deleted successfully'
  });
});

// ==================== RESERVATION / EMPLACEMENT ROUTES ====================
// Note: Emplacement = Boutique (pas de collection Emplacement séparée)

/**
 * @desc    Obtenir les boutiques (emplacements) libres
 * @route   GET /api/boutiques/emplacements/available
 * @access  Public
 */
exports.getAvailableBoutiques = asyncHandler(async (req, res, next) => {
  const { floor, zone, minPrice, maxPrice, minSurface } = req.query;

  const result = await BoutiqueReservationService.getAvailableBoutiques({
    floor: floor !== undefined ? parseInt(floor) : undefined,
    zone,
    minPrice: minPrice !== undefined ? parseFloat(minPrice) : undefined,
    maxPrice: maxPrice !== undefined ? parseFloat(maxPrice) : undefined,
    minSurface: minSurface !== undefined ? parseFloat(minSurface) : undefined
  });

  res.json({
    success: true,
    count: result.data.length,
    data: result.data
  });
});

/**
 * @desc    Statistiques des emplacements (Admin)
 * @route   GET /api/boutiques/emplacements/stats
 * @access  Admin
 */
exports.getEmplacementStats = asyncHandler(async (req, res, next) => {
  const stats = await Boutique.aggregate([
    {
      $group: {
        _id: '$emplacementStatus',
        count: { $sum: 1 },
        totalSurface: { $sum: '$surface' },
        avgPrice: { $avg: '$price' }
      }
    }
  ]);

  const total = await Boutique.countDocuments();

  res.json({
    success: true,
    data: {
      total,
      byStatus: stats.reduce((acc, s) => {
        acc[s._id || 'undefined'] = {
          count: s.count,
          totalSurface: s.totalSurface || 0,
          avgPrice: s.avgPrice ? Math.round(s.avgPrice) : 0
        };
        return acc;
      }, {})
    }
  });
});

/**
 * @desc    Tous les emplacements avec filtres (Admin)
 * @route   GET /api/boutiques/emplacements/admin/all
 * @access  Admin
 */
exports.getAllEmplacementsAdmin = asyncHandler(async (req, res, next) => {
  const { emplacementStatus, floor, zone } = req.query;
  const query = {};

  if (emplacementStatus) query.emplacementStatus = emplacementStatus;
  if (floor !== undefined) query['location.floor'] = parseInt(floor);
  if (zone) query['location.zone'] = zone;

  const boutiques = await Boutique.find(query)
    .populate('assignee', 'firstName lastName email')
    .populate('userId', 'firstName lastName email')
    .sort({ 'location.floor': 1, 'location.zone': 1, 'location.number': 1 });

  res.json({
    success: true,
    count: boutiques.length,
    data: boutiques
  });
});

/**
 * @desc    Libérer une boutique occupée (Admin - résiliation)
 * @route   POST /api/boutiques/:id/release
 * @access  Admin
 */
exports.releaseBoutique = asyncHandler(async (req, res, next) => {
  const boutique = await Boutique.findById(req.params.id);

  if (!boutique) {
    return next(new ApiError(404, 'Boutique non trouvée'));
  }

  const previousAssignee = boutique.assignee;

  boutique.emplacementStatus = 'libre';
  boutique.assignee = null;
  boutique.reservationExpires = null;
  await boutique.save();

  // Mettre à jour l'historique si nécessaire
  if (previousAssignee) {
    await ReservationBoutique.findOneAndUpdate(
      {
        boutique: req.params.id,
        user: previousAssignee,
        status: { $in: ['temporaire', 'confirmee'] }
      },
      {
        status: 'annulee',
        cancelledAt: new Date(),
        cancellationReason: req.body.reason || 'Libéré par l\'administrateur'
      }
    );
  }

  res.json({
    success: true,
    message: 'Boutique libérée avec succès',
    data: boutique
  });
});

/**
 * @desc    Réserver temporairement une boutique
 * @route   POST /api/boutiques/:id/reserve
 * @access  Boutique (user with role boutique)
 */
exports.reserveBoutique = asyncHandler(async (req, res, next) => {
  try {
    const result = await BoutiqueReservationService.reserveBoutique(
      req.params.id,
      req.user._id
    );

    res.json(result);
  } catch (error) {
    return next(new ApiError(400, error.message));
  }
});

/**
 * @desc    Confirmer une réservation
 * @route   POST /api/boutiques/:id/confirm
 * @access  Boutique
 */
exports.confirmReservation = asyncHandler(async (req, res, next) => {
  try {
    const result = await BoutiqueReservationService.confirmReservation(
      req.params.id,
      req.user._id
    );

    res.json(result);
  } catch (error) {
    return next(new ApiError(400, error.message));
  }
});

/**
 * @desc    Annuler une réservation
 * @route   POST /api/boutiques/:id/cancel
 * @access  Boutique
 */
exports.cancelReservation = asyncHandler(async (req, res, next) => {
  try {
    const result = await BoutiqueReservationService.cancelReservation(
      req.params.id,
      req.user._id,
      req.body.reason
    );

    res.json(result);
  } catch (error) {
    return next(new ApiError(400, error.message));
  }
});

/**
 * @desc    Obtenir ma réservation active
 * @route   GET /api/boutiques/my/reservation
 * @access  Boutique
 */
exports.getMyActiveReservation = asyncHandler(async (req, res, next) => {
  const result = await BoutiqueReservationService.getUserActiveReservation(req.user._id);

  res.json(result);
});

/**
 * @desc    Obtenir mon historique de réservations
 * @route   GET /api/boutiques/my/history
 * @access  Boutique
 */
exports.getMyReservationHistory = asyncHandler(async (req, res, next) => {
  const result = await BoutiqueReservationService.getUserReservationHistory(req.user._id);

  res.json(result);
});

// ==================== ADMIN RESERVATION VALIDATION ROUTES ====================

/**
 * @desc    Obtenir les réservations en attente de validation
 * @route   GET /api/boutiques/reservations/pending
 * @access  Admin
 */
exports.getPendingReservations = asyncHandler(async (req, res, next) => {
  const result = await BoutiqueReservationService.getPendingReservations();

  res.json(result);
});

/**
 * @desc    Valider une réservation
 * @route   POST /api/boutiques/:id/validate
 * @access  Admin
 */
exports.validateReservation = asyncHandler(async (req, res, next) => {
  try {
    const result = await BoutiqueReservationService.validateReservation(
      req.params.id,
      req.user._id
    );

    res.json(result);
  } catch (error) {
    return next(new ApiError(400, error.message));
  }
});

/**
 * @desc    Refuser une réservation
 * @route   POST /api/boutiques/:id/reject
 * @access  Admin
 */
exports.rejectReservation = asyncHandler(async (req, res, next) => {
  try {
    const result = await BoutiqueReservationService.rejectReservation(
      req.params.id,
      req.user._id,
      req.body.reason
    );

    res.json(result);
  } catch (error) {
    return next(new ApiError(400, error.message));
  }
});
