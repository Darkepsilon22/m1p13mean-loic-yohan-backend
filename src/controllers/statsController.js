const Order = require('../models/Order');
const User = require('../models/User');
const Boutique = require('../models/Boutique');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const { asyncHandler } = require('../middlewares/errorHandler');
const mongoose = require('mongoose');

// ==================== ADMIN - STATISTIQUES GLOBALES DU CENTRE ====================

/**
 * @desc    Get global center revenue statistics (CA total)
 * @route   GET /api/stats/admin/revenue
 * @access  Private (admin)
 */
exports.getGlobalRevenue = asyncHandler(async (req, res) => {
  const { startDate, endDate, period = 'month' } = req.query;

  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  const matchStage = { paymentStatus: 'success' };
  if (Object.keys(dateFilter).length > 0) {
    matchStage.createdAt = dateFilter;
  }

  // CA total du centre
  const totalRevenue = await Order.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalCA: { $sum: '$totalAmount' },
        totalOrders: { $sum: 1 },
        avgOrderValue: { $avg: '$totalAmount' },
        totalItems: { $sum: { $size: '$items' } }
      }
    }
  ]);

  // CA par période (jour/semaine/mois)
  let dateGrouping;
  switch (period) {
    case 'day':
      dateGrouping = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
      break;
    case 'week':
      dateGrouping = {
        year: { $year: '$createdAt' },
        week: { $week: '$createdAt' }
      };
      break;
    case 'month':
    default:
      dateGrouping = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
  }

  const revenueByPeriod = await Order.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: dateGrouping,
        revenue: { $sum: '$totalAmount' },
        ordersCount: { $sum: 1 },
        avgOrderValue: { $avg: '$totalAmount' }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1, '_id.week': -1, '_id.day': -1 } },
    { $limit: 24 }
  ]);

  // CA par boutique (top 10)
  const revenueByBoutique = await Order.aggregate([
    { $match: matchStage },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.boutiqueId',
        revenue: { $sum: '$items.totalPrice' },
        ordersCount: { $sum: 1 },
        itemsSold: { $sum: '$items.quantity' }
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: 10 },
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
        boutiqueLogo: '$boutique.logo',
        revenue: 1,
        ordersCount: 1,
        itemsSold: 1
      }
    }
  ]);

  // CA par catégorie
  const revenueByCategory = await Order.aggregate([
    { $match: matchStage },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'boutiques',
        localField: 'items.boutiqueId',
        foreignField: '_id',
        as: 'boutique'
      }
    },
    { $unwind: '$boutique' },
    {
      $group: {
        _id: '$boutique.categoryId',
        revenue: { $sum: '$items.totalPrice' },
        ordersCount: { $sum: 1 }
      }
    },
    { $sort: { revenue: -1 } },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'category'
      }
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        categoryId: '$_id',
        categoryName: { $ifNull: ['$category.name', 'Sans catégorie'] },
        revenue: 1,
        ordersCount: 1
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      total: totalRevenue[0] || { totalCA: 0, totalOrders: 0, avgOrderValue: 0, totalItems: 0 },
      byPeriod: revenueByPeriod,
      byBoutique: revenueByBoutique,
      byCategory: revenueByCategory
    }
  });
});

/**
 * @desc    Get customer acquisition metrics
 * @route   GET /api/stats/admin/customers
 * @access  Private (admin)
 */
exports.getCustomerMetrics = asyncHandler(async (req, res) => {
  const { startDate, endDate, period = 'month' } = req.query;

  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  // Total customers by role
  const customersByRole = await User.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        blocked: { $sum: { $cond: [{ $eq: ['$status', 'blocked'] }, 1, 0] } }
      }
    }
  ]);

  // New customers by period
  let dateGrouping;
  switch (period) {
    case 'day':
      dateGrouping = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
      break;
    case 'week':
      dateGrouping = {
        year: { $year: '$createdAt' },
        week: { $week: '$createdAt' }
      };
      break;
    case 'month':
    default:
      dateGrouping = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
  }

  const matchStage = { role: 'acheteur' };
  if (Object.keys(dateFilter).length > 0) {
    matchStage.createdAt = dateFilter;
  }

  const newCustomersByPeriod = await User.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: dateGrouping,
        newCustomers: { $sum: 1 },
        verified: { $sum: { $cond: [{ $eq: ['$isEmailVerified', true] }, 1, 0] } }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1, '_id.week': -1, '_id.day': -1 } },
    { $limit: 24 }
  ]);

  // Customer retention - customers who made multiple orders
  const customerRetention = await Order.aggregate([
    { $match: { paymentStatus: 'success' } },
    {
      $group: {
        _id: '$userId',
        ordersCount: { $sum: 1 },
        totalSpent: { $sum: '$totalAmount' },
        firstOrder: { $min: '$createdAt' },
        lastOrder: { $max: '$createdAt' }
      }
    },
    {
      $group: {
        _id: null,
        totalCustomersWithOrders: { $sum: 1 },
        oneTimeCustomers: { $sum: { $cond: [{ $eq: ['$ordersCount', 1] }, 1, 0] } },
        repeatCustomers: { $sum: { $cond: [{ $gt: ['$ordersCount', 1] }, 1, 0] } },
        avgOrdersPerCustomer: { $avg: '$ordersCount' },
        avgSpentPerCustomer: { $avg: '$totalSpent' }
      }
    }
  ]);

  // Top customers
  const topCustomers = await Order.aggregate([
    { $match: { paymentStatus: 'success' } },
    {
      $group: {
        _id: '$userId',
        ordersCount: { $sum: 1 },
        totalSpent: { $sum: '$totalAmount' }
      }
    },
    { $sort: { totalSpent: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        userId: '$_id',
        firstName: '$user.firstName',
        lastName: '$user.lastName',
        email: '$user.email',
        ordersCount: 1,
        totalSpent: 1
      }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      byRole: customersByRole,
      newByPeriod: newCustomersByPeriod,
      retention: customerRetention[0] || {
        totalCustomersWithOrders: 0,
        oneTimeCustomers: 0,
        repeatCustomers: 0,
        avgOrdersPerCustomer: 0,
        avgSpentPerCustomer: 0
      },
      topCustomers
    }
  });
});

/**
 * @desc    Get period comparison statistics
 * @route   GET /api/stats/admin/comparison
 * @access  Private (admin)
 */
exports.getPeriodComparison = asyncHandler(async (req, res) => {
  const { compareType = 'month' } = req.query;

  const now = new Date();
  let currentStart, currentEnd, previousStart, previousEnd;

  switch (compareType) {
    case 'day':
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      previousStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      previousEnd = currentStart;
      break;
    case 'week':
      const dayOfWeek = now.getDay();
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      currentEnd = now;
      previousStart = new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000);
      previousEnd = currentStart;
      break;
    case 'year':
      currentStart = new Date(now.getFullYear(), 0, 1);
      currentEnd = now;
      previousStart = new Date(now.getFullYear() - 1, 0, 1);
      previousEnd = new Date(now.getFullYear(), 0, 1);
      break;
    case 'month':
    default:
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      currentEnd = now;
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEnd = currentStart;
  }

  const getStatsForPeriod = async (start, end) => {
    const [orderStats, newCustomers, newBoutiques] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lt: end },
            paymentStatus: 'success'
          }
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$totalAmount' },
            ordersCount: { $sum: 1 },
            avgOrderValue: { $avg: '$totalAmount' }
          }
        }
      ]),
      User.countDocuments({
        role: 'acheteur',
        createdAt: { $gte: start, $lt: end }
      }),
      Boutique.countDocuments({
        createdAt: { $gte: start, $lt: end }
      })
    ]);

    return {
      revenue: orderStats[0]?.revenue || 0,
      ordersCount: orderStats[0]?.ordersCount || 0,
      avgOrderValue: orderStats[0]?.avgOrderValue || 0,
      newCustomers,
      newBoutiques
    };
  };

  const [currentStats, previousStats] = await Promise.all([
    getStatsForPeriod(currentStart, currentEnd),
    getStatsForPeriod(previousStart, previousEnd)
  ]);

  const calculateChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous * 100).toFixed(2);
  };

  res.status(200).json({
    success: true,
    data: {
      compareType,
      current: {
        period: { start: currentStart, end: currentEnd },
        ...currentStats
      },
      previous: {
        period: { start: previousStart, end: previousEnd },
        ...previousStats
      },
      changes: {
        revenue: calculateChange(currentStats.revenue, previousStats.revenue),
        ordersCount: calculateChange(currentStats.ordersCount, previousStats.ordersCount),
        avgOrderValue: calculateChange(currentStats.avgOrderValue, previousStats.avgOrderValue),
        newCustomers: calculateChange(currentStats.newCustomers, previousStats.newCustomers),
        newBoutiques: calculateChange(currentStats.newBoutiques, previousStats.newBoutiques)
      }
    }
  });
});

/**
 * @desc    Get global dashboard statistics
 * @route   GET /api/stats/admin/dashboard
 * @access  Private (admin)
 */
exports.getAdminDashboard = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [
    totalRevenue,
    monthlyRevenue,
    yearlyRevenue,
    totalOrders,
    pendingOrders,
    totalCustomers,
    activeCustomers,
    totalBoutiques,
    activeBoutiques,
    totalProducts,
    lowStockProducts,
    recentOrders
  ] = await Promise.all([
    // Total revenue (all time)
    Order.aggregate([
      { $match: { paymentStatus: 'success' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]),
    // Monthly revenue
    Order.aggregate([
      { $match: { paymentStatus: 'success', createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]),
    // Yearly revenue
    Order.aggregate([
      { $match: { paymentStatus: 'success', createdAt: { $gte: startOfYear } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]),
    // Total orders
    Order.countDocuments(),
    // Pending orders
    Order.countDocuments({ status: 'pending' }),
    // Total customers
    User.countDocuments({ role: 'acheteur' }),
    // Active customers
    User.countDocuments({ role: 'acheteur', status: 'active' }),
    // Total boutiques
    Boutique.countDocuments(),
    // Active boutiques
    Boutique.countDocuments({ status: 'active' }),
    // Total products
    Product.countDocuments({ isArchived: false }),
    // Low stock products
    Product.countDocuments({
      isArchived: false,
      $expr: { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] }
    }),
    // Recent orders
    Order.find()
      .populate('userId', 'firstName lastName')
      .sort('-createdAt')
      .limit(5)
      .select('orderReference totalAmount status paymentStatus createdAt')
      .lean()
  ]);

  res.status(200).json({
    success: true,
    data: {
      revenue: {
        total: totalRevenue[0]?.total || 0,
        monthly: monthlyRevenue[0]?.total || 0,
        yearly: yearlyRevenue[0]?.total || 0
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders
      },
      customers: {
        total: totalCustomers,
        active: activeCustomers
      },
      boutiques: {
        total: totalBoutiques,
        active: activeBoutiques
      },
      products: {
        total: totalProducts,
        lowStock: lowStockProducts
      },
      recentOrders
    }
  });
});

// ==================== BOUTIQUE - STATISTIQUES FINANCIERES ====================

/**
 * @desc    Get boutique revenue (CA) statistics
 * @route   GET /api/stats/boutique/revenue
 * @access  Private (boutique)
 */
exports.getBoutiqueRevenue = asyncHandler(async (req, res) => {
  const boutiqueId = req.user.boutiqueId;
  const { startDate, endDate, period = 'month' } = req.query;

  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  const matchStage = {
    'items.boutiqueId': new mongoose.Types.ObjectId(boutiqueId),
    paymentStatus: 'success'
  };
  if (Object.keys(dateFilter).length > 0) {
    matchStage.createdAt = dateFilter;
  }

  // CA total de la boutique
  const totalRevenue = await Order.aggregate([
    { $match: matchStage },
    { $unwind: '$items' },
    { $match: { 'items.boutiqueId': new mongoose.Types.ObjectId(boutiqueId) } },
    {
      $group: {
        _id: null,
        totalCA: { $sum: '$items.totalPrice' },
        totalOrders: { $addToSet: '$_id' },
        totalItemsSold: { $sum: '$items.quantity' },
        avgOrderValue: { $avg: '$items.totalPrice' }
      }
    },
    {
      $project: {
        totalCA: 1,
        totalOrders: { $size: '$totalOrders' },
        totalItemsSold: 1,
        avgOrderValue: 1
      }
    }
  ]);

  // CA par période
  let dateGrouping;
  switch (period) {
    case 'day':
      dateGrouping = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
      break;
    case 'week':
      dateGrouping = {
        year: { $year: '$createdAt' },
        week: { $week: '$createdAt' }
      };
      break;
    case 'month':
    default:
      dateGrouping = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
  }

  const revenueByPeriod = await Order.aggregate([
    { $match: matchStage },
    { $unwind: '$items' },
    { $match: { 'items.boutiqueId': new mongoose.Types.ObjectId(boutiqueId) } },
    {
      $group: {
        _id: dateGrouping,
        revenue: { $sum: '$items.totalPrice' },
        ordersCount: { $addToSet: '$_id' },
        itemsSold: { $sum: '$items.quantity' }
      }
    },
    {
      $project: {
        _id: 1,
        revenue: 1,
        ordersCount: { $size: '$ordersCount' },
        itemsSold: 1
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1, '_id.week': -1, '_id.day': -1 } },
    { $limit: 24 }
  ]);

  res.status(200).json({
    success: true,
    data: {
      total: totalRevenue[0] || { totalCA: 0, totalOrders: 0, totalItemsSold: 0, avgOrderValue: 0 },
      byPeriod: revenueByPeriod
    }
  });
});

/**
 * @desc    Get boutique sales trends
 * @route   GET /api/stats/boutique/trends
 * @access  Private (boutique)
 */
exports.getBoutiqueSalesTrends = asyncHandler(async (req, res) => {
  const boutiqueId = req.user.boutiqueId;
  const { months = 12 } = req.query;

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - parseInt(months));

  // Trends by month
  const monthlyTrends = await Order.aggregate([
    {
      $match: {
        'items.boutiqueId': new mongoose.Types.ObjectId(boutiqueId),
        paymentStatus: 'success',
        createdAt: { $gte: startDate }
      }
    },
    { $unwind: '$items' },
    { $match: { 'items.boutiqueId': new mongoose.Types.ObjectId(boutiqueId) } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        revenue: { $sum: '$items.totalPrice' },
        ordersCount: { $addToSet: '$_id' },
        itemsSold: { $sum: '$items.quantity' }
      }
    },
    {
      $project: {
        _id: 1,
        revenue: 1,
        ordersCount: { $size: '$ordersCount' },
        itemsSold: 1
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  // Top selling products
  const topProducts = await Order.aggregate([
    {
      $match: {
        'items.boutiqueId': new mongoose.Types.ObjectId(boutiqueId),
        paymentStatus: 'success',
        createdAt: { $gte: startDate }
      }
    },
    { $unwind: '$items' },
    { $match: { 'items.boutiqueId': new mongoose.Types.ObjectId(boutiqueId) } },
    {
      $group: {
        _id: '$items.productId',
        productName: { $first: '$items.productName' },
        totalRevenue: { $sum: '$items.totalPrice' },
        totalQuantity: { $sum: '$items.quantity' },
        ordersCount: { $sum: 1 }
      }
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 10 }
  ]);

  // Sales by day of week
  const salesByDayOfWeek = await Order.aggregate([
    {
      $match: {
        'items.boutiqueId': new mongoose.Types.ObjectId(boutiqueId),
        paymentStatus: 'success',
        createdAt: { $gte: startDate }
      }
    },
    { $unwind: '$items' },
    { $match: { 'items.boutiqueId': new mongoose.Types.ObjectId(boutiqueId) } },
    {
      $group: {
        _id: { $dayOfWeek: '$createdAt' },
        revenue: { $sum: '$items.totalPrice' },
        ordersCount: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Growth calculation
  const currentMonth = new Date();
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  const currentMonthRevenue = monthlyTrends.find(
    t => t._id.year === currentMonth.getFullYear() && t._id.month === currentMonth.getMonth() + 1
  );
  const lastMonthRevenue = monthlyTrends.find(
    t => t._id.year === lastMonth.getFullYear() && t._id.month === lastMonth.getMonth() + 1
  );

  const growth = lastMonthRevenue?.revenue
    ? (((currentMonthRevenue?.revenue || 0) - lastMonthRevenue.revenue) / lastMonthRevenue.revenue * 100).toFixed(2)
    : 0;

  res.status(200).json({
    success: true,
    data: {
      monthlyTrends,
      topProducts,
      salesByDayOfWeek,
      growth: {
        percentage: parseFloat(growth),
        currentMonth: currentMonthRevenue?.revenue || 0,
        lastMonth: lastMonthRevenue?.revenue || 0
      }
    }
  });
});

/**
 * @desc    Get boutique margin analysis
 * @route   GET /api/stats/boutique/margins
 * @access  Private (boutique)
 */
exports.getBoutiqueMargins = asyncHandler(async (req, res) => {
  const boutiqueId = req.user.boutiqueId;
  const { startDate, endDate } = req.query;

  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) dateFilter.$lte = new Date(endDate);

  const matchStage = {
    'items.boutiqueId': new mongoose.Types.ObjectId(boutiqueId),
    paymentStatus: 'success'
  };
  if (Object.keys(dateFilter).length > 0) {
    matchStage.createdAt = dateFilter;
  }

  // Get products with original price for margin calculation
  const products = await Product.find({ boutiqueId }).select('_id price originalPrice name');
  const productMap = new Map(products.map(p => [p._id.toString(), p]));

  // Sales data
  const salesData = await Order.aggregate([
    { $match: matchStage },
    { $unwind: '$items' },
    { $match: { 'items.boutiqueId': new mongoose.Types.ObjectId(boutiqueId) } },
    {
      $group: {
        _id: '$items.productId',
        productName: { $first: '$items.productName' },
        totalRevenue: { $sum: '$items.totalPrice' },
        totalQuantity: { $sum: '$items.quantity' },
        avgUnitPrice: { $avg: '$items.unitPrice' }
      }
    }
  ]);

  // Calculate margins
  const marginsData = salesData.map(sale => {
    const product = productMap.get(sale._id.toString());
    const costPrice = product?.originalPrice || sale.avgUnitPrice;
    const sellingPrice = sale.avgUnitPrice;
    const margin = costPrice > 0 ? ((sellingPrice - costPrice) / costPrice * 100) : 0;
    const totalProfit = (sellingPrice - costPrice) * sale.totalQuantity;

    return {
      productId: sale._id,
      productName: sale.productName,
      totalRevenue: sale.totalRevenue,
      totalQuantity: sale.totalQuantity,
      avgUnitPrice: sale.avgUnitPrice,
      costPrice,
      marginPercentage: margin.toFixed(2),
      totalProfit: totalProfit.toFixed(2)
    };
  });

  // Sort by margin
  marginsData.sort((a, b) => parseFloat(b.marginPercentage) - parseFloat(a.marginPercentage));

  // Summary
  const totalRevenue = marginsData.reduce((sum, m) => sum + m.totalRevenue, 0);
  const totalProfit = marginsData.reduce((sum, m) => sum + parseFloat(m.totalProfit), 0);
  const avgMargin = marginsData.length > 0
    ? (marginsData.reduce((sum, m) => sum + parseFloat(m.marginPercentage), 0) / marginsData.length).toFixed(2)
    : 0;

  res.status(200).json({
    success: true,
    data: {
      summary: {
        totalRevenue,
        totalProfit: totalProfit.toFixed(2),
        avgMargin,
        productsAnalyzed: marginsData.length
      },
      products: marginsData,
      topMargins: marginsData.slice(0, 5),
      lowMargins: [...marginsData].sort((a, b) => parseFloat(a.marginPercentage) - parseFloat(b.marginPercentage)).slice(0, 5)
    }
  });
});

/**
 * @desc    Get boutique dashboard statistics
 * @route   GET /api/stats/boutique/dashboard
 * @access  Private (boutique)
 */
exports.getBoutiqueDashboard = asyncHandler(async (req, res) => {
  const boutiqueId = req.user.boutiqueId;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const baseMatch = {
    'items.boutiqueId': new mongoose.Types.ObjectId(boutiqueId),
    paymentStatus: 'success'
  };

  const [
    totalRevenue,
    monthlyRevenue,
    yearlyRevenue,
    totalOrders,
    pendingOrders,
    totalProducts,
    lowStockProducts,
    recentOrders
  ] = await Promise.all([
    // Total revenue
    Order.aggregate([
      { $match: baseMatch },
      { $unwind: '$items' },
      { $match: { 'items.boutiqueId': new mongoose.Types.ObjectId(boutiqueId) } },
      { $group: { _id: null, total: { $sum: '$items.totalPrice' } } }
    ]),
    // Monthly revenue
    Order.aggregate([
      { $match: { ...baseMatch, createdAt: { $gte: startOfMonth } } },
      { $unwind: '$items' },
      { $match: { 'items.boutiqueId': new mongoose.Types.ObjectId(boutiqueId) } },
      { $group: { _id: null, total: { $sum: '$items.totalPrice' } } }
    ]),
    // Yearly revenue
    Order.aggregate([
      { $match: { ...baseMatch, createdAt: { $gte: startOfYear } } },
      { $unwind: '$items' },
      { $match: { 'items.boutiqueId': new mongoose.Types.ObjectId(boutiqueId) } },
      { $group: { _id: null, total: { $sum: '$items.totalPrice' } } }
    ]),
    // Total orders
    Order.countDocuments({ 'items.boutiqueId': boutiqueId }),
    // Pending orders
    Order.countDocuments({ 'items.boutiqueId': boutiqueId, status: 'pending' }),
    // Total products
    Product.countDocuments({ boutiqueId, isArchived: false }),
    // Low stock products
    Product.countDocuments({
      boutiqueId,
      isArchived: false,
      $expr: { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] }
    }),
    // Recent orders
    Order.find({ 'items.boutiqueId': boutiqueId })
      .populate('userId', 'firstName lastName')
      .sort('-createdAt')
      .limit(5)
      .select('orderReference totalAmount status paymentStatus createdAt items')
      .lean()
  ]);

  // Filter recent orders to show only this boutique's items
  const filteredRecentOrders = recentOrders.map(order => {
    const boutiqueItems = order.items.filter(
      item => item.boutiqueId.toString() === boutiqueId.toString()
    );
    const boutiqueTotal = boutiqueItems.reduce((sum, item) => sum + item.totalPrice, 0);
    return {
      ...order,
      items: boutiqueItems,
      boutiqueTotal
    };
  });

  res.status(200).json({
    success: true,
    data: {
      revenue: {
        total: totalRevenue[0]?.total || 0,
        monthly: monthlyRevenue[0]?.total || 0,
        yearly: yearlyRevenue[0]?.total || 0
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders
      },
      products: {
        total: totalProducts,
        lowStock: lowStockProducts
      },
      recentOrders: filteredRecentOrders
    }
  });
});
