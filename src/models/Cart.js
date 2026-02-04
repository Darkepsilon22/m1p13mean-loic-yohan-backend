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
  items: [cartItemSchema],
  currency: {
    type: String,
    enum: ['MGA', 'EUR'],
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
cartSchema.methods.addItem = async function(product, quantity = 1) {
  const existingItem = this.items.find(
    item => item.productId.toString() === product._id.toString()
  );

  if (existingItem) {
    existingItem.quantity += quantity;
    existingItem.unitPrice = product.price; // Update price
  } else {
    this.items.push({
      productId: product._id,
      boutiqueId: product.boutiqueId,
      quantity,
      unitPrice: product.price,
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
    throw new Error('Item not found in cart');
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
  const errors = [];

  for (const item of this.items) {
    const product = await Product.findById(item.productId);

    if (!product) {
      errors.push({
        productId: item.productId,
        productName: item.productName,
        error: 'Product no longer exists'
      });
      continue;
    }

    if (product.isArchived) {
      errors.push({
        productId: item.productId,
        productName: item.productName,
        error: 'Product is no longer available'
      });
      continue;
    }

    if (product.stock < item.quantity) {
      errors.push({
        productId: item.productId,
        productName: item.productName,
        error: `Insufficient stock. Available: ${product.stock}, Requested: ${item.quantity}`,
        availableStock: product.stock
      });
    }

    // Update price if changed
    if (product.price !== item.unitPrice) {
      item.unitPrice = product.price;
    }
  }

  if (errors.length > 0) {
    await this.save(); // Save price updates
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
