const Event = require('../models/Event');
const { ApiError, asyncHandler } = require('../middlewares/errorHandler');

/**
 * @desc    List events (with filters)
 * @route   GET /api/events
 * @access  Public (published+public only for non-auth; admin sees all)
 */
exports.getAll = asyncHandler(async (req, res, next) => {
  const { status, visibility, isFeatured, startDate, endDate, page = 1, limit = 20, sort = '-startDate' } = req.query;

  const filter = {};

  if (status) filter.status = status;
  if (visibility) filter.visibility = visibility;
  if (isFeatured !== undefined && isFeatured !== '') filter.isFeatured = isFeatured === 'true' || isFeatured === true;
  if (startDate) filter.startDate = { $gte: new Date(startDate) };
  if (endDate) filter.endDate = { $lte: new Date(endDate) };

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, Math.max(1, parseInt(limit, 10)));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const [events, total] = await Promise.all([
    Event.find(filter)
      .populate('createdBy', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Event.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    data: {
      events,
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
 * @desc    Get single event by ID
 * @route   GET /api/events/:id
 * @access  Public
 */
exports.getById = asyncHandler(async (req, res, next) => {
  const event = await Event.findById(req.params.id)
    .populate('createdBy', 'firstName lastName email');

  if (!event) {
    return next(new ApiError(404, 'Event not found'));
  }

  res.status(200).json({
    success: true,
    data: { event }
  });
});

/**
 * @desc    Create an event (admin only)
 * @route   POST /api/events
 * @access  Private (admin)
 */
exports.create = asyncHandler(async (req, res, next) => {
  const body = { ...req.body, createdBy: req.user._id };
  const event = await Event.create(body);

  const populated = await Event.findById(event._id)
    .populate('createdBy', 'firstName lastName email');

  res.status(201).json({
    success: true,
    message: 'Event created successfully',
    data: { event: populated }
  });
});

/**
 * @desc    Update event (admin only)
 * @route   PUT /api/events/:id
 * @access  Private (admin)
 */
exports.update = asyncHandler(async (req, res, next) => {
  const body = { ...req.body };
  delete body._id;
  delete body.createdBy;

  const event = await Event.findByIdAndUpdate(
    req.params.id,
    body,
    { new: true, runValidators: true }
  )
    .populate('createdBy', 'firstName lastName email');

  if (!event) {
    return next(new ApiError(404, 'Event not found'));
  }

  res.status(200).json({
    success: true,
    message: 'Event updated successfully',
    data: { event }
  });
});

/**
 * @desc    Update event status (admin only)
 * @route   PATCH /api/events/:id/status
 * @access  Private (admin)
 */
exports.patchStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;

  const event = await Event.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true }
  )
    .populate('createdBy', 'firstName lastName email');

  if (!event) {
    return next(new ApiError(404, 'Event not found'));
  }

  res.status(200).json({
    success: true,
    message: 'Event status updated successfully',
    data: { event }
  });
});

/**
 * @desc    Delete event (admin only)
 * @route   DELETE /api/events/:id
 * @access  Private (admin)
 */
exports.delete = asyncHandler(async (req, res, next) => {
  const event = await Event.findByIdAndDelete(req.params.id);

  if (!event) {
    return next(new ApiError(404, 'Event not found'));
  }

  res.status(200).json({
    success: true,
    message: 'Event deleted successfully'
  });
});
