const Zone = require('../models/Zone');
const Floor = require('../models/Floor');
const Boutique = require('../models/Boutique');
const { ApiError, asyncHandler } = require('../middlewares/errorHandler');

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
  if (!zone) return next(new ApiError(404, 'Zone not found'));
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
  if (!floor) return next(new ApiError(404, 'Floor not found'));
  const zone = await Zone.create(req.body);
  res.status(201).json({ success: true, message: 'Zone created successfully', data: zone });
});

/**
 * @desc    Update zone
 * @route   PUT /api/zones/:id
 * @access  Private (Admin)
 */
exports.update = asyncHandler(async (req, res, next) => {
  const zone = await Zone.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!zone) return next(new ApiError(404, 'Zone not found'));
  res.status(200).json({ success: true, message: 'Zone updated successfully', data: zone });
});

/**
 * @desc    Delete zone (only if no boutiques)
 * @route   DELETE /api/zones/:id
 * @access  Private (Admin)
 */
exports.delete = asyncHandler(async (req, res, next) => {
  const zone = await Zone.findById(req.params.id);
  if (!zone) return next(new ApiError(404, 'Zone not found'));
  const boutiquesCount = await Boutique.countDocuments({ zoneId: zone._id });
  if (boutiquesCount > 0) {
    return next(new ApiError(400, `Cannot delete zone: ${boutiquesCount} boutique(s) exist. Remove them first.`));
  }
  await Zone.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true, message: 'Zone deleted successfully' });
});
