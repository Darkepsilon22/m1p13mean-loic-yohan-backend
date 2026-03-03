const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
  boutiqueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Boutique',
    required: [true, 'Boutique is required']
  },
  title: {
    type: String,
    required: [true, 'Promotion title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  type: {
    type: String,
    enum: {
      values: ['percentage', 'fixed', 'special'],
      message: 'Type must be percentage, fixed, or special'
    },
    required: [true, 'Promotion type is required']
  },
  value: {
    type: Number,
    min: [0, 'Value must be at least 0'],
    validate: {
      validator: function(v) {
        // Value is required for percentage and fixed types
        if ((this.type === 'percentage' || this.type === 'fixed') && (v === null || v === undefined)) {
          return false;
        }
        // For percentage, value must be between 1 and 99 (RG32)
        if (this.type === 'percentage' && (v < 1 || v > 99)) {
          return false;
        }
        return true;
      },
      message: function(props) {
        if (this.type === 'percentage') {
          return 'Percentage must be between 1 and 99 (RG32)';
        }
        return 'Value is required for percentage and fixed promotions';
      }
    }
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  image: {
    type: String
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required (RG30)']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required (RG30)'],
    validate: {
      validator: function(v) {
        // End date must be after start date (RG31)
        return v > this.startDate;
      },
      message: 'End date must be after start date (RG31)'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['scheduled', 'active', 'ended', 'cancelled'],
      message: 'Status must be scheduled, active, ended, or cancelled'
    },
    default: 'scheduled'
  },
  maxUsagePerUser: {
    type: Number,
    default: null,
    min: [1, 'Max usage per user must be at least 1']
  },
  maxTotalUsage: {
    type: Number,
    default: null,
    min: [1, 'Max total usage must be at least 1']
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  minOrderValue: {
    type: Number,
    default: null,
    min: [0, 'Minimum order value cannot be negative']
  }
}, {
  timestamps: true
});

// Indexes
promotionSchema.index({ boutiqueId: 1 });
promotionSchema.index({ status: 1 });
promotionSchema.index({ startDate: 1, endDate: 1 });
promotionSchema.index({ endDate: 1 }); // For cron job to update expired promotions
promotionSchema.index({ products: 1 });
promotionSchema.index({ status: 1, startDate: 1, endDate: 1 });

// Pre-save hook to set initial status based on dates
promotionSchema.pre('save', function() {
  if (this.isNew || this.isModified('startDate') || this.isModified('endDate')) {
    const now = new Date();

    if (this.status !== 'cancelled') {
      if (now >= this.startDate && now <= this.endDate) {
        this.status = 'active';
      } else if (now < this.startDate) {
        this.status = 'scheduled';
      } else if (now > this.endDate) {
        this.status = 'ended';
      }
    }
  }
});

// Static method to update promotion statuses (called by cron job)
promotionSchema.statics.updateStatuses = async function() {
  const now = new Date();

  // Activate scheduled promotions that have started
  await this.updateMany(
    {
      status: 'scheduled',
      startDate: { $lte: now },
      endDate: { $gt: now }
    },
    { status: 'active' }
  );

  // End active promotions that have expired (RG33)
  await this.updateMany(
    {
      status: 'active',
      endDate: { $lte: now }
    },
    { status: 'ended' }
  );

  // Also end scheduled promotions that have passed without being activated
  await this.updateMany(
    {
      status: 'scheduled',
      endDate: { $lte: now }
    },
    { status: 'ended' }
  );
};

// Static method to check if boutique can create a new active promotion (RG34)
promotionSchema.statics.canCreateActivePromotion = async function(boutiqueId) {
  const activeCount = await this.countDocuments({
    boutiqueId,
    status: { $in: ['scheduled', 'active'] }
  });
  return activeCount < 5; // RG34: max 5 active promotions
};

module.exports = mongoose.model('Promotion', promotionSchema);
