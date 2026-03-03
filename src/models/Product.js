const mongoose = require('mongoose');
const slugify = require('slugify');

const productSchema = new mongoose.Schema({
  boutiqueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Boutique',
    required: [true, 'Boutique is required']
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Name cannot exceed 200 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price must be at least 0']
  },
  originalPrice: {
    type: Number,
    min: [0, 'Original price must be at least 0']
  },
  photos: {
    type: [String],
    validate: {
      validator: function(v) {
        return v.length <= 5;
      },
      message: 'Photos array cannot exceed 5 items (RG22)'
    }
  },
  mainPhoto: {
    type: String
  },
  categoryInternal: {
    type: String,
    trim: true,
    maxlength: [100, 'Internal category cannot exceed 100 characters']
  },
  stock: {
    type: Number,
    default: 0,
    min: [0, 'Stock cannot be negative']
  },
  lowStockThreshold: {
    type: Number,
    default: 5,
    min: [0, 'Low stock threshold cannot be negative']
  },
  availability: {
    type: String,
    enum: {
      values: ['available', 'outOfStock', 'onOrder'],
      message: 'Availability must be available, outOfStock, or onOrder'
    },
    default: 'available'
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
productSchema.index({ boutiqueId: 1 });
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ availability: 1 });
productSchema.index({ isFeatured: -1 });
productSchema.index({ isArchived: 1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ categoryInternal: 1 });
productSchema.index({ boutiqueId: 1, isArchived: 1 });
productSchema.index({ boutiqueId: 1, availability: 1 });

// Pre-validate hook for slug generation and price validation
productSchema.pre('validate', function() {
  if (this.isModified('name') && this.name && !this.slug) {
    // Add boutiqueId to make slug unique per boutique
    const baseSlug = slugify(this.name, { lower: true, strict: true });
    this.slug = `${baseSlug}-${this.boutiqueId.toString().slice(-6)}`;
  }

  // Validate originalPrice >= price (originalPrice is the "before discount" price)
  if (this.originalPrice != null && this.price != null && this.originalPrice < this.price) {
    this.invalidate('originalPrice', 'Le prix original doit être supérieur ou égal au prix actuel');
  }
});

// Set mainPhoto from photos array if not set
productSchema.pre('save', function() {
  if (this.photos && this.photos.length > 0 && !this.mainPhoto) {
    this.mainPhoto = this.photos[0];
  }
});

// Auto-update availability based on stock level
productSchema.pre('save', function() {
  if (this.isModified('stock')) {
    if (this.stock === 0) {
      this.availability = 'outOfStock';
    } else if (this.stock > 0 && this.availability === 'outOfStock') {
      this.availability = 'available';
    }
  }
});

// Method to check if stock is low
productSchema.methods.isLowStock = function() {
  return this.stock > 0 && this.stock <= this.lowStockThreshold;
};

module.exports = mongoose.model('Product', productSchema);
