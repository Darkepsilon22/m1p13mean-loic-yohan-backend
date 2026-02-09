const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const Boutique = require('../models/Boutique');
const { asyncHandler, ApiError } = require('../middlewares/errorHandler');
const stockExportService = require('../services/stockExportService');

/**
 * @desc    Add stock to a product (entrée de stock)
 * @route   POST /api/stock/:productId/add OR POST /api/stock/add (with productId in body)
 * @access  Private (Boutique owner)
 */
exports.addStock = asyncHandler(async (req, res, next) => {
  const productId = req.params.productId || req.body.productId;
  const { quantity, reason, reference } = req.body;

  if (!productId) {
    return next(new ApiError(400, 'Product ID is required'));
  }

  const product = await Product.findById(productId);
  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  // Check ownership
  const boutique = await Boutique.findById(product.boutiqueId);
  if (req.user.role !== 'admin' && !boutique.userId.equals(req.user._id)) {
    return next(new ApiError(403, 'You are not authorized to manage stock for this product'));
  }

  const previousStock = product.stock;
  const newStock = previousStock + quantity;

  // Update product stock
  product.stock = newStock;
  await product.save();

  // Record movement
  const movement = await StockMovement.create({
    productId: product._id,
    boutiqueId: product.boutiqueId,
    type: 'in',
    quantity,
    previousStock,
    newStock,
    reason,
    reference,
    userId: req.user._id
  });

  res.status(200).json({
    success: true,
    message: 'Stock added successfully',
    data: {
      product: {
        _id: product._id,
        name: product.name,
        stock: product.stock,
        availability: product.availability
      },
      movement
    }
  });
});

/**
 * @desc    Remove stock from a product (sortie de stock)
 * @route   POST /api/stock/:productId/remove OR POST /api/stock/remove (with productId in body)
 * @access  Private (Boutique owner)
 */
exports.removeStock = asyncHandler(async (req, res, next) => {
  const productId = req.params.productId || req.body.productId;
  const { quantity, reason, reference } = req.body;

  if (!productId) {
    return next(new ApiError(400, 'Product ID is required'));
  }

  const product = await Product.findById(productId);
  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  // Check ownership
  const boutique = await Boutique.findById(product.boutiqueId);
  if (req.user.role !== 'admin' && !boutique.userId.equals(req.user._id)) {
    return next(new ApiError(403, 'You are not authorized to manage stock for this product'));
  }

  // Check if enough stock
  if (product.stock < quantity) {
    return next(new ApiError(400, `Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`));
  }

  const previousStock = product.stock;
  const newStock = previousStock - quantity;

  // Update product stock
  product.stock = newStock;
  await product.save();

  // Record movement
  const movement = await StockMovement.create({
    productId: product._id,
    boutiqueId: product.boutiqueId,
    type: 'out',
    quantity: -quantity, // Negative for outgoing
    previousStock,
    newStock,
    reason,
    reference,
    userId: req.user._id
  });

  res.status(200).json({
    success: true,
    message: 'Stock removed successfully',
    data: {
      product: {
        _id: product._id,
        name: product.name,
        stock: product.stock,
        availability: product.availability,
        isLowStock: product.isLowStock()
      },
      movement
    }
  });
});

/**
 * @desc    Adjust stock (correction/inventory)
 * @route   POST /api/stock/:productId/adjust OR POST /api/stock/adjust (with productId in body)
 * @access  Private (Boutique owner)
 */
exports.adjustStock = asyncHandler(async (req, res, next) => {
  const productId = req.params.productId || req.body.productId;
  const { newStock, reason, reference } = req.body;

  if (!productId) {
    return next(new ApiError(400, 'Product ID is required'));
  }

  const product = await Product.findById(productId);
  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  // Check ownership
  const boutique = await Boutique.findById(product.boutiqueId);
  if (req.user.role !== 'admin' && !boutique.userId.equals(req.user._id)) {
    return next(new ApiError(403, 'You are not authorized to manage stock for this product'));
  }

  const previousStock = product.stock;
  const quantityDiff = newStock - previousStock;

  // Update product stock
  product.stock = newStock;
  await product.save();

  // Record movement
  const movement = await StockMovement.create({
    productId: product._id,
    boutiqueId: product.boutiqueId,
    type: 'adjustment',
    quantity: quantityDiff,
    previousStock,
    newStock,
    reason: reason || 'Stock adjustment/inventory',
    reference,
    userId: req.user._id
  });

  res.status(200).json({
    success: true,
    message: 'Stock adjusted successfully',
    data: {
      product: {
        _id: product._id,
        name: product.name,
        stock: product.stock,
        availability: product.availability
      },
      movement
    }
  });
});

/**
 * @desc    Set initial stock for a product
 * @route   POST /api/stock/:productId/initial
 * @access  Private (Boutique owner)
 */
exports.setInitialStock = asyncHandler(async (req, res, next) => {
  const { productId } = req.params;
  const { stock, reason } = req.body;

  const product = await Product.findById(productId);
  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  // Check ownership
  const boutique = await Boutique.findById(product.boutiqueId);
  if (req.user.role !== 'admin' && !boutique.userId.equals(req.user._id)) {
    return next(new ApiError(403, 'You are not authorized to manage stock for this product'));
  }

  const previousStock = product.stock;

  // Update product stock
  product.stock = stock;
  await product.save();

  // Record movement
  const movement = await StockMovement.create({
    productId: product._id,
    boutiqueId: product.boutiqueId,
    type: 'initial',
    quantity: stock,
    previousStock,
    newStock: stock,
    reason: reason || 'Initial stock setup',
    userId: req.user._id
  });

  res.status(200).json({
    success: true,
    message: 'Initial stock set successfully',
    data: {
      product: {
        _id: product._id,
        name: product.name,
        stock: product.stock,
        availability: product.availability
      },
      movement
    }
  });
});

/**
 * @desc    Get stock movement history for a product
 * @route   GET /api/stock/:productId/history
 * @access  Private (Boutique owner)
 */
exports.getProductHistory = asyncHandler(async (req, res, next) => {
  const { productId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const product = await Product.findById(productId);
  if (!product) {
    return next(new ApiError(404, 'Product not found'));
  }

  // Check ownership (or admin)
  const boutique = await Boutique.findById(product.boutiqueId);
  if (req.user.role !== 'admin' && !boutique.userId.equals(req.user._id)) {
    return next(new ApiError(403, 'You are not authorized to view this product history'));
  }

  const result = await StockMovement.getProductHistory(productId, { page, limit });

  res.status(200).json({
    success: true,
    data: {
      product: {
        _id: product._id,
        name: product.name,
        currentStock: product.stock,
        availability: product.availability
      },
      movements: result.movements,
      pagination: result.pagination
    }
  });
});

/**
 * @desc    Get stock overview for a boutique
 * @route   GET /api/stock/boutique/:boutiqueId
 * @access  Private (Boutique owner)
 */
exports.getBoutiqueStock = asyncHandler(async (req, res, next) => {
  const { boutiqueId } = req.params;
  const { page = 1, limit = 20, lowStock, outOfStock } = req.query;

  // Check ownership
  const boutique = await Boutique.findById(boutiqueId);
  if (!boutique) {
    return next(new ApiError(404, 'Boutique not found'));
  }

  if (req.user.role !== 'admin' && !boutique.userId.equals(req.user._id)) {
    return next(new ApiError(403, 'You are not authorized to view this boutique stock'));
  }

  const query = { boutiqueId, isArchived: false };

  // Filter for low stock
  if (lowStock === 'true') {
    query.$expr = { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] };
  }

  // Filter for out of stock
  if (outOfStock === 'true') {
    query.stock = 0;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [products, total] = await Promise.all([
    Product.find(query)
      .select('name slug stock lowStockThreshold availability mainPhoto')
      .sort('stock')
      .skip(skip)
      .limit(parseInt(limit)),
    Product.countDocuments(query)
  ]);

  // Get summary stats
  const stats = await Product.aggregate([
    { $match: { boutiqueId: boutique._id, isArchived: false } },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        totalStock: { $sum: '$stock' },
        outOfStockCount: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } },
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

  res.status(200).json({
    success: true,
    data: {
      products,
      stats: stats[0] || {
        totalProducts: 0,
        totalStock: 0,
        outOfStockCount: 0,
        lowStockCount: 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
});

/**
 * @desc    Get stock movement summary for a boutique
 * @route   GET /api/stock/boutique/:boutiqueId/movements
 * @access  Private (Boutique owner)
 */
exports.getBoutiqueMovements = asyncHandler(async (req, res, next) => {
  const { boutiqueId } = req.params;
  const { page = 1, limit = 50, startDate, endDate, type, productId, search } = req.query;

  // Check ownership
  const boutique = await Boutique.findById(boutiqueId);
  if (!boutique) {
    return next(new ApiError(404, 'Boutique not found'));
  }

  if (req.user.role !== 'admin' && !boutique.userId.equals(req.user._id)) {
    return next(new ApiError(403, 'You are not authorized to view this boutique movements'));
  }

  const query = { boutiqueId };

  // Filter by type
  if (type) {
    query.type = type;
  }

  // Filter by specific product
  if (productId) {
    query.productId = productId;
  }

  // Filter by date range
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // If search term provided, find matching products first
  let productIds = null;
  if (search) {
    const Product = require('../models/Product');
    const matchingProducts = await Product.find({
      boutiqueId,
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } }
      ]
    }).select('_id');
    productIds = matchingProducts.map(p => p._id);
    query.productId = { $in: productIds };
  }

  const [movements, total] = await Promise.all([
    StockMovement.find(query)
      .populate('productId', 'name slug mainPhoto')
      .populate('userId', 'name email')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit)),
    StockMovement.countDocuments(query)
  ]);

  // Get summary
  const summary = await StockMovement.getBoutiqueSummary(boutiqueId, startDate, endDate);

  res.status(200).json({
    success: true,
    data: {
      movements,
      summary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
});

/**
 * @desc    Get all stock alerts (low stock and out of stock) - Admin view
 * @route   GET /api/stock/alerts
 * @access  Private (Admin only)
 */
exports.getStockAlerts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;

  // Get all active boutiques
  const activeBoutiques = await Boutique.find({ status: 'active' }).select('_id name');
  const boutiqueIds = activeBoutiques.map(b => b._id);

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get products with stock issues
  const [products, total] = await Promise.all([
    Product.find({
      boutiqueId: { $in: boutiqueIds },
      isArchived: false,
      $or: [
        { stock: 0 },
        { $expr: { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] } }
      ]
    })
      .populate('boutiqueId', 'name slug')
      .select('name slug stock lowStockThreshold availability mainPhoto')
      .sort('stock')
      .skip(skip)
      .limit(parseInt(limit)),
    Product.countDocuments({
      boutiqueId: { $in: boutiqueIds },
      isArchived: false,
      $or: [
        { stock: 0 },
        { $expr: { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] } }
      ]
    })
  ]);

  // Add alert type to each product
  const productsWithAlerts = products.map(p => ({
    ...p.toObject(),
    alertType: p.stock === 0 ? 'outOfStock' : 'lowStock'
  }));

  res.status(200).json({
    success: true,
    data: {
      products: productsWithAlerts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }
  });
});

/**
 * @desc    Get global stock statistics - Admin view
 * @route   GET /api/stock/stats
 * @access  Private (Admin only)
 */
exports.getGlobalStats = asyncHandler(async (req, res) => {
  // Get all active boutiques
  const activeBoutiques = await Boutique.find({ status: 'active' }).select('_id');
  const boutiqueIds = activeBoutiques.map(b => b._id);

  const stats = await Product.aggregate([
    { $match: { boutiqueId: { $in: boutiqueIds }, isArchived: false } },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        totalStock: { $sum: '$stock' },
        avgStock: { $avg: '$stock' },
        outOfStockCount: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } },
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

  // Get movement stats for the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const movementStats = await StockMovement.aggregate([
    {
      $match: {
        boutiqueId: { $in: boutiqueIds },
        createdAt: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      productStats: stats[0] || {
        totalProducts: 0,
        totalStock: 0,
        avgStock: 0,
        outOfStockCount: 0,
        lowStockCount: 0
      },
      movementStats,
      activeBoutiquesCount: activeBoutiques.length
    }
  });
});

/**
 * @desc    Export stock movements as PDF (boutique owner)
 * @route   GET /api/stock/export/pdf
 * @query   dateDebut (YYYY-MM-DD), dateFin (YYYY-MM-DD), productIds (optional, comma-separated), category (optional)
 * @access  Private (Boutique)
 */
exports.exportStockPDF = asyncHandler(async (req, res, next) => {
  const boutique = await Boutique.findOne({ userId: req.user._id });
  if (!boutique) {
    return next(new ApiError(404, 'Boutique not found'));
  }

  const { dateDebut, dateFin, productIds: productIdsParam, category, type } = req.query;
  if (!dateDebut || !dateFin) {
    return next(new ApiError(400, 'dateDebut and dateFin are required (YYYY-MM-DD)'));
  }

  const productIds = productIdsParam && productIdsParam.trim()
    ? productIdsParam.split(',').map(id => id.trim()).filter(Boolean)
    : null;

  const movements = await stockExportService.getMovementsForExport(
    boutique._id,
    dateDebut,
    dateFin,
    productIds,
    category || null,
    type || null
  );

  const pdfBuffer = await stockExportService.generateStockPDF(movements, boutique.name);

  const filename = `export-stock-${boutique.name.replace(/\s+/g, '-')}-${dateDebut}-${dateFin}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(pdfBuffer);
});

/**
 * @desc    Export stock movements as Excel (boutique owner)
 * @route   GET /api/stock/export/excel
 * @query   dateDebut, dateFin, productIds (optional), category (optional)
 * @access  Private (Boutique)
 */
exports.exportStockExcel = asyncHandler(async (req, res, next) => {
  const boutique = await Boutique.findOne({ userId: req.user._id });
  if (!boutique) {
    return next(new ApiError(404, 'Boutique not found'));
  }

  const { dateDebut, dateFin, productIds: productIdsParam, category, type } = req.query;
  if (!dateDebut || !dateFin) {
    return next(new ApiError(400, 'dateDebut and dateFin are required (YYYY-MM-DD)'));
  }

  const productIds = productIdsParam && productIdsParam.trim()
    ? productIdsParam.split(',').map(id => id.trim()).filter(Boolean)
    : null;

  const movements = await stockExportService.getMovementsForExport(
    boutique._id,
    dateDebut,
    dateFin,
    productIds,
    category || null,
    type || null
  );

  const excelBuffer = await stockExportService.generateStockExcel(movements, boutique.name);

  const filename = `export-stock-${boutique.name.replace(/\s+/g, '-')}-${dateDebut}-${dateFin}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(excelBuffer);
});
