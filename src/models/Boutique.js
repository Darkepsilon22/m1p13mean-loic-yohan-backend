const mongoose = require('mongoose');
const slugify = require('slugify');

const openingHoursSchema = new mongoose.Schema({
  day: {
    type: Number,
    required: [true, 'Day is required'],
    min: 0,
    max: 6
  },
  open: { type: String, trim: true },
  close: { type: String, trim: true },
  isClosed: {
    type: Boolean,
    required: true,
    default: true
  }
}, { _id: false });

const boutiqueSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  name: {
    type: String,
    required: false,
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    sparse: true, // Permet plusieurs valeurs null/undefined
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    required: false,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  shortDescription: {
    type: String,
    trim: true,
    maxlength: [200, 'Short description cannot exceed 200 characters']
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  logo: {
    type: String,
    required: false,
    trim: true
  },
  coverImage: { type: String, trim: true },
  photos: [{
    type: String,
    trim: true
  }],
  contact: {
    phone: {
      type: String,
      required: false,
      trim: true
    },
    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true
    },
    website: { type: String, trim: true },
    facebook: { type: String, trim: true },
    instagram: { type: String, trim: true }
  },
  location: {
    floor: {
      type: Number,
      default: 0
    },
    zone: {
      type: String,
      trim: true
    },
    number: {
      type: String,
      trim: true
    },
    mapCoordinates: {
      x: { type: Number },
      y: { type: Number }
    }
  },
  openingHours: {
    type: [openingHoursSchema],
    required: true,
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length === 7;
      },
      message: 'Opening hours must contain 7 entries (Monday to Sunday)'
    }
  },
  rating: {
    average: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    count: { type: Number, default: 0 }
  },
  stats: {
    views: { type: Number, default: 0 },
    favoritesCount: { type: Number, default: 0 }
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'active', 'inactive', 'rejected'],
      message: 'Status must be pending, active, inactive, or rejected'
    },
    required: true,
    default: 'pending'
  },
  rejectionReason: { type: String, trim: true },
  // Champs pour la gestion des emplacements (Emplacement = Boutique)
  price: {
    type: Number,
    min: [0, 'Le prix ne peut pas être négatif'],
    default: null
  },
  surface: {
    type: Number,
    min: [1, 'La surface doit être positive'],
    default: null
  },
  amenities: [{
    type: String,
    trim: true
  }],
  emplacementStatus: {
    type: String,
    enum: {
      values: ['libre', 'temporaire', 'reservee', 'occupee'],
      message: 'Le statut emplacement doit être: libre, temporaire, reservee ou occupee'
    },
    default: 'libre'
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reservationExpires: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

boutiqueSchema.index({ userId: 1 }, { sparse: true });
boutiqueSchema.index({ name: 'text' });
boutiqueSchema.index({ categoryId: 1 });
boutiqueSchema.index({ status: 1 });
boutiqueSchema.index({ 'rating.average': -1 });
boutiqueSchema.index({ 'location.floor': 1, 'location.zone': 1 });
boutiqueSchema.index({ emplacementStatus: 1 });
boutiqueSchema.index({ assignee: 1 });
boutiqueSchema.index({ reservationExpires: 1 });
boutiqueSchema.index({ price: 1 });

// Méthode pour vérifier si la réservation a expiré
boutiqueSchema.methods.isReservationExpired = function() {
  if (this.emplacementStatus !== 'temporaire' || !this.reservationExpires) {
    return false;
  }
  return new Date() > this.reservationExpires;
};

// Méthode statique pour obtenir le nombre d'emplacements disponibles
boutiqueSchema.statics.getAvailableCount = async function() {
  return this.countDocuments({ emplacementStatus: 'libre' });
};

boutiqueSchema.pre('validate', function() {
  // Generate slug from name before validation
  if (this.isModified('name') && this.name && !this.slug) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  if (this.isModified('name') && this.name && this.slug === '') {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }

  if (this.photos && this.photos.length > 10) {
    throw new Error('Photos array cannot exceed 10 items');
  }
});

module.exports = mongoose.model('Boutique', boutiqueSchema);
