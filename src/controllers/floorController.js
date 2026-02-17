const Floor = require('../models/Floor');
const Zone = require('../models/Zone');
const { ApiError, asyncHandler } = require('../middlewares/errorHandler');

/**
 * @desc    Get all floors
 * @route   GET /api/floors
 * @access  Public
 */
exports.getAll = asyncHandler(async (req, res) => {
  const floors = await Floor.find().sort('order').lean();
  res.status(200).json({ success: true, data: floors });
});

/**
 * @desc    Get floor by ID
 * @route   GET /api/floors/:id
 * @access  Public
 */
exports.getById = asyncHandler(async (req, res, next) => {
  const floor = await Floor.findById(req.params.id).lean();
  if (!floor) return next(new ApiError(404, 'Étage non trouvé'));
  res.status(200).json({ success: true, data: floor });
});

/**
 * @desc    Create floor
 * @route   POST /api/floors
 * @access  Private (Admin)
 */
exports.create = asyncHandler(async (req, res) => {
  const floor = await Floor.create(req.body);
  res.status(201).json({ success: true, message: 'Étage créé avec succès', data: floor });
});

/**
 * @desc    Update floor
 * @route   PUT /api/floors/:id
 * @access  Private (Admin)
 */
exports.update = asyncHandler(async (req, res, next) => {
  const floor = await Floor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!floor) return next(new ApiError(404, 'Étage non trouvé'));
  res.status(200).json({ success: true, message: 'Étage mis à jour avec succès', data: floor });
});

/**
 * @desc    Delete floor (only if no zones)
 * @route   DELETE /api/floors/:id
 * @access  Private (Admin)
 */
exports.delete = asyncHandler(async (req, res, next) => {
  const floor = await Floor.findById(req.params.id);
  if (!floor) return next(new ApiError(404, 'Étage non trouvé'));
  const zonesCount = await Zone.countDocuments({ floorId: floor._id });
  if (zonesCount > 0) {
    return next(new ApiError(400, `Impossible de supprimer l'étage : ${zonesCount} zone(s) existante(s). Supprimez-les d'abord.`));
  }
  await Floor.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true, message: 'Étage supprimé avec succès' });
});
