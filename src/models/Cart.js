const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },
  boutiqueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Boutique',
    required: [true, 'Boutique is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    default: 1
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative']
  },
  productName: {
    type: String,
    required: true
  },
  productImage: {
    type: String
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

// Calculate item total
cartItemSchema.virtual('totalPrice').get(function() {
  return this.quantity * this.unitPrice;
});

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    unique: true
  },
  items: {
    type: [cartItemSchema],
    validate: {
      validator: function(v) {
        return v.length <= 50;
      },
      message: 'Cart cannot have more than 50 different items'
    }
  },
  currency: {
    type: String,
    enum: ['MGA'],
    default: 'MGA'
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index
cartSchema.index({ userId: 1 });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Virtual for total items count
cartSchema.virtual('itemsCount').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for subtotal
cartSchema.virtual('subtotal').get(function() {
  return this.items.reduce((total, item) => total + (item.quantity * item.unitPrice), 0);
});

// Virtual for items grouped by boutique
cartSchema.virtual('itemsByBoutique').get(function() {
  const grouped = {};
  this.items.forEach(item => {
    const boutiqueId = item.boutiqueId.toString();
    if (!grouped[boutiqueId]) {
      grouped[boutiqueId] = [];
    }
    grouped[boutiqueId].push(item);
  });
  return grouped;
});

// Method to add item to cart
cartSchema.methods.addItem = async function(product, quantity = 1, effectivePrice = null) {
  const price = effectivePrice != null ? effectivePrice : product.price;
  const existingItem = this.items.find(
    item => item.productId.toString() === product._id.toString()
  );

  if (existingItem) {
    existingItem.quantity += quantity;
    existingItem.unitPrice = price; // Update price (avec promo si applicable)
  } else {
    this.items.push({
      productId: product._id,
      boutiqueId: product.boutiqueId,
      quantity,
      unitPrice: price,
      productName: product.name,
      productImage: product.mainPhoto || (product.photos && product.photos[0])
    });
  }

  // Reset expiration
  this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return this.save();
};

// Method to update item quantity
cartSchema.methods.updateItemQuantity = async function(productId, quantity) {
  const item = this.items.find(
    item => item.productId.toString() === productId.toString()
  );

  if (!item) {
    throw new Error('Article introuvable dans le panier');
  }

  if (quantity <= 0) {
    return this.removeItem(productId);
  }

  item.quantity = quantity;
  return this.save();
};

// Method to remove item from cart
cartSchema.methods.removeItem = async function(productId) {
  this.items = this.items.filter(
    item => item.productId.toString() !== productId.toString()
  );
  return this.save();
};

// Method to clear cart
cartSchema.methods.clearCart = async function() {
  this.items = [];
  return this.save();
};

// Method to check stock availability for all items
cartSchema.methods.validateStock = async function() {
  const Product = mongoose.model('Product');
  const Promotion = mongoose.model('Promotion');
  const errors = [];
  let priceUpdated = false;

  for (const item of this.items) {
    const product = await Product.findById(item.productId);

    if (!product) {
      errors.push({
        productId: item.productId,
        productName: item.productName,
        error: 'Le produit n\'existe plus'
      });
      continue;
    }

    if (product.isArchived) {
      errors.push({
        productId: item.productId,
        productName: item.productName,
        error: 'Le produit n\'est plus disponible'
      });
      continue;
    }

    if (product.stock < item.quantity) {
      errors.push({
        productId: item.productId,
        productName: item.productName,
        error: `Stock insuffisant. Disponible : ${product.stock}, Demandé : ${item.quantity}`,
        availableStock: product.stock
      });
    }

    // Calculer le prix effectif (avec promo si applicable)
    let effectivePrice = product.price;
    const now = new Date();
    const promo = await Promotion.findOne({
      products: product._id,
      status: 'active',
      startDate: { $lte: now },
      endDate: { $gt: now }
    });
    if (promo) {
      if (promo.type === 'percentage' && promo.value != null) {
        effectivePrice = Math.round(product.price * (1 - promo.value / 100));
      } else if (promo.type === 'fixed' && promo.value != null) {
        effectivePrice = Math.max(0, Math.round(product.price - promo.value));
      }
    }

    if (item.unitPrice !== effectivePrice) {
      item.unitPrice = effectivePrice;
      priceUpdated = true;
    }
  }

  if (errors.length > 0 || priceUpdated) {
    await this.save();
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// Static method to get or create cart for user
cartSchema.statics.getOrCreateCart = async function(userId) {
  let cart = await this.findOne({ userId });

  if (!cart) {
    cart = await this.create({ userId, items: [] });
  }

  return cart;
};

module.exports = mongoose.model('Cart', cartSchema);
