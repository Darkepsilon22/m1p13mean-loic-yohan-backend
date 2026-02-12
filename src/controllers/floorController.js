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
  if (!floor) return next(new ApiError(404, 'Floor not found'));
  res.status(200).json({ success: true, data: floor });
});

/**
 * @desc    Create floor
 * @route   POST /api/floors
 * @access  Private (Admin)
 */
exports.create = asyncHandler(async (req, res) => {
  const floor = await Floor.create(req.body);
  res.status(201).json({ success: true, message: 'Floor created successfully', data: floor });
});

/**
 * @desc    Update floor
 * @route   PUT /api/floors/:id
 * @access  Private (Admin)
 */
exports.update = asyncHandler(async (req, res, next) => {
  const floor = await Floor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!floor) return next(new ApiError(404, 'Floor not found'));
  res.status(200).json({ success: true, message: 'Floor updated successfully', data: floor });
});

/**
 * @desc    Delete floor (only if no zones)
 * @route   DELETE /api/floors/:id
 * @access  Private (Admin)
 */
exports.delete = asyncHandler(async (req, res, next) => {
  const floor = await Floor.findById(req.params.id);
  if (!floor) return next(new ApiError(404, 'Floor not found'));
  const zonesCount = await Zone.countDocuments({ floorId: floor._id });
  if (zonesCount > 0) {
    return next(new ApiError(400, `Cannot delete floor: ${zonesCount} zone(s) exist. Delete them first.`));
  }
  await Floor.findByIdAndDelete(req.params.id);
  res.status(200).json({ success: true, message: 'Floor deleted successfully' });
});
