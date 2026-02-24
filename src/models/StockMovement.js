const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: {
      values: ['in', 'out', 'adjustment', 'initial'],
      message: 'Type must be in, out, adjustment, or initial'
    },
    required: [true, 'Movement type is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    validate: {
      validator: function(v) {
        // For 'out' type, quantity should be negative or we handle it in controller
        return v !== 0;
      },
      message: 'Quantity cannot be zero'
    }
  },
  previousStock: {
    type: Number,
    required: [true, 'Previous stock is required']
  },
  newStock: {
    type: Number,
    required: [true, 'New stock is required']
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  reference: {
    type: String,
    trim: true,
    maxlength: [100, 'Reference cannot exceed 100 characters']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User who made the movement is required']
  }
}, {
  timestamps: true
});

// Indexes
stockMovementSchema.index({ productId: 1 });
stockMovementSchema.index({ boutiqueId: 1 });
stockMovementSchema.index({ type: 1 });
stockMovementSchema.index({ createdAt: -1 });
stockMovementSchema.index({ userId: 1 });

// Static method to get stock history for a product
stockMovementSchema.statics.getProductHistory = async function(productId, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [movements, total] = await Promise.all([
    this.find({ productId })
      .populate('userId', 'name email')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit)),
    this.countDocuments({ productId })
  ]);

  return {
    movements,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  };
};

// Static method to get stock summary for a boutique
stockMovementSchema.statics.getBoutiqueSummary = async function(boutiqueId, startDate, endDate) {
  const matchQuery = { boutiqueId: new mongoose.Types.ObjectId(boutiqueId) };

  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
    if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
  }

  const summary = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' }
      }
    }
  ]);

  return summary;
};

module.exports = mongoose.model('StockMovement', stockMovementSchema);
