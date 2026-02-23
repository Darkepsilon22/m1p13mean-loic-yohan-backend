const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { ApiError, asyncHandler } = require('../middlewares/errorHandler');
const { emitToAdmin, emitToUser } = require('../socket');

/**
 * @desc    Initialize payment for an order
 * @route   POST /api/payments/initialize
 * @access  Private (acheteur)
 */
exports.initializePayment = asyncHandler(async (req, res, next) => {
  const { orderId, paymentMethod } = req.body;

  const order = await Order.findById(orderId);

  if (!order) {
    return next(new ApiError(404, 'Commande introuvable'));
  }

  // Verify ownership
  if (order.userId.toString() !== req.user._id.toString()) {
    return next(new ApiError(403, 'Non autorisé'));
  }

  // Check if order can be paid
  if (order.status !== 'pending') {
    return next(new ApiError(400, `La commande ne peut pas être payée (statut : ${order.status})`));
  }

  if (order.paymentStatus === 'success') {
    return next(new ApiError(400, 'Commande déjà payée'));
  }

  // Check for existing pending payment
  const existingPayment = await Payment.findOne({
    orderId: order._id,
    status: 'pending'
  });

  if (existingPayment && !existingPayment.isExpired()) {
    return res.status(200).json({
      success: true,
      message: 'Paiement existant trouvé',
      data: {
        payment: {
          reference: existingPayment.reference,
          paymentUrl: existingPayment.paymentUrl,
          expiresAt: existingPayment.expiresAt
        }
      }
    });
  }

  // Create new payment record
  const payment = await Payment.create({
    orderId: order._id,
    userId: req.user._id,
    amount: order.totalAmount,
    currency: order.currency,
    paymentMethod,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    status: 'pending'
  });

  // Update order with payment method
  order.paymentMethod = paymentMethod;
  await order.save();

  // TODO: Integrate with actual payment provider
  // For now, return a placeholder response
  // In production, this would call VanillaPay, Stripe, etc.

  const paymentUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/payment/${payment.reference}`;

  payment.paymentUrl = paymentUrl;
  await payment.save();

  emitToAdmin('payment:initialized', { paymentRef: payment.reference, orderId: order._id, amount: payment.amount });

  res.status(201).json({
    success: true,
    message: 'Paiement initialisé',
    data: {
      payment: {
        reference: payment.reference,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        paymentUrl,
        expiresAt: payment.expiresAt
      }
    }
  });
});

/**
 * @desc    Get payment status
 * @route   GET /api/payments/:reference
 * @access  Private
 */
exports.getPaymentStatus = asyncHandler(async (req, res, next) => {
  const payment = await Payment.findOne({ reference: req.params.reference })
    .populate('orderId', 'orderReference status totalAmount');

  if (!payment) {
    return next(new ApiError(404, 'Paiement introuvable'));
  }

  // Verify ownership (unless admin)
  if (req.user.role !== 'admin' && payment.userId.toString() !== req.user._id.toString()) {
    return next(new ApiError(403, 'Non autorisé'));
  }

  res.status(200).json({
    success: true,
    data: { payment }
  });
});

/**
 * @desc    Confirm payment (manual/cash)
 * @route   POST /api/payments/:reference/confirm
 * @access  Private (admin)
 */
exports.confirmPayment = asyncHandler(async (req, res, next) => {
  const { providerReference, notes } = req.body;

  const payment = await Payment.findOne({ reference: req.params.reference });

  if (!payment) {
    return next(new ApiError(404, 'Paiement introuvable'));
  }

  if (payment.status !== 'pending') {
    return next(new ApiError(400, `Le paiement ne peut pas être confirmé (statut : ${payment.status})`));
  }

  await payment.markAsSuccess({
    reference: providerReference,
    response: { manual: true, confirmedBy: req.user._id, notes }
  });

  emitToUser(payment.userId.toString(), 'payment:confirmed', { paymentRef: payment.reference, amount: payment.amount });

  res.status(200).json({
    success: true,
    message: 'Paiement confirmé avec succès',
    data: { payment }
  });
});

/**
 * @desc    Mark payment as failed
 * @route   POST /api/payments/:reference/fail
 * @access  Private (admin)
 */
exports.failPayment = asyncHandler(async (req, res, next) => {
  const { reason } = req.body;

  const payment = await Payment.findOne({ reference: req.params.reference });

  if (!payment) {
    return next(new ApiError(404, 'Paiement introuvable'));
  }

  if (payment.status !== 'pending') {
    return next(new ApiError(400, `Le statut du paiement ne peut pas être modifié (statut : ${payment.status})`));
  }

  await payment.markAsFailed(reason);

  emitToUser(payment.userId.toString(), 'payment:failed', { paymentRef: payment.reference, reason });

  res.status(200).json({
    success: true,
    message: 'Paiement marqué comme échoué',
    data: { payment }
  });
});

/**
 * @desc    Process refund
 * @route   POST /api/payments/:reference/refund
 * @access  Private (admin)
 */
exports.refundPayment = asyncHandler(async (req, res, next) => {
  const { amount, reason } = req.body;

  const payment = await Payment.findOne({ reference: req.params.reference });

  if (!payment) {
    return next(new ApiError(404, 'Paiement introuvable'));
  }

  const refundAmount = amount || payment.amount;

  if (refundAmount > payment.amount) {
    return next(new ApiError(400, 'Le montant du remboursement ne peut pas dépasser le montant du paiement'));
  }

  await payment.processRefund(refundAmount, reason);

  emitToUser(payment.userId.toString(), 'payment:refunded', { paymentRef: payment.reference, amount: refundAmount });

  res.status(200).json({
    success: true,
    message: 'Remboursement effectué avec succès',
    data: { payment }
  });
});

/**
 * @desc    Webhook handler for payment notifications
 * @route   POST /api/payments/webhook
 * @access  Public (signature verification required)
 */
exports.handleWebhook = asyncHandler(async (req, res) => {
  // TODO: Implement signature verification based on payment provider

  const { reference, status, providerReference, providerData } = req.body;

  console.log('📩 Webhook de paiement reçu :', { reference, status });

  const payment = await Payment.findOne({ reference });

  if (!payment) {
    console.log('⚠️ Paiement introuvable :', reference);
    return res.status(200).send('OK');
  }

  if (payment.status !== 'pending') {
    console.log('⚠️ Paiement déjà traité :', payment.status);
    return res.status(200).send('OK');
  }

  // Map provider status to internal status
  const successStatuses = ['SUCCESS', 'COMPLETED', 'PAID', '00'];
  const failedStatuses = ['FAILED', 'CANCELLED', 'ERROR', 'DECLINED'];

  if (successStatuses.includes(status?.toUpperCase())) {
    await payment.markAsSuccess({
      reference: providerReference,
      response: providerData
    });
    console.log('✅ Paiement marqué comme réussi :', reference);
  } else if (failedStatuses.includes(status?.toUpperCase())) {
    await payment.markAsFailed(providerData?.message || 'Paiement échoué');
    console.log('❌ Paiement marqué comme échoué :', reference);
  } else {
    payment.providerResponse = providerData;
    await payment.save();
    console.log('ℹ️ Statut du paiement mis à jour :', status);
  }

  res.status(200).send('OK');
});

/**
 * @desc    Get payment methods
 * @route   GET /api/payments/methods
 * @access  Public
 */
exports.getPaymentMethods = asyncHandler(async (req, res) => {
  const { location = 'MG' } = req.query;

  let methods;

  if (location === 'MG') {
    methods = [
      { id: 'mvola', name: 'MVola', icon: 'mvola.png', active: true },
      { id: 'orange', name: 'Orange Money', icon: 'orange.png', active: true },
      { id: 'airtel', name: 'Airtel Money', icon: 'airtel.png', active: true },
      { id: 'cash', name: 'Paiement à la livraison', icon: 'cash.png', active: true }
    ];
  } else {
    methods = [
      { id: 'card', name: 'Carte bancaire', icon: 'card.png', active: true }
    ];
  }

  res.status(200).json({
    success: true,
    data: { methods }
  });
});

/**
 * @desc    Get user's payment history
 * @route   GET /api/payments/history
 * @access  Private (acheteur)
 */
exports.getPaymentHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;

  const filter = { userId: req.user._id };
  if (status) filter.status = status;

  const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(100, Math.max(1, parseInt(limit)));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate('orderId', 'orderReference status')
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Payment.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    data: {
      payments,
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
 * @desc    Get all payments (admin)
 * @route   GET /api/payments/admin
 * @access  Private (admin)
 */
exports.getAllPayments = asyncHandler(async (req, res) => {
  const { status, paymentMethod, search, startDate, endDate, page = 1, limit = 20, sort = '-createdAt' } = req.query;

  const filter = {};

  if (status) filter.status = status;
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (search) {
    filter.$or = [
      { reference: { $regex: search, $options: 'i' } },
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

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate('orderId', 'orderReference')
      .populate('userId', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Payment.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    data: {
      payments,
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
 * @desc    Get payment statistics (admin)
 * @route   GET /api/payments/admin/stats
 * @access  Private (admin)
 */
exports.getPaymentStats = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const filters = {};
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  const stats = await Payment.getStatistics(filters);

  res.status(200).json({
    success: true,
    data: stats
  });
});

/**
 * @desc    Expire pending payments (cron job endpoint)
 * @route   POST /api/payments/admin/expire-pending
 * @access  Private (admin)
 */
exports.expirePendingPayments = asyncHandler(async (req, res) => {
  const expiredCount = await Payment.expirePendingPayments();

  res.status(200).json({
    success: true,
    message: `${expiredCount} paiement(s) en attente expiré(s)`,
    data: { expiredCount }
  });
});
