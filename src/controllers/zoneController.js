const Zone = require('../models/Zone');
const Floor = require('../models/Floor');
const Boutique = require('../models/Boutique');
const { ApiError, asyncHandler } = require('../middlewares/errorHandler');
const { emitToAdmin } = require('../socket');

/**
 * @desc    Get all zones (optional filter by floorId)
 * @route   GET /api/zones
 * @access  Public
 */
exports.getAll = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.floorId) filter.floorId = req.query.floorId;
  const zones = await Zone.find(filter).populate('floorId', 'name order').sort('name').lean();
  res.status(200).json({ success: true, data: zones });
});

/**
 * @desc    Get zones by floor
 * @route   GET /api/zones/by-floor/:floorId
 * @access  Public
 */
exports.getByFloor = asyncHandler(async (req, res, next) => {
  const zones = await Zone.find({ floorId: req.params.floorId }).populate('floorId', 'name order').sort('name').lean();
  res.status(200).json({ success: true, data: zones });
});

/**
 * @desc    Get zone by ID (with optional boutiques)
 * @route   GET /api/zones/:id
 * @access  Public
 */
exports.getById = asyncHandler(async (req, res, next) => {
  const zone = await Zone.findById(req.params.id).populate('floorId', 'name width height order').lean();
  if (!zone) return next(new ApiError(404, 'Zone non trouvée'));
  if (req.query.includeBoutiques === 'true') {
    const boutiques = await Boutique.find({ zoneId: zone._id })
      .populate('categoryId', 'name')
      .select('name surface price emplacementStatus mapShape location')
      .lean();
    zone.boutiques = boutiques;
  }
  res.status(200).json({ success: true, data: zone });
});

/**
 * @desc    Create zone
 * @route   POST /api/zones
 * @access  Private (Admin)
 */
exports.create = asyncHandler(async (req, res, next) => {
  const floor = await Floor.findById(req.body.floorId);
  if (!floor) return next(new ApiError(404, 'Étage non trouvé'));
  const zone = await Zone.create(req.body);
  emitToAdmin('zone:created', { zoneId: zone._id, name: zone.name });
  res.status(201).json({ success: true, message: 'Zone créée avec succès', data: zone });
});

/**
 * @desc    Update zone
 * @route   PUT /api/zones/:id
 * @access  Private (Admin)
 */
exports.update = asyncHandler(async (req, res, next) => {
  const zone = await Zone.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!zone) return next(new ApiError(404, 'Zone non trouvée'));
  emitToAdmin('zone:updated', { zoneId: zone._id, name: zone.name });
  res.status(200).json({ success: true, message: 'Zone mise à jour avec succès', data: zone });
});

/**
 * @desc    Delete zone (only if no boutiques)
 * @route   DELETE /api/zones/:id
 * @access  Private (Admin)
 */
exports.delete = asyncHandler(async (req, res, next) => {
  const zone = await Zone.findById(req.params.id);
  if (!zone) return next(new ApiError(404, 'Zone non trouvée'));
  const boutiquesCount = await Boutique.countDocuments({ zoneId: zone._id });
  if (boutiquesCount > 0) {
    return next(new ApiError(400, `Impossible de supprimer la zone : ${boutiquesCount} boutique(s) présente(s). Retirez-les d'abord.`));
  }
  await Zone.findByIdAndDelete(req.params.id);
  emitToAdmin('zone:deleted', { zoneId: req.params.id, name: zone.name });
  res.status(200).json({ success: true, message: 'Zone supprimée avec succès' });
});
