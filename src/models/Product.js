const mongoose = require('mongoose');
const slugify = require('slugify');

const productSchema = new mongoose.Schema({
  boutiqueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Boutique',
    required: [true, 'La boutique est requise']
  },
  name: {
    type: String,
    required: [true, 'Le nom du produit est requis'],
    trim: true,
    maxlength: [200, 'Le nom ne peut pas dépasser 200 caractères']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'La description ne peut pas dépasser 2000 caractères']
  },
  price: {
    type: Number,
    required: [true, 'Le prix est requis'],
    min: [0, 'Le prix doit être au moins 0']
  },
  originalPrice: {
    type: Number,
    min: [0, 'Le prix original doit être au moins 0']
  },
  photos: {
    type: [String],
    validate: {
      validator: function(v) {
        return v.length <= 5;
      },
      message: 'Le tableau de photos ne peut pas dépasser 5 éléments (RG22)'
    }
  },
  mainPhoto: {
    type: String
  },
  categoryInternal: {
    type: String,
    trim: true,
    maxlength: [100, 'La catégorie interne ne peut pas dépasser 100 caractères']
  },
  stock: {
    type: Number,
    default: 0,
    min: [0, 'Le stock ne peut pas être négatif']
  },
  lowStockThreshold: {
    type: Number,
    default: 5,
    min: [0, 'Le seuil de stock faible ne peut pas être négatif']
  },
  availability: {
    type: String,
    enum: {
      values: ['available', 'outOfStock', 'onOrder'],
      message: 'La disponibilité doit être available, outOfStock ou onOrder'
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

// Pre-validate hook for slug generation
productSchema.pre('validate', function() {
  if (this.isModified('name') && this.name && !this.slug) {
    // Add boutiqueId to make slug unique per boutique
    const baseSlug = slugify(this.name, { lower: true, strict: true });
    this.slug = `${baseSlug}-${this.boutiqueId.toString().slice(-6)}`;
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
