const SpecialSpace = require('../models/SpecialSpace');
const Floor = require('../models/Floor');
const { ApiError, asyncHandler } = require('../middlewares/errorHandler');
const { emitToAdmin } = require('../socket');

/**
 * @desc    Get all special spaces (optional filter by floorId)
 * @route   GET /api/special-spaces
 * @access  Public
 */
exports.getAll = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.floorId) filter.floorId = req.query.floorId;
  const spaces = await SpecialSpace.find(filter).populate('floorId', 'name order').sort('type').lean();
  res.status(200).json({ success: true, data: spaces });
});

/**
 * @desc    Get special spaces by floor
 * @route   GET /api/special-spaces/by-floor/:floorId
 * @access  Public
 */
exports.getByFloor = asyncHandler(async (req, res) => {
  const spaces = await SpecialSpace.find({ floorId: req.params.floorId })
    .populate('floorId', 'name order')
    .sort('type')
    .lean();
  res.status(200).json({ success: true, data: spaces });
});

/**
 * @desc    Get special space by ID
 * @route   GET /api/special-spaces/:id
 * @access  Public
 */
exports.getById = asyncHandler(async (req, res, next) => {
  const space = await SpecialSpace.findById(req.params.id).populate('floorId', 'name width height order').lean();
  if (!space) return next(new ApiError(404, 'Espace spécial non trouvé'));
  res.status(200).json({ success: true, data: space });
});

/**
 * @desc    Create special space
 * @route   POST /api/special-spaces
 * @access  Private (Admin)
 */
exports.create = asyncHandler(async (req, res, next) => {
  const floor = await Floor.findById(req.body.floorId);
  if (!floor) return next(new ApiError(404, 'Étage non trouvé'));
  const space = await SpecialSpace.create(req.body);
  emitToAdmin('specialSpace:created', { spaceId: space._id, name: space.name, type: space.type });
  res.status(201).json({ success: true, message: 'Espace spécial créé avec succès', data: space });
});

/**
 * @desc    Update special space
 * @route   PUT /api/special-spaces/:id
 * @access  Private (Admin)
 */
exports.update = asyncHandler(async (req, res, next) => {
  const space = await SpecialSpace.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!space) return next(new ApiError(404, 'Espace spécial non trouvé'));
  emitToAdmin('specialSpace:updated', { spaceId: space._id, name: space.name });
  res.status(200).json({ success: true, message: 'Espace spécial mis à jour avec succès', data: space });
});

/**
 * @desc    Delete special space
 * @route   DELETE /api/special-spaces/:id
 * @access  Private (Admin)
 */
exports.delete = asyncHandler(async (req, res, next) => {
  const space = await SpecialSpace.findByIdAndDelete(req.params.id);
  if (!space) return next(new ApiError(404, 'Espace spécial non trouvé'));
  emitToAdmin('specialSpace:deleted', { spaceId: req.params.id });
  res.status(200).json({ success: true, message: 'Espace spécial supprimé avec succès' });
});
