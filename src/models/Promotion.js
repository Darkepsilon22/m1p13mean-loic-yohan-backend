const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
  boutiqueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Boutique',
    required: [true, 'La boutique est requise']
  },
  title: {
    type: String,
    required: [true, 'Le titre de la promotion est requis'],
    trim: true,
    maxlength: [200, 'Le titre ne peut pas dépasser 200 caractères']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'La description ne peut pas dépasser 1000 caractères']
  },
  type: {
    type: String,
    enum: {
      values: ['percentage', 'fixed', 'special'],
      message: 'Le type doit être percentage, fixed ou special'
    },
    required: [true, 'Le type de promotion est requis']
  },
  value: {
    type: Number,
    min: [0, 'La valeur doit être au moins 0'],
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
          return 'Le pourcentage doit être entre 1 et 99 (RG32)';
        }
        return 'La valeur est requise pour les promotions de type percentage et fixed';
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
    required: [true, 'La date de début est requise (RG30)']
  },
  endDate: {
    type: Date,
    required: [true, 'La date de fin est requise (RG30)'],
    validate: {
      validator: function(v) {
        // End date must be after start date (RG31)
        return v > this.startDate;
      },
      message: 'La date de fin doit être après la date de début (RG31)'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['scheduled', 'active', 'ended', 'cancelled'],
      message: 'Le statut doit être scheduled, active, ended ou cancelled'
    },
    default: 'scheduled'
  }
}, {
  timestamps: true
});

// Indexes
promotionSchema.index({ boutiqueId: 1 });
promotionSchema.index({ status: 1 });
promotionSchema.index({ startDate: 1, endDate: 1 });
promotionSchema.index({ endDate: 1 }); // For cron job to update expired promotions

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
