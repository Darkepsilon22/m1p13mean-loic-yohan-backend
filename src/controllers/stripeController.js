const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { ApiError, asyncHandler } = require('../middlewares/errorHandler');
const { emitToAdmin, emitToUser } = require('../socket');

/**
 * @desc    Get Stripe publishable key
 * @route   GET /api/payments/stripe/config
 * @access  Public
 */
exports.getStripeConfig = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    }
  });
});

/**
 * @desc    Create Stripe Checkout Session for an order
 * @route   POST /api/payments/stripe/create-checkout-session
 * @access  Private (acheteur)
 */
exports.createCheckoutSession = asyncHandler(async (req, res, next) => {
  const { orderId } = req.body;

  if (!orderId) {
    return next(new ApiError(400, 'L\'identifiant de la commande est requis'));
  }

  // Find the order
  const order = await Order.findById(orderId).populate('items.boutiqueId', 'name');

  if (!order) {
    return next(new ApiError(404, 'Commande introuvable'));
  }

  // Verify ownership
  if (order.userId.toString() !== req.user._id.toString()) {
    return next(new ApiError(403, 'Non autorisé'));
  }

  // Check order status
  if (order.status === 'cancelled') {
    return next(new ApiError(400, 'Cette commande a été annulée'));
  }

  if (order.paymentStatus === 'success') {
    return next(new ApiError(400, 'Cette commande a déjà été payée'));
  }

  // Build line items for Stripe
  // MGA is a zero-decimal currency - pass amount directly (no * 100)
  const currency = (order.currency || 'MGA').toLowerCase();
  const isZeroDecimal = ['mga', 'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'pyg', 'rwf', 'vnd', 'vuv', 'xaf', 'xof', 'xpf'].includes(currency);

  const lineItems = order.items.map(item => ({
    price_data: {
      currency,
      product_data: {
        name: item.productName,
        ...(item.productImage ? { images: [item.productImage] } : {})
      },
      unit_amount: isZeroDecimal ? Math.round(item.unitPrice) : Math.round(item.unitPrice * 100)
    },
    quantity: item.quantity
  }));

  // Add shipping fee if exists
  if (order.shippingFee > 0) {
    lineItems.push({
      price_data: {
        currency,
        product_data: {
          name: 'Frais de livraison'
        },
        unit_amount: isZeroDecimal ? Math.round(order.shippingFee) : Math.round(order.shippingFee * 100)
      },
      quantity: 1
    });
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: lineItems,
    customer_email: order.customerEmail,
    metadata: {
      orderId: order._id.toString(),
      orderReference: order.orderReference,
      userId: req.user._id.toString()
    },
    success_url: `${frontendUrl}/cart?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/cart?payment=cancelled&order_id=${order._id}`
  });

  // Create payment record
  await Payment.create({
    orderId: order._id,
    userId: req.user._id,
    amount: order.totalAmount,
    currency: order.currency || 'MGA',
    paymentMethod: 'stripe',
    status: 'processing',
    externalId: session.id,
    paymentUrl: session.url,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    metadata: { stripeSessionId: session.id }
  });

  // Update order
  order.paymentMethod = 'stripe';
  order.paymentStatus = 'processing';
  order.paymentId = session.id;
  order.paymentUrl = session.url;
  await order.save();

  emitToAdmin('stripe:sessionCreated', { orderId: order._id, sessionId: session.id });

  res.status(200).json({
    success: true,
    data: {
      sessionId: session.id,
      url: session.url
    }
  });
});

/**
 * @desc    Verify Stripe payment after redirect
 * @route   GET /api/payments/stripe/verify/:sessionId
 * @access  Private (acheteur)
 */
exports.verifyPayment = asyncHandler(async (req, res, next) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    return next(new ApiError(400, 'L\'identifiant de session est requis'));
  }

  // Retrieve the session from Stripe with expanded payment_intent
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent']
  });

  if (!session) {
    return next(new ApiError(404, 'Session Stripe introuvable'));
  }

  // Find the payment
  const payment = await Payment.findOne({ externalId: sessionId });

  if (!payment) {
    return next(new ApiError(404, 'Enregistrement de paiement introuvable'));
  }

  // Verify ownership
  if (payment.userId.toString() !== req.user._id.toString()) {
    return next(new ApiError(403, 'Non autorisé'));
  }

  // session.status: 'complete' | 'expired' | 'open'
  // session.payment_status: 'paid' | 'unpaid' | 'no_payment_required'
  if (session.status === 'complete' && session.payment_status === 'paid' && payment.status !== 'success') {
    const paymentIntentId = typeof session.payment_intent === 'object'
      ? session.payment_intent.id
      : session.payment_intent;

    await payment.markAsSuccess({
      reference: paymentIntentId,
      response: {
        sessionId: session.id,
        paymentIntent: paymentIntentId,
        amountTotal: session.amount_total,
        currency: session.currency
      }
    });
    emitToUser(payment.userId.toString(), 'stripe:paymentVerified', { paymentRef: payment.reference, orderId: payment.orderId });
  }

  const order = await Order.findById(payment.orderId);

  res.status(200).json({
    success: true,
    data: {
      payment: {
        reference: payment.reference,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency
      },
      order: order ? {
        orderReference: order.orderReference,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount
      } : null,
      stripeStatus: session.payment_status
    }
  });
});

/**
 * @desc    Stripe Webhook handler
 * @route   POST /api/payments/stripe/webhook
 * @access  Public (Stripe signature verification)
 */
exports.stripeWebhook = asyncHandler(async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      // In development without webhook secret, parse the raw body
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Échec de la vérification de la signature du webhook Stripe :', err.message);
    return res.status(400).json({ success: false, message: 'Échec de la vérification de la signature du webhook' });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const payment = await Payment.findOne({ externalId: session.id });

      if (payment && payment.status !== 'success') {
        // For card payments, payment_status is 'paid' immediately
        // For async payment methods, it may be 'unpaid' until confirmed
        if (session.payment_status === 'paid') {
          await payment.markAsSuccess({
            reference: session.payment_intent,
            response: {
              sessionId: session.id,
              paymentIntent: session.payment_intent,
              amountTotal: session.amount_total,
              currency: session.currency,
              customerEmail: session.customer_email
            }
          });
          console.log(`✅ Paiement confirmé via webhook : ${payment.reference}`);
          emitToAdmin('stripe:webhookProcessed', { type: event.type });
          if (payment && payment.userId) emitToUser(payment.userId.toString(), 'stripe:webhookProcessed', { type: event.type, reference: payment.reference });
        } else {
          // Async payment - mark as processing, wait for async_payment_succeeded
          console.log(`⏳ Paiement en attente de confirmation async : ${payment.reference}`);
        }
      }
      break;
    }

    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object;
      const payment = await Payment.findOne({ externalId: session.id });

      if (payment && payment.status !== 'success') {
        await payment.markAsSuccess({
          reference: session.payment_intent,
          response: {
            sessionId: session.id,
            paymentIntent: session.payment_intent,
            amountTotal: session.amount_total,
            currency: session.currency,
            customerEmail: session.customer_email
          }
        });
        console.log(`✅ Paiement async confirmé via webhook : ${payment.reference}`);
      }
      break;
    }

    case 'checkout.session.async_payment_failed': {
      const session = event.data.object;
      const payment = await Payment.findOne({ externalId: session.id });

      if (payment && payment.status === 'processing') {
        await payment.markAsFailed('Paiement async échoué');
        console.log(`❌ Paiement async échoué via webhook : ${payment.reference}`);
      }
      break;
    }

    case 'checkout.session.expired': {
      const session = event.data.object;
      const payment = await Payment.findOne({ externalId: session.id });

      if (payment && payment.status === 'processing') {
        await payment.markAsFailed('Session de paiement Stripe expirée');
        console.log(`❌ Paiement expiré via webhook : ${payment.reference}`);
      }
      break;
    }

    default:
      console.log(`Type d'événement Stripe non géré : ${event.type}`);
  }

  res.status(200).json({ received: true });
});
