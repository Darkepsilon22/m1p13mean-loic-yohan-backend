const mongoose = require('mongoose');

const contractSchema = new mongoose.Schema({
  reference: {
    type: String,
    required: true,
    unique: true
  },

  boutique: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Boutique',
    required: [true, 'La boutique est requise']
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Le locataire est requis']
  },
  reservation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReservationBoutique',
    default: null
  },

  monthlyRent: {
    type: Number,
    required: [true, 'Le loyer mensuel est requis'],
    min: [0, 'Le loyer ne peut pas être négatif']
  },
  deposit: {
    type: Number,
    required: [true, 'La caution est requise'],
    min: [0, 'La caution ne peut pas être négative']
  },
  depositStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'confirmed', 'refunded', 'partial_refund'],
    default: 'pending'
  },
  depositPaid: { type: Number, default: 0 },
  depositPaidAt: { type: Date, default: null },
  depositPayments: [{
    amount: { type: Number, required: true },
    method: { type: String, required: true },
    reference: { type: String, default: '' },
    paidAt: { type: Date, default: Date.now },
    notes: { type: String, default: '' }
  }],

  startDate: {
    type: Date,
    required: [true, 'La date de début est requise']
  },
  endDate: {
    type: Date,
    required: [true, 'La date de fin est requise']
  },
  billingDay: {
    type: Number,
    min: 1,
    max: 28,
    default: 1
  },

  // Status lifecycle: draft -> pending_signature -> pending_activation -> active -> suspended/terminated/expired
  status: {
    type: String,
    enum: {
      values: ['draft', 'pending_signature', 'pending_activation', 'active', 'suspended', 'terminated', 'expired'],
      message: 'Statut invalide'
    },
    default: 'draft'
  },

  signedAt: { type: Date, default: null },
  signedByTenant: { type: Boolean, default: false },

  suspendedAt: { type: Date, default: null },
  suspensionReason: { type: String, trim: true },

  terminatedAt: { type: Date, default: null },
  terminationReason: { type: String, trim: true },
  terminatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  paymentPlan: {
    totalDebt: { type: Number, default: 0 },
    installments: { type: Number, default: 0 },
    monthlyAmount: { type: Number, default: 0 },
    approvedByAdmin: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['none', 'proposed', 'approved', 'active', 'completed'],
      default: 'none'
    }
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  boutiqueSnapshot: {
    location: {
      floor: Number,
      zone: String,
      number: String
    },
    surface: Number,
    category: String
  },

  notes: { type: String, trim: true }
}, {
  timestamps: true
});

contractSchema.index({ boutique: 1 });
contractSchema.index({ tenant: 1 });
contractSchema.index({ status: 1 });
contractSchema.index({ reference: 1 }, { unique: true });
contractSchema.index({ startDate: 1, endDate: 1 });
contractSchema.index({ billingDay: 1, status: 1 });

contractSchema.pre('validate', function () {
  if (this.isNew && !this.reference) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.reference = `CTR-${dateStr}-${randomPart}`;
  }
});

// Virtual: duration in months
contractSchema.virtual('durationMonths').get(function () {
  if (!this.startDate || !this.endDate) return 0;
  const months = (this.endDate.getFullYear() - this.startDate.getFullYear()) * 12
    + (this.endDate.getMonth() - this.startDate.getMonth());
  return Math.max(0, months);
});

// Virtual: is active
contractSchema.virtual('isActive').get(function () {
  return this.status === 'active';
});

contractSchema.set('toJSON', { virtuals: true });
contractSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Contract', contractSchema);
