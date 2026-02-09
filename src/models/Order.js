const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  boutiqueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Boutique',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  productImage: {
    type: String
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  unitPrice: {
    type: Number,
    required: true,
    min: [0, 'Unit price cannot be negative']
  },
  totalPrice: {
    type: Number,
    required: true,
    min: [0, 'Total price cannot be negative']
  }
}, { _id: true });

const orderSchema = new mongoose.Schema({
  orderReference: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  items: [orderItemSchema],

  // Customer information
  customerName: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true
  },
  customerEmail: {
    type: String,
    required: [true, 'Customer email is required'],
    trim: true,
    lowercase: true
  },
  customerPhone: {
    type: String,
    required: [true, 'Customer phone is required'],
    trim: true
  },

  // Addresses
  shippingAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    postalCode: { type: String },
    country: { type: String, default: 'Madagascar' },
    additionalInfo: { type: String }
  },
  billingAddress: {
    street: { type: String },
    city: { type: String },
    postalCode: { type: String },
    country: { type: String }
  },

  // Amounts
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative']
  },
  shippingFee: {
    type: Number,
    default: 0,
    min: [0, 'Shipping fee cannot be negative']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Total amount cannot be negative']
  },
  currency: {
    type: String,
    enum: ['MGA'],
    default: 'MGA'
  },

  // Order status
  status: {
    type: String,
    enum: {
      values: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'],
      message: 'Invalid order status'
    },
    default: 'pending'
  },

  // Payment information
  paymentStatus: {
    type: String,
    enum: {
      values: ['pending', 'processing', 'success', 'failed', 'refunded'],
      message: 'Invalid payment status'
    },
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'stripe', 'pending'],
    default: 'pending'
  },
  paymentId: {
    type: String
  },
  paymentUrl: {
    type: String
  },

  // Shipping information
  trackingNumber: {
    type: String
  },
  carrier: {
    type: String
  },
  estimatedDelivery: {
    type: Date
  },

  // Notes
  customerNotes: {
    type: String,
    maxlength: [500, 'Customer notes cannot exceed 500 characters']
  },
  adminNotes: {
    type: String,
    maxlength: [500, 'Admin notes cannot exceed 500 characters']
  },

  // Timestamps for status changes
  confirmedAt: { type: Date },
  processedAt: { type: Date },
  shippedAt: { type: Date },
  deliveredAt: { type: Date },
  completedAt: { type: Date },
  cancelledAt: { type: Date },

  // Order expiration (for unpaid orders)
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 2 * 60 * 1000) // 2 minutes (TEST MODE - change to 15 in production)
  }
}, {
  timestamps: true
});

// Indexes
orderSchema.index({ orderReference: 1 }, { unique: true });
orderSchema.index({ userId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'items.boutiqueId': 1 });
orderSchema.index({ expiresAt: 1 });

// Pre-validate hook to generate order reference
orderSchema.pre('validate', async function() {
  if (this.isNew && !this.orderReference) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    // Get the count of orders today for sequential numbering
    const todayStart = new Date(date);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(date);
    todayEnd.setHours(23, 59, 59, 999);

    const count = await this.constructor.countDocuments({
      createdAt: { $gte: todayStart, $lte: todayEnd }
    });

    const sequence = String(count + 1).padStart(5, '0');
    this.orderReference = `CC-${dateStr}-${sequence}`;
  }

  // Set billing address if not provided
  if (!this.billingAddress || !this.billingAddress.street) {
    this.billingAddress = { ...this.shippingAddress };
  }
});

// Update status timestamps
orderSchema.pre('save', function() {
  if (this.isModified('status')) {
    const now = new Date();
    switch (this.status) {
      case 'confirmed':
        this.confirmedAt = now;
        break;
      case 'processing':
        this.processedAt = now;
        break;
      case 'shipped':
        this.shippedAt = now;
        break;
      case 'delivered':
        this.deliveredAt = now;
        break;
      case 'completed':
        this.completedAt = now;
        break;
      case 'cancelled':
        this.cancelledAt = now;
        break;
    }
  }
});

// Method to check if order can be cancelled
orderSchema.methods.canBeCancelled = function() {
  return ['pending', 'confirmed'].includes(this.status) && this.paymentStatus !== 'success';
};

// Method to check if order requires payment validation before status change
orderSchema.methods.requiresPaymentForStatus = function(newStatus) {
  const statusRequiringPayment = ['processing', 'shipped', 'delivered', 'completed'];
  return statusRequiringPayment.includes(newStatus);
};

// Static method to generate order reference
orderSchema.statics.generateReference = async function() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

  const todayStart = new Date(date.setHours(0, 0, 0, 0));
  const todayEnd = new Date(date.setHours(23, 59, 59, 999));

  const count = await this.countDocuments({
    createdAt: { $gte: todayStart, $lte: todayEnd }
  });

  const sequence = String(count + 1).padStart(5, '0');
  return `CC-${dateStr}-${sequence}`;
};

// Static method to get orders by boutique
orderSchema.statics.getByBoutique = async function(boutiqueId, filters = {}) {
  const query = { 'items.boutiqueId': boutiqueId };

  if (filters.status) query.status = filters.status;
  if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;
  if (filters.startDate) query.createdAt = { $gte: new Date(filters.startDate) };
  if (filters.endDate) {
    query.createdAt = query.createdAt || {};
    query.createdAt.$lte = new Date(filters.endDate);
  }

  const page = Math.max(1, parseInt(filters.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
  const skip = (page - 1) * limit;
  const sort = filters.sort || '-createdAt';

  const [orders, total] = await Promise.all([
    this.find(query)
      .populate('userId', 'firstName lastName email phone')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1
    }
  };
};

// Static method to expire pending orders
orderSchema.statics.expirePendingOrders = async function() {
  const expiredOrders = await this.find({
    status: 'pending',
    paymentStatus: { $in: ['pending', 'processing'] },
    expiresAt: { $lt: new Date() }
  });

  const Product = mongoose.model('Product');
  const StockMovement = mongoose.model('StockMovement');

  for (const order of expiredOrders) {
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.adminNotes = (order.adminNotes || '') + ` [Auto-annulé: délai de paiement expiré]`;
    await order.save();

    // Restore stock for each item and record stock movement
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (product) {
        const previousStock = product.stock;
        product.stock += item.quantity;
        await product.save();

        // Create stock movement record
        await StockMovement.create({
          productId: product._id,
          boutiqueId: item.boutiqueId,
          type: 'in',
          quantity: item.quantity,
          previousStock,
          newStock: product.stock,
          reason: `Expiration commande - ${order.orderReference} (délai de paiement dépassé)`,
          reference: order.orderReference,
          userId: order.userId
        });

        console.log(`🔄 Stock restored for "${product.name}": ${previousStock} → ${product.stock} (order expired: ${order.orderReference})`);
      }
    }
  }

  return expiredOrders.length;
};

module.exports = mongoose.model('Order', orderSchema);
