const Floor = require('../models/Floor');
const Zone = require('../models/Zone');
const Boutique = require('../models/Boutique');
const SpecialSpace = require('../models/SpecialSpace');
const { ApiError, asyncHandler } = require('../middlewares/errorHandler');

/**
 * @desc    Get full floor data for map (zones, boutiques, special spaces)
 * @route   GET /api/map/floor/:floorId
 * @access  Public
 */
exports.getFloorMap = asyncHandler(async (req, res, next) => {
  const floor = await Floor.findById(req.params.floorId).lean();
  if (!floor) return next(new ApiError(404, 'Floor not found'));

  const [zones, boutiques, specialSpaces] = await Promise.all([
    Zone.find({ floorId: floor._id }).lean(),
    Boutique.find({ floorId: floor._id })
      .populate('zoneId', 'name surfaceTotal x y width height')
      .populate('categoryId', 'name')
      .select('name slug surface price emplacementStatus mapShape location zoneId categoryId')
      .lean(),
    SpecialSpace.find({ floorId: floor._id }).lean()
  ]);

  res.status(200).json({
    success: true,
    data: {
      floor,
      zones,
      boutiques,
      specialSpaces
    }
  });
});
