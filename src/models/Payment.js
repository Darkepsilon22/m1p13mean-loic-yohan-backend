const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  reference: {
    type: String,
    required: true,
    unique: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'La commande est requise']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'L\'utilisateur est requis']
  },

  // Amount details
  amount: {
    type: Number,
    required: [true, 'Le montant est requis'],
    min: [0, 'Le montant ne peut pas être négatif']
  },
  currency: {
    type: String,
    enum: ['MGA'],
    default: 'MGA'
  },
  originalAmount: {
    type: Number
  },
  originalCurrency: {
    type: String
  },
  exchangeRate: {
    type: Number
  },

  // Payment method
  paymentMethod: {
    type: String,
    enum: {
      values: ['cash', 'card', 'stripe'],
      message: 'Méthode de paiement invalide'
    },
    required: [true, 'La méthode de paiement est requise']
  },

  // Status
  status: {
    type: String,
    enum: {
      values: ['pending', 'processing', 'success', 'failed', 'refunded', 'cancelled'],
      message: 'Statut de paiement invalide'
    },
    default: 'pending'
  },

  // External payment provider info
  externalId: {
    type: String
  },
  paymentUrl: {
    type: String
  },
  providerReference: {
    type: String
  },
  providerResponse: {
    type: mongoose.Schema.Types.Mixed
  },

  // Customer info (cached from order)
  customerName: {
    type: String
  },
  customerEmail: {
    type: String
  },
  customerPhone: {
    type: String
  },

  // Timestamps
  initiatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  failedAt: {
    type: Date
  },
  refundedAt: {
    type: Date
  },

  // For refunds
  refundReason: {
    type: String
  },
  refundAmount: {
    type: Number
  },

  // Expiration
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
  },

  // Additional info
  notes: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes
paymentSchema.index({ reference: 1 }, { unique: true });
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ userId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paymentMethod: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ externalId: 1 });

// Pre-validate hook to generate reference
paymentSchema.pre('validate', function() {
  if (this.isNew && !this.reference) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.reference = `PAY-${dateStr}-${randomPart}`;
  }
});

// Update timestamps based on status change
paymentSchema.pre('save', function() {
  if (this.isModified('status')) {
    const now = new Date();
    switch (this.status) {
      case 'success':
        this.completedAt = now;
        break;
      case 'failed':
        this.failedAt = now;
        break;
      case 'refunded':
        this.refundedAt = now;
        break;
    }
  }
});

// Method to check if payment is expired
paymentSchema.methods.isExpired = function() {
  return this.status === 'pending' && this.expiresAt < new Date();
};

// Method to mark as success
paymentSchema.methods.markAsSuccess = async function(providerData = {}) {
  this.status = 'success';
  this.completedAt = new Date();
  if (providerData.reference) this.providerReference = providerData.reference;
  if (providerData.response) this.providerResponse = providerData.response;

  // Update the related order
  const Order = mongoose.model('Order');
  const order = await Order.findByIdAndUpdate(
    this.orderId,
    {
      paymentStatus: 'success',
      status: 'confirmed',
      paymentId: this.reference
    },
    { new: true }
  );

  await this.save();

  // Send invoice email
  if (order && order.customerEmail) {
    try {
      const { sendInvoiceEmail } = require('../services/emailService');

      const invoiceData = {
        invoiceNumber: this.reference,
        date: this.completedAt || new Date(),
        customerName: order.customerName || 'Client',
        customerEmail: order.customerEmail,
        customerAddress: order.shippingAddress
          ? `${order.shippingAddress.street}, ${order.shippingAddress.city} ${order.shippingAddress.postalCode || ''}, ${order.shippingAddress.country || ''}`
          : '',
        items: (order.items || []).map(item => ({
          description: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.totalPrice || (item.unitPrice * item.quantity)
        })),
        subtotal: order.subtotal || order.totalAmount,
        tax: 0,
        taxRate: 0,
        total: order.totalAmount
      };

      await sendInvoiceEmail(order.customerEmail, order.customerName || 'Client', invoiceData);
      console.log('📧 Email de facture envoyé pour la commande :', order.orderReference);
    } catch (emailError) {
      console.error('❌ Échec de l\'envoi de l\'email de facture :', emailError.message);
      // Don't throw - payment is still successful even if email fails
    }
  }

  return this;
};

// Method to mark as failed
paymentSchema.methods.markAsFailed = async function(reason = '') {
  this.status = 'failed';
  this.failedAt = new Date();
  if (reason) this.notes = reason;

  // Update the related order
  const Order = mongoose.model('Order');
  await Order.findByIdAndUpdate(this.orderId, {
    paymentStatus: 'failed'
  });

  return this.save();
};

// Method to process refund
paymentSchema.methods.processRefund = async function(amount, reason = '') {
  if (this.status !== 'success') {
    throw new Error('Seuls les paiements réussis peuvent être remboursés');
  }

  this.status = 'refunded';
  this.refundedAt = new Date();
  this.refundAmount = amount || this.amount;
  this.refundReason = reason;

  // Update the related order
  const Order = mongoose.model('Order');
  await Order.findByIdAndUpdate(this.orderId, {
    paymentStatus: 'refunded',
    status: 'refunded'
  });

  // Restore stock
  const order = await Order.findById(this.orderId);
  if (order) {
    const Product = mongoose.model('Product');
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity }
      });
    }
  }

  return this.save();
};

// Static method to find by external ID
paymentSchema.statics.findByExternalId = function(externalId) {
  return this.findOne({ externalId });
};

// Static method to get payment statistics
paymentSchema.statics.getStatistics = async function(filters = {}) {
  const matchStage = {};

  if (filters.startDate) matchStage.createdAt = { $gte: new Date(filters.startDate) };
  if (filters.endDate) {
    matchStage.createdAt = matchStage.createdAt || {};
    matchStage.createdAt.$lte = new Date(filters.endDate);
  }
  if (filters.paymentMethod) matchStage.paymentMethod = filters.paymentMethod;

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);

  const byMethod = await this.aggregate([
    { $match: { ...matchStage, status: 'success' } },
    {
      $group: {
        _id: '$paymentMethod',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);

  return {
    byStatus: stats,
    byMethod
  };
};

// Static method to expire pending payments
paymentSchema.statics.expirePendingPayments = async function() {
  const expiredPayments = await this.find({
    status: 'pending',
    expiresAt: { $lt: new Date() }
  });

  for (const payment of expiredPayments) {
    payment.status = 'failed';
    payment.failedAt = new Date();
    payment.notes = 'Paiement expiré';
    await payment.save();
  }

  return expiredPayments.length;
};

module.exports = mongoose.model('Payment', paymentSchema);
