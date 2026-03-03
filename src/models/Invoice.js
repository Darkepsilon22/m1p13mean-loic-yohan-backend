const mongoose = require('mongoose');

const paymentEntrySchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  method: {
    type: String,
    enum: ['cash', 'card', 'stripe', 'bank_transfer', 'mvola', 'orange', 'airtel'],
    required: true
  },
  reference: { type: String, trim: true },
  paidAt: { type: Date, default: Date.now },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String, trim: true }
}, { _id: true });

const invoiceSchema = new mongoose.Schema({
  reference: {
    type: String,
    required: true,
    unique: true
  },

  contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    required: [true, 'Le contrat est requis']
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Le locataire est requis']
  },
  boutique: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Boutique',
    required: [true, 'La boutique est requise']
  },

  amountDue: {
    type: Number,
    required: [true, 'Le montant dû est requis'],
    min: [0, 'Le montant ne peut pas être négatif']
  },
  amountPaid: {
    type: Number,
    default: 0,
    min: [0, 'Le montant payé ne peut pas être négatif']
  },
  lateFees: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    enum: ['MGA'],
    default: 'MGA'
  },

  periodStart: {
    type: Date,
    required: [true, 'La date début de période est requise']
  },
  periodEnd: {
    type: Date,
    required: [true, 'La date fin de période est requise']
  },
  dueDate: {
    type: Date,
    required: [true, "La date d'échéance est requise"]
  },

  status: {
    type: String,
    enum: {
      values: ['pending', 'paid', 'partial', 'late', 'default', 'cancelled'],
      message: 'Statut invalide'
    },
    default: 'pending'
  },

  payments: [paymentEntrySchema],

  paidInFullAt: { type: Date, default: null },
  lateAt: { type: Date, default: null },
  defaultAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },

  type: {
    type: String,
    enum: ['rent', 'deposit', 'late_fee'],
    default: 'rent'
  },

  notes: { type: String, trim: true },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, {
  timestamps: true
});

invoiceSchema.index({ contract: 1 });
invoiceSchema.index({ tenant: 1 });
invoiceSchema.index({ boutique: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index({ reference: 1 }, { unique: true });
invoiceSchema.index({ type: 1 });
invoiceSchema.index({ status: 1, dueDate: 1 });
invoiceSchema.index({ contract: 1, periodStart: 1 }, { unique: true });

// Auto-generate reference and validate dates
invoiceSchema.pre('validate', function () {
  if (this.isNew && !this.reference) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.reference = `INV-${dateStr}-${randomPart}`;
  }

  // Validate periodEnd >= periodStart (equal is allowed for deposit invoices)
  if (this.periodStart && this.periodEnd && this.periodEnd < this.periodStart) {
    this.invalidate('periodEnd', 'La date fin de période doit être après ou égale à la date début');
  }

  // Validate amountPaid does not exceed totalDue
  const totalDue = (this.amountDue || 0) + (this.lateFees || 0);
  if (this.amountPaid > totalDue) {
    this.invalidate('amountPaid', 'Le montant payé ne peut pas dépasser le montant dû');
  }
});

// Virtual: remaining balance
invoiceSchema.virtual('balance').get(function () {
  return (this.amountDue + this.lateFees) - this.amountPaid;
});

// Virtual: total due
invoiceSchema.virtual('totalDue').get(function () {
  return this.amountDue + this.lateFees;
});

// Virtual: is overdue
invoiceSchema.virtual('isOverdue').get(function () {
  return this.dueDate < new Date() && !['paid', 'cancelled'].includes(this.status);
});

// Virtual: days overdue
invoiceSchema.virtual('daysOverdue').get(function () {
  if (!this.isOverdue) return 0;
  const diff = new Date() - this.dueDate;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

invoiceSchema.methods.recordPayment = async function (paymentData) {
  this.payments.push(paymentData);
  this.amountPaid += paymentData.amount;

  const totalDue = this.amountDue + this.lateFees;
  if (this.amountPaid >= totalDue) {
    this.status = 'paid';
    this.paidInFullAt = new Date();
  } else if (this.amountPaid > 0 && this.status !== 'late' && this.status !== 'default') {
    this.status = 'partial';
  }

  return this.save();
};

invoiceSchema.set('toJSON', { virtuals: true });
invoiceSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
