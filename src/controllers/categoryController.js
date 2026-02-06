const Category = require('../models/Category');
const Boutique = require('../models/Boutique');
const { ApiError, asyncHandler } = require('../middlewares/errorHandler');

/**
 * @desc    Get all categories (flat list)
 * @route   GET /api/categories
 * @access  Public
 */
exports.getAll = asyncHandler(async (req, res, next) => {
  const {
    active,
    parent,
    root,
    search,
    page = 1,
    limit = 50,
    sort = 'order'
  } = req.query;

  const filter = {};

  if (search && String(search).trim()) {
    filter.name = new RegExp(String(search).trim(), 'i');
  }

  // Filter by active status
  if (active !== undefined) {
    filter.isActive = active === 'true';
  }

  // Filter by parent (get children of a specific category)
  if (parent) {
    filter.parentId = parent;
  }

  // Filter root categories only (no parent)
  if (root === 'true') {
    filter.parentId = null;
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, Math.max(1, parseInt(limit, 10)));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const [categories, total] = await Promise.all([
    Category.find(filter)
      .populate('parentId', 'name slug')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Category.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    data: {
      categories,
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
 * @desc    Get category tree (hierarchical structure)
 * @route   GET /api/categories/tree
 * @access  Public
 */
exports.getTree = asyncHandler(async (req, res, next) => {
  const { active } = req.query;
  const activeOnly = active !== 'false';

  const tree = await Category.getTree(activeOnly);

  res.status(200).json({
    success: true,
    data: { categories: tree }
  });
});

/**
 * @desc    Get single category by ID
 * @route   GET /api/categories/:id
 * @access  Public
 */
exports.getById = asyncHandler(async (req, res, next) => {
  const category = await Category.findById(req.params.id)
    .populate('parentId', 'name slug')
    .populate({
      path: 'children',
      match: { isActive: true },
      options: { sort: { order: 1 } }
    });

  if (!category) {
    return next(new ApiError(404, 'Category not found'));
  }

  res.status(200).json({
    success: true,
    data: { category }
  });
});

/**
 * @desc    Get category by slug
 * @route   GET /api/categories/slug/:slug
 * @access  Public
 */
exports.getBySlug = asyncHandler(async (req, res, next) => {
  const category = await Category.findOne({ slug: req.params.slug })
    .populate('parentId', 'name slug')
    .populate({
      path: 'children',
      match: { isActive: true },
      options: { sort: { order: 1 } }
    });

  if (!category) {
    return next(new ApiError(404, 'Category not found'));
  }

  res.status(200).json({
    success: true,
    data: { category }
  });
});

/**
 * @desc    Get children of a category
 * @route   GET /api/categories/:id/children
 * @access  Public
 */
exports.getChildren = asyncHandler(async (req, res, next) => {
  const { active } = req.query;
  const activeOnly = active !== 'false';

  // Verify parent exists
  const parent = await Category.findById(req.params.id);
  if (!parent) {
    return next(new ApiError(404, 'Parent category not found'));
  }

  const children = await Category.getChildren(req.params.id, activeOnly);

  res.status(200).json({
    success: true,
    data: {
      parent: {
        _id: parent._id,
        name: parent.name,
        slug: parent.slug
      },
      children
    }
  });
});

/**
 * @desc    Get boutiques count per category
 * @route   GET /api/categories/stats
 * @access  Public
 */
exports.getStats = asyncHandler(async (req, res, next) => {
  const stats = await Boutique.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'category'
      }
    },
    { $unwind: '$category' },
    {
      $project: {
        _id: 1,
        name: '$category.name',
        slug: '$category.slug',
        icon: '$category.icon',
        color: '$category.color',
        count: 1
      }
    },
    { $sort: { count: -1 } }
  ]);

  res.status(200).json({
    success: true,
    data: { stats }
  });
});

/**
 * @desc    Create a new category
 * @route   POST /api/categories
 * @access  Private (Admin only)
 */
exports.create = asyncHandler(async (req, res, next) => {
  const { name, description, icon, color, image, parentId, order, isActive } = req.body;

  // Check if category with same name exists
  const existingCategory = await Category.findOne({
    name: { $regex: new RegExp(`^${name}$`, 'i') }
  });
  if (existingCategory) {
    return next(new ApiError(400, 'A category with this name already exists'));
  }

  // If parentId provided, verify it exists and is not a subcategory
  if (parentId) {
    const parent = await Category.findById(parentId);
    if (!parent) {
      return next(new ApiError(400, 'Parent category not found'));
    }
    if (parent.parentId) {
      return next(new ApiError(400, 'Cannot create a subcategory of a subcategory. Maximum depth is 2 levels.'));
    }
  }

  const category = await Category.create({
    name,
    description,
    icon,
    color,
    image,
    parentId: parentId || null,
    order: order !== undefined ? order : 0,
    isActive: isActive !== undefined ? isActive : true
  });

  const populated = await Category.findById(category._id)
    .populate('parentId', 'name slug');

  res.status(201).json({
    success: true,
    message: 'Category created successfully',
    data: { category: populated }
  });
});

/**
 * @desc    Update a category
 * @route   PUT /api/categories/:id
 * @access  Private (Admin only)
 */
exports.update = asyncHandler(async (req, res, next) => {
  let category = await Category.findById(req.params.id);

  if (!category) {
    return next(new ApiError(404, 'Category not found'));
  }

  const { name, description, icon, color, image, parentId, order, isActive } = req.body;

  // Check if name is being changed and if new name already exists
  if (name && name !== category.name) {
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      _id: { $ne: category._id }
    });
    if (existingCategory) {
      return next(new ApiError(400, 'A category with this name already exists'));
    }
  }

  // Validate parentId change
  if (parentId !== undefined) {
    if (parentId) {
      // Cannot set self as parent
      if (parentId === req.params.id) {
        return next(new ApiError(400, 'A category cannot be its own parent'));
      }

      const parent = await Category.findById(parentId);
      if (!parent) {
        return next(new ApiError(400, 'Parent category not found'));
      }

      // Cannot make a category a child if it has children
      const hasChildren = await Category.countDocuments({ parentId: req.params.id });
      if (hasChildren > 0) {
        return next(new ApiError(400, 'Cannot move a category with subcategories. Remove subcategories first.'));
      }

      // Cannot nest more than 2 levels
      if (parent.parentId) {
        return next(new ApiError(400, 'Cannot create a subcategory of a subcategory. Maximum depth is 2 levels.'));
      }
    }
  }

  // Update fields
  if (name !== undefined) category.name = name;
  if (description !== undefined) category.description = description;
  if (icon !== undefined) category.icon = icon;
  if (color !== undefined) category.color = color;
  if (image !== undefined) category.image = image;
  if (parentId !== undefined) category.parentId = parentId || null;
  if (order !== undefined) category.order = order;
  if (isActive !== undefined) category.isActive = isActive;

  await category.save();

  const populated = await Category.findById(category._id)
    .populate('parentId', 'name slug')
    .populate({
      path: 'children',
      options: { sort: { order: 1 } }
    });

  res.status(200).json({
    success: true,
    message: 'Category updated successfully',
    data: { category: populated }
  });
});

/**
 * @desc    Update category status (activate/deactivate)
 * @route   PATCH /api/categories/:id/status
 * @access  Private (Admin only)
 */
exports.patchStatus = asyncHandler(async (req, res, next) => {
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    return next(new ApiError(400, 'isActive must be a boolean value'));
  }

  const category = await Category.findById(req.params.id);

  if (!category) {
    return next(new ApiError(404, 'Category not found'));
  }

  // If deactivating, optionally deactivate children too
  if (!isActive) {
    await Category.updateMany(
      { parentId: category._id },
      { isActive: false }
    );
  }

  category.isActive = isActive;
  await category.save();

  res.status(200).json({
    success: true,
    message: `Category ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: { category }
  });
});

/**
 * @desc    Update category order
 * @route   PATCH /api/categories/:id/order
 * @access  Private (Admin only)
 */
exports.patchOrder = asyncHandler(async (req, res, next) => {
  const { order } = req.body;

  if (typeof order !== 'number' || order < 0) {
    return next(new ApiError(400, 'Order must be a non-negative number'));
  }

  const category = await Category.findByIdAndUpdate(
    req.params.id,
    { order },
    { new: true, runValidators: true }
  );

  if (!category) {
    return next(new ApiError(404, 'Category not found'));
  }

  res.status(200).json({
    success: true,
    message: 'Category order updated successfully',
    data: { category }
  });
});

/**
 * @desc    Reorder multiple categories at once
 * @route   PATCH /api/categories/reorder
 * @access  Private (Admin only)
 */
exports.reorder = asyncHandler(async (req, res, next) => {
  const { orders } = req.body;

  if (!Array.isArray(orders) || orders.length === 0) {
    return next(new ApiError(400, 'Orders must be a non-empty array of { id, order } objects'));
  }

  const bulkOps = orders.map(({ id, order }) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { order } }
    }
  }));

  await Category.bulkWrite(bulkOps);

  res.status(200).json({
    success: true,
    message: 'Categories reordered successfully'
  });
});

/**
 * @desc    Delete a category
 * @route   DELETE /api/categories/:id
 * @access  Private (Admin only)
 */
exports.delete = asyncHandler(async (req, res, next) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return next(new ApiError(404, 'Category not found'));
  }

  // Check for boutiques using this category
  const boutiqueCount = await Boutique.countDocuments({ categoryId: category._id });
  if (boutiqueCount > 0) {
    return next(new ApiError(400, `Cannot delete category: ${boutiqueCount} boutique(s) are using it. Reassign them first.`));
  }

  // Check for subcategories
  const childCount = await Category.countDocuments({ parentId: category._id });
  if (childCount > 0) {
    return next(new ApiError(400, `Cannot delete category: ${childCount} subcategorie(s) exist. Delete them first.`));
  }

  await category.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Category deleted successfully'
  });
});
