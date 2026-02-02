const mongoose = require('mongoose');
const slugify = require('slugify');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
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
    required: [true, 'Description is required'],
    trim: true
  },
  shortDescription: {
    type: String,
    trim: true
  },
  image: {
    type: String,
    required: [true, 'Image URL is required'],
    trim: true
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  visibility: {
    type: String,
    enum: {
      values: ['public', 'boutiques'],
      message: 'Visibility must be public or boutiques'
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
    required: [true, 'createdBy (admin) is required']
  },
  status: {
    type: String,
    enum: {
      values: ['draft', 'published', 'ended', 'cancelled'],
      message: 'Status must be draft, published, ended, or cancelled'
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

eventSchema.pre('validate', function(next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    next(new Error('End date must be after start date'));
  } else {
    next();
  }
});

eventSchema.pre('save', function(next) {
  if (this.isModified('title') && this.title && (!this.slug || this.slug === '')) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  if (this.isModified('title') && this.title && this.slug === '') {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  next();
});

module.exports = mongoose.model('Event', eventSchema);
