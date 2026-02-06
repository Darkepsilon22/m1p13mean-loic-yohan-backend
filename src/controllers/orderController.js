const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const Boutique = require('../models/Boutique');
const User = require('../models/User');
const { ApiError, asyncHandler } = require('../middlewares/errorHandler');
const { sendLowStockAlertEmail } = require('../services/emailService');

/**
 * @desc    Create order from cart
 * @route   POST /api/orders
 * @access  Private (acheteur)
 */
exports.createOrder = asyncHandler(async (req, res, next) => {
  const {
    shippingAddress,
    billingAddress,
    customerName,
    customerEmail,
    customerPhone,
    customerNotes,
    paymentMethod = 'pending'
  } = req.body;

  // Validate customer phone
  const phone = customerPhone || req.user.phone;
  if (!phone) {
    return next(new ApiError(400, 'Customer phone is required. Please provide it in the request or update your profile.'));
  }

  // Get user's cart
  const cart = await Cart.findOne({ userId: req.user._id });

  if (!cart || cart.items.length === 0) {
    return next(new ApiError(400, 'Cart is empty'));
  }

  // Validate stock
  const validation = await cart.validateStock();
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      message: 'Some items are no longer available',
      errors: validation.errors
    });
  }

  // Prepare order items and reserve stock
  const orderItems = [];
  for (const item of cart.items) {
    const product = await Product.findById(item.productId);

    if (!product || product.stock < item.quantity) {
      return next(new ApiError(400, `Insufficient stock for product: ${item.productName}`));
    }

    // Reserve stock (deduct from available)
    product.stock -= item.quantity;
    await product.save();

    // Check low stock alert
    if (product.stock <= product.lowStockThreshold) {
      try {
        const boutique = await Boutique.findById(product.boutiqueId);
        if (boutique && boutique.userId) {
          const owner = await User.findById(boutique.userId);
          if (owner && owner.email) {
            await sendLowStockAlertEmail(owner.email, owner.firstName || 'Gerant', {
              productName: product.name,
              currentStock: product.stock,
              threshold: product.lowStockThreshold,
              boutiqueName: boutique.name || 'Votre boutique'
            });
            console.log(`📧 Low stock alert sent for "${product.name}" (stock: ${product.stock})`);
          }
        }
      } catch (emailError) {
        console.error('❌ Failed to send low stock alert:', emailError.message);
      }
    }

    orderItems.push({
      productId: item.productId,
      boutiqueId: item.boutiqueId,
      productName: item.productName,
      productImage: item.productImage,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.quantity * item.unitPrice
    });
  }

  // Calculate totals
  const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const shippingFee = 0; // Can be calculated based on address/weight
  const discount = 0; // Can be applied from promo codes
  const totalAmount = subtotal + shippingFee - discount;

  // Create order
  const order = await Order.create({
    userId: req.user._id,
    items: orderItems,
    customerName: customerName || `${req.user.firstName} ${req.user.lastName}`,
    customerEmail: customerEmail || req.user.email,
    customerPhone: phone,
    shippingAddress,
    billingAddress,
    subtotal,
    shippingFee,
    discount,
    totalAmount,
    currency: cart.currency,
    paymentMethod,
    customerNotes,
    status: 'pending',
    paymentStatus: 'pending'
  });

  // Clear cart after successful order creation
  await cart.clearCart();

  // Populate order for response
  await order.populate([
    { path: 'items.boutiqueId', select: 'name logo' },
    { path: 'userId', select: 'firstName lastName email' }
  ]);

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    data: { order }
  });
});

/**
 * @desc    Get user's orders
 * @route   GET /api/orders/my-orders
 * @access  Private (acheteur)
 */
exports.getMyOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10, sort = '-createdAt' } = req.query;

  const filter = { userId: req.user._id };
  if (status) filter.status = status;

  const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(100, Math.max(1, parseInt(limit)));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('items.boutiqueId', 'name logo')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Order.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    data: {
      orders,
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
 * @desc    Get order by ID
 * @route   GET /api/orders/:id
 * @access  Private (acheteur - own orders only)
 */
exports.getOrderById = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate('items.boutiqueId', 'name logo')
    .populate('items.productId', 'name mainPhoto')
    .populate('userId', 'firstName lastName email phone');

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  // Verify ownership (unless admin)
  if (req.user.role !== 'admin' && order.userId._id.toString() !== req.user._id.toString()) {
    return next(new ApiError(403, 'Not authorized to view this order'));
  }

  res.status(200).json({
    success: true,
    data: { order }
  });
});

/**
 * @desc    Get order by reference
 * @route   GET /api/orders/reference/:reference
 * @access  Private
 */
exports.getOrderByReference = asyncHandler(async (req, res, next) => {
  const order = await Order.findOne({ orderReference: req.params.reference })
    .populate('items.boutiqueId', 'name logo')
    .populate('userId', 'firstName lastName email phone');

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  // Verify ownership (unless admin)
  if (req.user.role !== 'admin' && order.userId._id.toString() !== req.user._id.toString()) {
    return next(new ApiError(403, 'Not authorized to view this order'));
  }

  res.status(200).json({
    success: true,
    data: { order }
  });
});

/**
 * @desc    Cancel order
 * @route   PATCH /api/orders/:id/cancel
 * @access  Private (acheteur - own orders only)
 */
exports.cancelOrder = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  // Verify ownership
  if (order.userId.toString() !== req.user._id.toString()) {
    return next(new ApiError(403, 'Not authorized to cancel this order'));
  }

  if (!order.canBeCancelled()) {
    return next(new ApiError(400, 'This order cannot be cancelled'));
  }

  // Restore stock
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { stock: item.quantity }
    });
  }

  order.status = 'cancelled';
  order.cancelledAt = new Date();
  await order.save();

  res.status(200).json({
    success: true,
    message: 'Order cancelled successfully',
    data: { order }
  });
});

// ==================== BOUTIQUE ENDPOINTS ====================

/**
 * @desc    Get boutique's orders
 * @route   GET /api/orders/boutique
 * @access  Private (boutique)
 */
exports.getBoutiqueOrders = asyncHandler(async (req, res) => {
  const { status, paymentStatus, startDate, endDate, page = 1, limit = 20, sort = '-createdAt' } = req.query;

  const result = await Order.getByBoutique(req.user.boutiqueId, {
    status,
    paymentStatus,
    startDate,
    endDate,
    page,
    limit,
    sort
  });

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Get boutique order by ID
 * @route   GET /api/orders/boutique/:id
 * @access  Private (boutique)
 */
exports.getBoutiqueOrderById = asyncHandler(async (req, res, next) => {
  const order = await Order.findOne({
    _id: req.params.id,
    'items.boutiqueId': req.user.boutiqueId
  })
    .populate('items.productId', 'name mainPhoto')
    .populate('userId', 'firstName lastName email phone');

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  // Filter items to show only this boutique's items
  const boutiqueItems = order.items.filter(
    item => item.boutiqueId.toString() === req.user.boutiqueId.toString()
  );

  const boutiqueSubtotal = boutiqueItems.reduce((sum, item) => sum + item.totalPrice, 0);

  res.status(200).json({
    success: true,
    data: {
      order: {
        ...order.toObject(),
        items: boutiqueItems,
        boutiqueSubtotal
      }
    }
  });
});

/**
 * @desc    Get boutique order statistics
 * @route   GET /api/orders/boutique/stats
 * @access  Private (boutique)
 */
exports.getBoutiqueOrderStats = asyncHandler(async (req, res) => {
  const boutiqueId = req.user.boutiqueId;

  const stats = await Order.aggregate([
    { $match: { 'items.boutiqueId': boutiqueId } },
    { $unwind: '$items' },
    { $match: { 'items.boutiqueId': boutiqueId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        revenue: {
          $sum: {
            $cond: [{ $eq: ['$paymentStatus', 'success'] }, '$items.totalPrice', 0]
          }
        }
      }
    }
  ]);

  // Get monthly revenue
  const monthlyStats = await Order.aggregate([
    {
      $match: {
        'items.boutiqueId': boutiqueId,
        paymentStatus: 'success',
        createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
      }
    },
    { $unwind: '$items' },
    { $match: { 'items.boutiqueId': boutiqueId } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        revenue: { $sum: '$items.totalPrice' },
        ordersCount: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 12 }
  ]);

  res.status(200).json({
    success: true,
    data: {
      byStatus: stats,
      monthly: monthlyStats
    }
  });
});

// ==================== ADMIN ENDPOINTS ====================

/**
 * @desc    Get all orders (admin)
 * @route   GET /api/orders/admin
 * @access  Private (admin)
 */
exports.getAllOrders = asyncHandler(async (req, res) => {
  const { status, paymentStatus, search, startDate, endDate, page = 1, limit = 20, sort = '-createdAt' } = req.query;

  const filter = {};

  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (search) {
    filter.$or = [
      { orderReference: { $regex: search, $options: 'i' } },
      { customerName: { $regex: search, $options: 'i' } },
      { customerEmail: { $regex: search, $options: 'i' } }
    ];
  }
  if (startDate) filter.createdAt = { $gte: new Date(startDate) };
  if (endDate) {
    filter.createdAt = filter.createdAt || {};
    filter.createdAt.$lte = new Date(endDate);
  }

  const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(100, Math.max(1, parseInt(limit)));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('items.boutiqueId', 'name logo')
      .populate('userId', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Order.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    data: {
      orders,
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
 * @desc    Update order status (admin)
 * @route   PATCH /api/orders/admin/:id/status
 * @access  Private (admin)
 */
exports.updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { status, trackingNumber, carrier, adminNotes } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new ApiError(404, 'Order not found'));
  }

  // Check if payment is required for this status
  if (order.requiresPaymentForStatus(status) && order.paymentStatus !== 'success') {
    return next(new ApiError(400, `Cannot update to "${status}": payment not confirmed (current: ${order.paymentStatus})`));
  }

  // Handle cancellation - restore stock
  if (status === 'cancelled' && order.status !== 'cancelled') {
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity }
      });
    }
  }

  order.status = status;
  if (trackingNumber) order.trackingNumber = trackingNumber;
  if (carrier) order.carrier = carrier;
  if (adminNotes) order.adminNotes = adminNotes;

  await order.save();

  res.status(200).json({
    success: true,
    message: 'Order status updated successfully',
    data: { order }
  });
});

/**
 * @desc    Get admin order statistics
 * @route   GET /api/orders/admin/stats
 * @access  Private (admin)
 */
exports.getAdminOrderStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  const matchStage = {};
  if (Object.keys(dateFilter).length > 0) {
    matchStage.createdAt = dateFilter;
  }

  const stats = await Order.aggregate([
    { $match: matchStage },
    {
      $facet: {
        byStatus: [
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ],
        byPaymentStatus: [
          { $group: { _id: '$paymentStatus', count: { $sum: 1 } } }
        ],
        totals: [
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalRevenue: {
                $sum: {
                  $cond: [{ $eq: ['$paymentStatus', 'success'] }, '$totalAmount', 0]
                }
              },
              averageOrderValue: { $avg: '$totalAmount' }
            }
          }
        ],
        recent: [
          { $sort: { createdAt: -1 } },
          { $limit: 5 },
          { $project: { orderReference: 1, totalAmount: 1, status: 1, createdAt: 1 } }
        ]
      }
    }
  ]);

  // Monthly stats
  const monthlyStats = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        ordersCount: { $sum: 1 },
        revenue: {
          $sum: {
            $cond: [{ $eq: ['$paymentStatus', 'success'] }, '$totalAmount', 0]
          }
        }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 12 }
  ]);

  res.status(200).json({
    success: true,
    data: {
      ...stats[0],
      monthly: monthlyStats
    }
  });
});

/**
 * @desc    Expire pending orders (cron job endpoint)
 * @route   POST /api/orders/admin/expire-pending
 * @access  Private (admin)
 */
exports.expirePendingOrders = asyncHandler(async (req, res) => {
  const expiredCount = await Order.expirePendingOrders();

  res.status(200).json({
    success: true,
    message: `${expiredCount} pending orders expired`,
    data: { expiredCount }
  });
});
