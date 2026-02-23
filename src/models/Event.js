const mongoose = require('mongoose');
const slugify = require('slugify');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Le titre est requis'],
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'La description est requise'],
    trim: true
  },
  shortDescription: {
    type: String,
    trim: true
  },
  image: {
    type: String,
    required: [true, 'L\'URL de l\'image est requise'],
    trim: true
  },
  startDate: {
    type: Date,
    required: [true, 'La date de début est requise']
  },
  endDate: {
    type: Date,
    required: [true, 'La date de fin est requise']
  },
  visibility: {
    type: String,
    enum: {
      values: ['public', 'boutiques'],
      message: 'La visibilité doit être public ou boutiques'
    },
    required: true,
    default: 'public'
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'createdBy (admin) est requis']
  },
  status: {
    type: String,
    enum: {
      values: ['draft', 'published', 'ended', 'cancelled'],
      message: 'Le statut doit être draft, published, ended ou cancelled'
    },
    required: true,
    default: 'draft'
  }
}, {
  timestamps: true
});

eventSchema.index({ slug: 1 }, { unique: true });
eventSchema.index({ status: 1 });
eventSchema.index({ visibility: 1 });
eventSchema.index({ startDate: 1, endDate: 1 });
eventSchema.index({ isFeatured: -1 });

eventSchema.pre('validate', function() {
  // Generate slug from title if not provided
  if (this.title && (!this.slug || this.slug === '')) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }

  // Validate dates
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    throw new Error('La date de fin doit être après la date de début');
  }
});

// Static method to update event statuses (called by cron job)
eventSchema.statics.updateStatuses = async function() {
  const now = new Date();

  // Publish draft events that have started
  await this.updateMany(
    {
      status: 'draft',
      startDate: { $lte: now },
      endDate: { $gt: now }
    },
    { status: 'published' }
  );

  // End published events that have expired
  await this.updateMany(
    {
      status: 'published',
      endDate: { $lte: now }
    },
    { status: 'ended' }
  );

  // Also end draft events that have passed without being published
  await this.updateMany(
    {
      status: 'draft',
      endDate: { $lte: now }
    },
    { status: 'ended' }
  );
};

module.exports = mongoose.model('Event', eventSchema);
