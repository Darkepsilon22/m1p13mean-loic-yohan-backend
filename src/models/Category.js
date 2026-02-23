const mongoose = require('mongoose');
const slugify = require('slugify');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom de la catégorie est requis'],
    trim: true,
    unique: true,
    maxlength: [100, 'Le nom de la catégorie ne peut pas dépasser 100 caractères']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'La description ne peut pas dépasser 500 caractères']
  },
  icon: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        // Validate hex color format (e.g., #FF5733)
        return !v || /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(v);
      },
      message: 'La couleur doit être une couleur hexadécimale valide (ex. : #FF5733)'
    }
  },
  image: {
    type: String,
    trim: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  order: {
    type: Number,
    required: true,
    default: 0
  },
  isActive: {
    type: Boolean,
    required: true,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for subcategories
categorySchema.virtual('children', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentId'
});

// Indexes
categorySchema.index({ parentId: 1 });
categorySchema.index({ order: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ name: 'text', description: 'text' });

// Pre-validate: prevent circular reference
categorySchema.pre('validate', async function() {
  if (this.parentId) {
    // Check if parentId equals current _id
    if (this._id && this.parentId.toString() === this._id.toString()) {
      throw new Error('Une catégorie ne peut pas être son propre parent');
    }

    // Check if parent exists
    const parent = await mongoose.model('Category').findById(this.parentId);
    if (!parent) {
      throw new Error('Catégorie parente introuvable');
    }

    // Prevent deep nesting (max 2 levels: parent -> child)
    if (parent.parentId) {
      throw new Error('La profondeur maximale des catégories est de 2 niveaux (parent et enfant uniquement)');
    }
  }
});

// Pre-validate: generate slug from name (must run before validation)
categorySchema.pre('validate', function() {
  if (this.isModified('name') && this.name && !this.slug) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
});

// Pre-remove: check if category has boutiques or subcategories
categorySchema.pre('deleteOne', { document: true, query: false }, async function() {
  const Boutique = mongoose.model('Boutique');

  // Check for boutiques using this category
  const boutiqueCount = await Boutique.countDocuments({ categoryId: this._id });
  if (boutiqueCount > 0) {
    throw new Error(`Impossible de supprimer la catégorie : ${boutiqueCount} boutique(s) l'utilise(nt)`);
  }

  // Check for subcategories
  const childCount = await mongoose.model('Category').countDocuments({ parentId: this._id });
  if (childCount > 0) {
    throw new Error(`Impossible de supprimer la catégorie : ${childCount} sous-catégorie(s) existe(nt)`);
  }
});

// Static method: get category tree (hierarchical structure)
categorySchema.statics.getTree = async function(activeOnly = true) {
  const filter = activeOnly ? { isActive: true, parentId: null } : { parentId: null };

  const categories = await this.find(filter)
    .populate({
      path: 'children',
      match: activeOnly ? { isActive: true } : {},
      options: { sort: { order: 1 } }
    })
    .sort({ order: 1 })
    .lean();

  return categories;
};

// Static method: get all active root categories
categorySchema.statics.getRootCategories = async function(activeOnly = true) {
  const filter = activeOnly ? { isActive: true, parentId: null } : { parentId: null };
  return this.find(filter).sort({ order: 1 });
};

// Static method: get children of a category
categorySchema.statics.getChildren = async function(parentId, activeOnly = true) {
  const filter = activeOnly
    ? { isActive: true, parentId }
    : { parentId };
  return this.find(filter).sort({ order: 1 });
};

// Instance method: get full path (for breadcrumb)
categorySchema.methods.getPath = async function() {
  const path = [this];

  if (this.parentId) {
    const parent = await mongoose.model('Category').findById(this.parentId);
    if (parent) {
      path.unshift(parent);
    }
  }

  return path;
};

module.exports = mongoose.model('Category', categorySchema);
