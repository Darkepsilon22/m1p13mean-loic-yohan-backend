const Boutique = require('../models/Boutique');
const Category = require('../models/Category');
const User = require('../models/User');
const Zone = require('../models/Zone');
const ReservationBoutique = require('../models/ReservationBoutique');
const BoutiqueReservationService = require('../services/boutiqueReservationService');
const ExcelJS = require('exceljs');
const { ApiError, asyncHandler } = require('../middlewares/errorHandler');
const { emitToAdmin, emitToUser, emitToBoutique } = require('../socket');

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
 * Validate zone constraints when zoneId and mapShape are set:
 * - mapShape must be inside zone bounds
 * - sum of surfaces in zone must not exceed zone.surfaceTotal
 * @param {Object} options - { zoneId, floorId, mapShape, surface, excludeBoutiqueId }
 * @throws {ApiError} if invalid
 */
const validateBoutiqueZoneConstraints = async (options) => {
  const { zoneId, floorId, mapShape, surface, excludeBoutiqueId } = options;
  if (!zoneId || !mapShape || mapShape.x == null || mapShape.y == null || mapShape.width == null || mapShape.height == null) {
    return;
  }
  const zone = await Zone.findById(zoneId);
  if (!zone) throw new ApiError(404, 'Zone non trouvée');
  const { x, y, width, height } = mapShape;
  if (x < zone.x || y < zone.y || x + width > zone.x + zone.width || y + height > zone.y + zone.height) {
    throw new ApiError(400, 'Le rectangle de la boutique doit être entièrement à l\'intérieur de la zone.');
  }
  const surfaceNum = surface != null ? Number(surface) : 0;
  const query = { zoneId };
  if (excludeBoutiqueId) query._id = { $ne: excludeBoutiqueId };
  const existingSum = await Boutique.aggregate([{ $match: query }, { $group: { _id: null, total: { $sum: { $ifNull: ['$surface', 0] } } } }]);
  const totalSurface = (existingSum[0]?.total || 0) + surfaceNum;
  if (totalSurface > zone.surfaceTotal) {
    throw new ApiError(400, `La surface totale dans la zone dépasserait la capacité (${zone.surfaceTotal} m²). Disponible : ${zone.surfaceTotal - (existingSum[0]?.total || 0)} m².`);
  }
};

/**
 * @desc    Get all boutiques (with filters)
 * @route   GET /api/boutiques
 * @access  Public
 */
exports.getAll = asyncHandler(async (req, res, next) => {
  const { category, status, floor, zone, floorId, search, page = 1, limit = 20, sort = '-createdAt' } = req.query;

  const filter = {};

  if (search && String(search).trim()) {
    filter.name = new RegExp(String(search).trim(), 'i');
  }
  if (category) filter.categoryId = category;
  if (status) filter.status = status;
  if (floorId) filter.floorId = floorId;
  else if (floor !== undefined && floor !== '') filter['location.floor'] = Number(floor);
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
    .populate('userId', 'firstName lastName email')
    .populate('zoneId', 'name')
    .populate('floorId', 'name order');

  if (!boutique) {
    return next(new ApiError(404, 'Boutique non trouvée'));
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

  const isAdminEmplacement = req.user.role === 'admin' && body.zoneId && body.mapShape;
  const userId = isAdminEmplacement && body.userId == null
    ? null
    : (req.body.userId || req.user._id);
  if (req.user.role !== 'admin' && userId && userId.toString() !== req.user._id.toString()) {
    return next(new ApiError(403, 'Vous ne pouvez créer une boutique que pour votre propre compte.'));
  }

  if (!isAdminEmplacement) {
    const existingBoutique = await Boutique.findOne({ userId });
    if (existingBoutique) {
      return next(new ApiError(400, 'Cet utilisateur possède déjà une boutique.'));
    }
  }

  const categoryExists = await Category.findById(body.categoryId);
  if (!categoryExists) {
    return next(new ApiError(400, 'Catégorie invalide.'));
  }

  if (userId) {
    const userExists = await User.findById(userId);
    if (!userExists) {
      return next(new ApiError(400, 'Utilisateur invalide.'));
    }
  }

  if (body.zoneId && body.mapShape) {
    await validateBoutiqueZoneConstraints({
      zoneId: body.zoneId,
      floorId: body.floorId,
      mapShape: body.mapShape,
      surface: body.surface
    });
    if (!body.floorId) {
      const zone = await Zone.findById(body.zoneId).select('floorId').lean();
      if (zone) body.floorId = zone.floorId;
    }
  }

  body.userId = userId;
  const boutique = await Boutique.create(body);

  const populated = await Boutique.findById(boutique._id)
    .populate('categoryId', 'name slug')
    .populate('userId', 'firstName lastName email');

  emitToAdmin('boutique:created', { boutiqueId: populated._id, name: populated.name });

  res.status(201).json({
    success: true,
    message: 'Boutique créée avec succès',
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
    return next(new ApiError(404, 'Boutique non trouvée'));
  }

  if (!canEditBoutique(boutique, req.user._id, req.user.role)) {
    return next(new ApiError(403, 'Vous ne pouvez modifier que votre propre boutique.'));
  }

  const body = { ...req.body };
  delete body._id;
  delete body.userId;
  if (body.openingHours != null) body.openingHours = normalizeOpeningHours(body.openingHours);

  if (body.categoryId) {
    const categoryExists = await Category.findById(body.categoryId);
    if (!categoryExists) return next(new ApiError(400, 'Catégorie invalide.'));
  }

  const zoneId = body.zoneId !== undefined ? body.zoneId : boutique.zoneId;
  const mapShape = body.mapShape !== undefined ? body.mapShape : boutique.mapShape;
  const surface = body.surface !== undefined ? body.surface : boutique.surface;
  if (zoneId && mapShape && mapShape.x != null && mapShape.y != null && mapShape.width != null && mapShape.height != null) {
    await validateBoutiqueZoneConstraints({
      zoneId,
      floorId: body.floorId !== undefined ? body.floorId : boutique.floorId,
      mapShape,
      surface,
      excludeBoutiqueId: req.params.id
    });
  }

  boutique = await Boutique.findByIdAndUpdate(
    req.params.id,
    body,
    { new: true, runValidators: true }
  )
    .populate('categoryId', 'name slug')
    .populate('userId', 'firstName lastName email');

  emitToAdmin('boutique:updated', { boutiqueId: boutique._id, name: boutique.name });
  if (boutique._id) emitToBoutique(boutique._id.toString(), 'boutique:updated', { boutiqueId: boutique._id, name: boutique.name });

  res.status(200).json({
    success: true,
    message: 'Boutique mise à jour avec succès',
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
    return next(new ApiError(404, 'Boutique non trouvée'));
  }

  const isAdmin = req.user.role === 'admin';
  const isOwner = boutique.userId && boutique.userId.toString() === req.user._id.toString();

  if (status === 'active' || status === 'rejected' || status === 'inactive') {
    if (!isAdmin) {
      if (status === 'rejected') return next(new ApiError(403, 'Seul l\'administrateur peut refuser une boutique.'));
      if (status === 'inactive' && !isOwner && !isAdmin) return next(new ApiError(403, 'Seul l\'administrateur ou le propriétaire peut désactiver.'));
    }
  }

  if (!['pending', 'active', 'inactive', 'rejected'].includes(status)) {
    return next(new ApiError(400, 'Statut invalide. Utiliser : pending, active, inactive, rejected.'));
  }

  boutique.status = status;
  if (status === 'rejected' && rejectionReason != null) boutique.rejectionReason = rejectionReason;
  if (status !== 'rejected') boutique.rejectionReason = undefined;
  await boutique.save();

  const populated = await Boutique.findById(boutique._id)
    .populate('categoryId', 'name slug')
    .populate('userId', 'firstName lastName email');

  if (populated.userId) emitToBoutique(populated._id.toString(), 'boutique:statusChanged', { boutiqueId: populated._id, name: populated.name, status });
  emitToAdmin('boutique:statusChanged', { boutiqueId: populated._id, name: populated.name, status });

  res.status(200).json({
    success: true,
    message: 'Statut de la boutique mis à jour avec succès',
    data: { boutique: populated }
  });
});

/**
 * @desc    Update boutique location only (champs legacy: location.floor, zone, number, mapCoordinates).
 *          Ne met pas à jour zoneId, floorId, mapShape (modélisation) — utiliser PUT /api/boutiques/:id pour cela.
 * @route   PATCH /api/boutiques/:id/location
 * @access  Private (admin or owner)
 */
exports.updateLocation = asyncHandler(async (req, res, next) => {
  const boutique = await Boutique.findById(req.params.id);

  if (!boutique) {
    return next(new ApiError(404, 'Boutique non trouvée'));
  }

  if (!canEditBoutique(boutique, req.user._id, req.user.role)) {
    return next(new ApiError(403, 'Vous ne pouvez modifier que l\'emplacement de votre propre boutique.'));
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
    message: 'Emplacement de la boutique mis à jour avec succès',
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
    return next(new ApiError(404, 'Boutique non trouvée'));
  }

  if (!canEditBoutique(boutique, req.user._id, req.user.role)) {
    return next(new ApiError(403, 'Vous ne pouvez supprimer que votre propre boutique.'));
  }

  await Boutique.findByIdAndDelete(req.params.id);

  emitToAdmin('boutique:deleted', { boutiqueId: req.params.id, name: boutique.name });

  res.status(200).json({
    success: true,
    message: 'Boutique supprimée avec succès'
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
  const { floor, zone, floorId, minPrice, maxPrice, minSurface } = req.query;

  const result = await BoutiqueReservationService.getAvailableBoutiques({
    floor: floor !== undefined ? parseInt(floor) : undefined,
    zone,
    floorId: floorId || undefined,
    minPrice: minPrice !== undefined ? parseFloat(minPrice) : undefined,
    maxPrice: maxPrice !== undefined ? parseFloat(maxPrice) : undefined,
    minSurface: minSurface !== undefined ? parseFloat(minSurface) : undefined
  });

  res.json({
    success: true,
    count: result.data.length,
    data: {
      boutiques: result.data
    }
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
  const { emplacementStatus, floor, zone, floorId } = req.query;
  const query = {};

  if (emplacementStatus) query.emplacementStatus = emplacementStatus;
  if (floorId) query.floorId = floorId;
  else if (floor !== undefined) query['location.floor'] = parseInt(floor);
  if (zone) query['location.zone'] = new RegExp(zone, 'i');

  const boutiques = await Boutique.find(query)
    .populate('assignee', 'firstName lastName email')
    .populate('userId', 'firstName lastName email')
    .populate('zoneId', 'name')
    .populate('floorId', 'name order')
    .sort({ floorId: 1, 'location.floor': 1, 'location.zone': 1, 'location.number': 1 });

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

  // Locataire actuel : modélisation utilise userId (assignee conservé pour compatibilité)
  const previousUserId = boutique.userId || boutique.assignee;

  boutique.emplacementStatus = 'libre';
  boutique.userId = null;
  boutique.assignee = null;
  boutique.reservationExpires = null;
  await boutique.save();

  // Mettre à jour la réservation confirmée en annulée
  if (previousUserId) {
    await ReservationBoutique.findOneAndUpdate(
      {
        boutique: req.params.id,
        user: previousUserId,
        status: 'confirmee'
      },
      {
        status: 'annulee',
        cancelledAt: new Date(),
        cancellationReason: req.body.reason || 'Libéré par l\'administrateur'
      }
    );
  }

  if (previousUserId) emitToBoutique(req.params.id, 'boutique:released', { boutiqueId: req.params.id });
  emitToAdmin('boutique:released', { boutiqueId: req.params.id, name: boutique.name });

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

    emitToAdmin('reservation:created', { boutiqueId: req.params.id, userId: req.user._id });
    emitToUser(req.user._id.toString(), 'reservation:created', { boutiqueId: req.params.id });

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

    emitToAdmin('reservation:confirmed', { boutiqueId: req.params.id, userId: req.user._id });
    emitToUser(req.user._id.toString(), 'reservation:confirmed', { boutiqueId: req.params.id });

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

    emitToAdmin('reservation:cancelled', { boutiqueId: req.params.id, userId: req.user._id });
    emitToUser(req.user._id.toString(), 'reservation:cancelled', { boutiqueId: req.params.id });

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

    const reservation = await ReservationBoutique.findOne({ boutique: req.params.id, status: 'confirmee' });
    if (reservation) emitToUser(reservation.user.toString(), 'reservation:validated', { boutiqueId: req.params.id });

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
    const reservation = await ReservationBoutique.findOne({ boutique: req.params.id, status: { $in: ['en_attente', 'confirmee'] } });

    const result = await BoutiqueReservationService.rejectReservation(
      req.params.id,
      req.user._id,
      req.body.reason
    );

    if (reservation) emitToUser(reservation.user.toString(), 'reservation:rejected', { boutiqueId: req.params.id, reason: req.body.reason });

    res.json(result);
  } catch (error) {
    return next(new ApiError(400, error.message));
  }
});

/**
 * @desc    Download Excel template for emplacement import
 * @route   GET /api/boutiques/import/template
 * @access  Private (Admin)
 */
exports.importTemplate = asyncHandler(async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Emplacements');

  sheet.columns = [
    { header: 'Nom *', key: 'name', width: 30 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Catégorie (nom) *', key: 'category', width: 20 },
    { header: 'Étage', key: 'floor', width: 10 },
    { header: 'Zone', key: 'zone', width: 15 },
    { header: 'Numéro', key: 'number', width: 10 },
    { header: 'Surface (m²)', key: 'surface', width: 12 },
    { header: 'Prix (Ar)', key: 'price', width: 15 }
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0ABDE3' } };
  });

  sheet.addRow({ name: 'Emplacement A1', description: 'Emplacement au rez-de-chaussée', category: 'Mode', floor: 0, zone: 'A', number: '01', surface: 25, price: 450000 });

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=template-emplacements.xlsx');
  res.send(Buffer.from(buffer));
});

/**
 * @desc    Import emplacements from Excel file
 * @route   POST /api/boutiques/import
 * @access  Private (Admin)
 */
exports.importExcel = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ApiError(400, 'Fichier Excel requis'));
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(req.file.buffer);
  const sheet = workbook.worksheets[0];

  if (!sheet) {
    return next(new ApiError(400, 'Le fichier ne contient aucune feuille'));
  }

  const allCategories = await Category.find({}).lean();
  const categoryMap = {};
  allCategories.forEach(c => { categoryMap[c.name.toLowerCase()] = c._id; });

  const results = { created: 0, errors: [] };
  const rows = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    rows.push({ rowNumber, values: row.values });
  });

  for (const { rowNumber, values } of rows) {
    try {
      const name = values[1] ? String(values[1]).trim() : '';
      const categoryName = values[3] ? String(values[3]).trim() : '';

      if (!name) {
        results.errors.push({ row: rowNumber, message: 'Nom requis' });
        continue;
      }
      if (!categoryName) {
        results.errors.push({ row: rowNumber, message: 'Catégorie requise' });
        continue;
      }

      const categoryId = categoryMap[categoryName.toLowerCase()];
      if (!categoryId) {
        results.errors.push({ row: rowNumber, message: `Catégorie "${categoryName}" introuvable` });
        continue;
      }

      const floorVal = values[4] != null && !isNaN(Number(values[4])) ? Number(values[4]) : 0;
      const zoneVal = values[5] ? String(values[5]).trim() : '';
      const numberVal = values[6] ? String(values[6]).trim() : '';
      const surfaceVal = values[7] != null && !isNaN(Number(values[7])) ? Number(values[7]) : null;
      const priceVal = values[8] != null && !isNaN(Number(values[8])) ? Number(values[8]) : null;

      const doc = new Boutique({
        name,
        description: values[2] ? String(values[2]).trim() : '',
        categoryId,
        location: { floor: floorVal, zone: zoneVal, number: numberVal },
        surface: surfaceVal,
        price: priceVal,
        openingHours: defaultOpeningHours(),
        status: 'active',
        emplacementStatus: 'libre'
      });
      // Remove userId so sparse index ignores this document
      doc.userId = undefined;
      await doc.save();

      results.created++;
    } catch (err) {
      results.errors.push({ row: rowNumber, message: err.message });
    }
  }

  res.status(200).json({
    success: true,
    message: `${results.created} emplacement(s) importé(s)`,
    data: results
  });
});
