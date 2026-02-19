const Product = require('../models/Product');
const Boutique = require('../models/Boutique');
const { asyncHandler, ApiError } = require('../middlewares/errorHandler');
const { emitToAdmin, emitToPublic, emitToBoutique } = require('../socket');

/**
 * @desc    Get all products (with filters)
 * @route   GET /api/products
 * @access  Public
 */
exports.getAll = asyncHandler(async (req, res) => {
  const {
    boutiqueId,
    category,
    availability,
    minPrice,
    maxPrice,
    isFeatured,
    search,
    sort = '-createdAt',
    page = 1,
    limit = 20
  } = req.query;

  const query = { isArchived: false };

  // Filter by boutique
  if (boutiqueId) {
    query.boutiqueId = boutiqueId;
  }

  // Filter by internal category
  if (category) {
    query.categoryInternal = category;
  }

  // Filter by availability
  if (availability) {
    query.availability = availability;
  }

  // Filter by price range
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseFloat(minPrice);
    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
  }

  // Filter by featured
  if (isFeatured === 'true') {
    query.isFeatured = true;
  }

  // Text search
  if (search) {
    query.$text = { $search: search };
  }

  // Only show products from active boutiques
  const activeBoutiques = await Boutique.find({ status: 'active' }).select('_id');
  const activeBoutiqueIds = activeBoutiques.map(b => b._id);
  query.boutiqueId = query.boutiqueId
    ? { $in: [query.boutiqueId].filter(id => activeBoutiqueIds.some(bid => bid.equals(id))) }
    : { $in: activeBoutiqueIds };

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('boutiqueId', 'name slug logo')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit)),
    Product.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: products,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

/**
 * @desc    Get product by ID
 * @route   GET /api/products/:id
 * @access  Public
 */
exports.getById = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id)
    .populate('boutiqueId', 'name slug logo contact location openingHours');

  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  // Increment views
  await Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

  res.status(200).json({
    success: true,
    data: product
  });
});

/**
 * @desc    Get product by slug
 * @route   GET /api/products/slug/:slug
 * @access  Public
 */
exports.getBySlug = asyncHandler(async (req, res, next) => {
  const product = await Product.findOne({ slug: req.params.slug })
    .populate('boutiqueId', 'name slug logo contact location openingHours');

  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  // Increment views
  await Product.findByIdAndUpdate(product._id, { $inc: { views: 1 } });

  res.status(200).json({
    success: true,
    data: product
  });
});

/**
 * @desc    Get products by boutique
 * @route   GET /api/products/boutique/:boutiqueId
 * @access  Public
 */
exports.getByBoutique = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, availability, category, sort = '-createdAt' } = req.query;

  const query = {
    boutiqueId: req.params.boutiqueId,
    isArchived: false
  };

  if (availability) query.availability = availability;
  if (category) query.categoryInternal = category;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [products, total] = await Promise.all([
    Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit)),
    Product.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: products,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

/**
 * @desc    Get featured products
 * @route   GET /api/products/featured
 * @access  Public
 */
exports.getFeatured = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  // Only from active boutiques
  const activeBoutiques = await Boutique.find({ status: 'active' }).select('_id');
  const activeBoutiqueIds = activeBoutiques.map(b => b._id);

  const products = await Product.find({
    boutiqueId: { $in: activeBoutiqueIds },
    isFeatured: true,
    isArchived: false,
    availability: 'available'
  })
    .populate('boutiqueId', 'name slug logo')
    .sort('-createdAt')
    .limit(parseInt(limit));

  res.status(200).json({
    success: true,
    data: products
  });
});

/**
 * @desc    Create a product
 * @route   POST /api/products
 * @access  Private (Boutique owner)
 */
exports.create = asyncHandler(async (req, res, next) => {
  const { boutiqueId, name, description, price, originalPrice, photos, categoryInternal, availability, isFeatured, stock, lowStockThreshold } = req.body;

  // Check if boutique exists and belongs to user
  const boutique = await Boutique.findById(boutiqueId);
  if (!boutique) {
    return next(new ApiError(404, 'Boutique not found'));
  }

  // Check ownership (unless admin)
  if (req.user.role !== 'admin' && !boutique.userId.equals(req.user._id)) {
    return next(new ApiError(403, 'You are not authorized to add products to this boutique'));
  }

  // Check boutique status
  if (boutique.status !== 'active') {
    return next(new ApiError(400, 'Cannot add products to inactive boutique'));
  }

  const product = await Product.create({
    boutiqueId,
    name,
    description,
    price,
    originalPrice,
    photos,
    categoryInternal,
    availability,
    isFeatured,
    stock,
    lowStockThreshold
  });

  emitToAdmin('product:created', { productId: product._id, name: product.name, boutiqueId });
  emitToPublic('product:created', { productId: product._id, name: product.name, boutiqueId });

  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: product
  });
});

/**
 * @desc    Update a product
 * @route   PUT /api/products/:id
 * @access  Private (Boutique owner)
 */
exports.update = asyncHandler(async (req, res, next) => {
  let product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  // Check ownership
  const boutique = await Boutique.findById(product.boutiqueId);
  if (req.user.role !== 'admin' && !boutique.userId.equals(req.user._id)) {
    return next(new ApiError(403, 'You are not authorized to update this product'));
  }

  const allowedFields = ['name', 'description', 'price', 'originalPrice', 'photos', 'mainPhoto', 'categoryInternal', 'availability', 'isFeatured', 'stock', 'lowStockThreshold'];
  const updates = {};

  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  // Update slug if name changed
  if (updates.name && updates.name !== product.name) {
    const slugify = require('slugify');
    const baseSlug = slugify(updates.name, { lower: true, strict: true });
    updates.slug = `${baseSlug}-${product.boutiqueId.toString().slice(-6)}`;
  }

  product = await Product.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true }
  );

  emitToAdmin('product:updated', { productId: product._id, name: product.name });
  emitToBoutique(product.boutiqueId.toString(), 'product:updated', { productId: product._id, name: product.name });

  res.status(200).json({
    success: true,
    message: 'Product updated successfully',
    data: product
  });
});

/**
 * @desc    Update product availability
 * @route   PATCH /api/products/:id/availability
 * @access  Private (Boutique owner)
 */
exports.patchAvailability = asyncHandler(async (req, res, next) => {
  const { availability } = req.body;

  let product = await Product.findById(req.params.id);
  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  // Check ownership
  const boutique = await Boutique.findById(product.boutiqueId);
  if (req.user.role !== 'admin' && !boutique.userId.equals(req.user._id)) {
    return next(new ApiError(403, 'You are not authorized to update this product'));
  }

  product = await Product.findByIdAndUpdate(
    req.params.id,
    { availability },
    { new: true, runValidators: true }
  );

  emitToPublic('product:availabilityChanged', { productId: product._id, name: product.name, availability });

  res.status(200).json({
    success: true,
    message: 'Product availability updated',
    data: product
  });
});

/**
 * @desc    Toggle featured status
 * @route   PATCH /api/products/:id/featured
 * @access  Private (Boutique owner)
 */
exports.toggleFeatured = asyncHandler(async (req, res, next) => {
  let product = await Product.findById(req.params.id);
  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  // Check ownership
  const boutique = await Boutique.findById(product.boutiqueId);
  if (req.user.role !== 'admin' && !boutique.userId.equals(req.user._id)) {
    return next(new ApiError(403, 'You are not authorized to update this product'));
  }

  product = await Product.findByIdAndUpdate(
    req.params.id,
    { isFeatured: !product.isFeatured },
    { new: true }
  );

  emitToPublic('product:featuredToggled', { productId: product._id, name: product.name, isFeatured: product.isFeatured });

  res.status(200).json({
    success: true,
    message: `Product ${product.isFeatured ? 'marked as featured' : 'removed from featured'}`,
    data: product
  });
});

/**
 * @desc    Delete (archive) a product - RG23: Products are archived, not deleted
 * @route   DELETE /api/products/:id
 * @access  Private (Boutique owner or Admin)
 */
exports.delete = asyncHandler(async (req, res, next) => {
  let product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  // Check ownership
  const boutique = await Boutique.findById(product.boutiqueId);
  if (req.user.role !== 'admin' && !boutique.userId.equals(req.user._id)) {
    return next(new ApiError(403, 'You are not authorized to delete this product'));
  }

  await Product.findByIdAndUpdate(req.params.id, { isArchived: true });

  emitToAdmin('product:archived', { productId: req.params.id, name: product.name });
  emitToBoutique(product.boutiqueId.toString(), 'product:archived', { productId: req.params.id, name: product.name });

  res.status(200).json({
    success: true,
    message: 'Product archived successfully'
  });
});

/**
 * @desc    Restore an archived product
 * @route   PATCH /api/products/:id/restore
 * @access  Private (Boutique owner or Admin)
 */
exports.restore = asyncHandler(async (req, res, next) => {
  let product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  // Check ownership
  const boutique = await Boutique.findById(product.boutiqueId);
  if (req.user.role !== 'admin' && !boutique.userId.equals(req.user._id)) {
    return next(new ApiError(403, 'You are not authorized to restore this product'));
  }

  product = await Product.findByIdAndUpdate(
    req.params.id,
    { isArchived: false },
    { new: true }
  );

  emitToAdmin('product:restored', { productId: product._id, name: product.name });
  emitToBoutique(product.boutiqueId.toString(), 'product:restored', { productId: product._id, name: product.name });

  res.status(200).json({
    success: true,
    message: 'Product restored successfully',
    data: product
  });
});

/**
 * @desc    Get product stats for a boutique
 * @route   GET /api/products/stats/:boutiqueId
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

  const stats = await Product.aggregate([
    { $match: { boutiqueId: boutique._id, isArchived: false } },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        totalViews: { $sum: '$views' },
        totalStock: { $sum: '$stock' },
        avgPrice: { $avg: '$price' },
        featuredCount: { $sum: { $cond: ['$isFeatured', 1, 0] } },
        availableCount: { $sum: { $cond: [{ $eq: ['$availability', 'available'] }, 1, 0] } },
        outOfStockCount: { $sum: { $cond: [{ $eq: ['$availability', 'outOfStock'] }, 1, 0] } },
        onOrderCount: { $sum: { $cond: [{ $eq: ['$availability', 'onOrder'] }, 1, 0] } },
        lowStockCount: {
          $sum: {
            $cond: [
              { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  const categoryStats = await Product.aggregate([
    { $match: { boutiqueId: boutique._id, isArchived: false } },
    {
      $group: {
        _id: '$categoryInternal',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  res.status(200).json({
    success: true,
    data: {
      summary: stats[0] || {
        totalProducts: 0,
        totalViews: 0,
        totalStock: 0,
        avgPrice: 0,
        featuredCount: 0,
        availableCount: 0,
        outOfStockCount: 0,
        onOrderCount: 0,
        lowStockCount: 0
      },
      byCategory: categoryStats
    }
  });
});

/**
 * @desc    Get my products (for boutique owner)
 * @route   GET /api/products/my-products
 * @access  Private (Boutique owner)
 */
exports.getMyProducts = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, availability, category, search, sort = '-createdAt', includeArchived } = req.query;

  // Find boutique owned by user
  const boutique = await Boutique.findOne({ userId: req.user._id });
  if (!boutique) {
    return next(new ApiError(404, 'You do not have a boutique'));
  }

  const query = { boutiqueId: boutique._id };

  // Include archived products if requested
  if (includeArchived !== 'true') {
    query.isArchived = false;
  }

  if (availability) query.availability = availability;
  if (category) query.categoryInternal = category;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [products, total] = await Promise.all([
    Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit)),
    Product.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: products,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

/**
 * @desc    Get my products stats (for boutique owner)
 * @route   GET /api/products/my-products/stats
 * @access  Private (Boutique owner)
 */
exports.getMyProductsStats = asyncHandler(async (req, res, next) => {
  // Find boutique owned by user
  const boutique = await Boutique.findOne({ userId: req.user._id });
  if (!boutique) {
    return next(new ApiError(404, 'You do not have a boutique'));
  }

  const stats = await Product.aggregate([
    { $match: { boutiqueId: boutique._id, isArchived: false } },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        totalViews: { $sum: '$views' },
        totalStock: { $sum: '$stock' },
        avgPrice: { $avg: '$price' },
        featuredCount: { $sum: { $cond: ['$isFeatured', 1, 0] } },
        availableCount: { $sum: { $cond: [{ $eq: ['$availability', 'available'] }, 1, 0] } },
        outOfStockCount: { $sum: { $cond: [{ $eq: ['$availability', 'outOfStock'] }, 1, 0] } },
        onOrderCount: { $sum: { $cond: [{ $eq: ['$availability', 'onOrder'] }, 1, 0] } },
        lowStockCount: {
          $sum: {
            $cond: [
              { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  const archivedCount = await Product.countDocuments({ boutiqueId: boutique._id, isArchived: true });

  res.status(200).json({
    success: true,
    data: {
      ...stats[0] || {
        totalProducts: 0,
        totalViews: 0,
        totalStock: 0,
        avgPrice: 0,
        featuredCount: 0,
        availableCount: 0,
        outOfStockCount: 0,
        onOrderCount: 0,
        lowStockCount: 0
      },
      archivedCount
    }
  });
});

/**
 * @desc    Archive a product
 * @route   PATCH /api/products/:id/archive
 * @access  Private (Boutique owner or Admin)
 */
exports.archive = asyncHandler(async (req, res, next) => {
  let product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  // Check ownership
  const boutique = await Boutique.findById(product.boutiqueId);
  if (req.user.role !== 'admin' && !boutique.userId.equals(req.user._id)) {
    return next(new ApiError(403, 'You are not authorized to archive this product'));
  }

  if (product.isArchived) {
    return next(new ApiError(400, 'Product is already archived'));
  }

  product = await Product.findByIdAndUpdate(
    req.params.id,
    { isArchived: true },
    { new: true }
  );

  emitToAdmin('product:archived', { productId: product._id, name: product.name });
  emitToBoutique(product.boutiqueId.toString(), 'product:archived', { productId: product._id, name: product.name });

  res.status(200).json({
    success: true,
    message: 'Product archived successfully',
    data: product
  });
});

/**
 * @desc    Get all products for admin (including all boutiques)
 * @route   GET /api/products/admin/all
 * @access  Private (Admin only)
 */
exports.adminGetAll = asyncHandler(async (req, res) => {
  const {
    boutiqueId,
    availability,
    search,
    isArchived,
    isFeatured,
    sort = '-createdAt',
    page = 1,
    limit = 50
  } = req.query;

  const query = {};

  if (boutiqueId) query.boutiqueId = boutiqueId;
  if (availability) query.availability = availability;
  if (isArchived === 'true') query.isArchived = true;
  else if (isArchived === 'false') query.isArchived = false;
  if (isFeatured === 'true') query.isFeatured = true;
  else if (isFeatured === 'false') query.isFeatured = false;

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('boutiqueId', 'name slug logo status')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit)),
    Product.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    data: products,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

/**
 * @desc    Get global product stats for admin
 * @route   GET /api/products/admin/stats
 * @access  Private (Admin only)
 */
exports.adminGetStats = asyncHandler(async (req, res) => {
  const stats = await Product.aggregate([
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        activeProducts: { $sum: { $cond: [{ $eq: ['$isArchived', false] }, 1, 0] } },
        archivedProducts: { $sum: { $cond: ['$isArchived', 1, 0] } },
        totalViews: { $sum: '$views' },
        totalStock: { $sum: '$stock' },
        avgPrice: { $avg: '$price' },
        featuredCount: { $sum: { $cond: ['$isFeatured', 1, 0] } },
        availableCount: { $sum: { $cond: [{ $and: [{ $eq: ['$availability', 'available'] }, { $eq: ['$isArchived', false] }] }, 1, 0] } },
        outOfStockCount: { $sum: { $cond: [{ $and: [{ $eq: ['$availability', 'outOfStock'] }, { $eq: ['$isArchived', false] }] }, 1, 0] } },
        onOrderCount: { $sum: { $cond: [{ $and: [{ $eq: ['$availability', 'onOrder'] }, { $eq: ['$isArchived', false] }] }, 1, 0] } }
      }
    }
  ]);

  const byBoutique = await Product.aggregate([
    { $match: { isArchived: false } },
    {
      $group: {
        _id: '$boutiqueId',
        count: { $sum: 1 },
        totalStock: { $sum: '$stock' },
        avgPrice: { $avg: '$price' }
      }
    },
    {
      $lookup: {
        from: 'boutiques',
        localField: '_id',
        foreignField: '_id',
        as: 'boutique'
      }
    },
    { $unwind: '$boutique' },
    {
      $project: {
        boutiqueId: '$_id',
        boutiqueName: '$boutique.name',
        count: 1,
        totalStock: 1,
        avgPrice: 1
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  res.status(200).json({
    success: true,
    data: {
      summary: stats[0] || {
        totalProducts: 0,
        activeProducts: 0,
        archivedProducts: 0,
        totalViews: 0,
        totalStock: 0,
        avgPrice: 0,
        featuredCount: 0,
        availableCount: 0,
        outOfStockCount: 0,
        onOrderCount: 0
      },
      topBoutiques: byBoutique
    }
  });
});
