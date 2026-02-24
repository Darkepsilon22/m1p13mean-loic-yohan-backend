const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Le produit est requis']
  },
  boutiqueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Boutique',
    required: [true, 'La boutique est requise']
  },
  type: {
    type: String,
    enum: {
      values: ['in', 'out', 'adjustment', 'initial'],
      message: 'Le type doit être in, out, adjustment ou initial'
    },
    required: [true, 'Le type de mouvement est requis']
  },
  quantity: {
    type: Number,
    required: [true, 'La quantité est requise'],
    validate: {
      validator: function(v) {
        // For 'out' type, quantity should be negative or we handle it in controller
        return v !== 0;
      },
      message: 'La quantité ne peut pas être zéro'
    }
  },
  previousStock: {
    type: Number,
    required: [true, 'Le stock précédent est requis']
  },
  newStock: {
    type: Number,
    required: [true, 'Le nouveau stock est requis']
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [500, 'La raison ne peut pas dépasser 500 caractères']
  },
  reference: {
    type: String,
    trim: true,
    maxlength: [100, 'La référence ne peut pas dépasser 100 caractères']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'L\'utilisateur qui a effectué le mouvement est requis']
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
