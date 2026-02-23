const mongoose = require('mongoose');
const slugify = require('slugify');

const openingHoursSchema = new mongoose.Schema({
  day: {
    type: Number,
    required: [true, 'Le jour est requis'],
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
    maxlength: [2000, 'La description ne peut pas dépasser 2000 caractères']
  },
  shortDescription: {
    type: String,
    trim: true,
    maxlength: [200, 'La description courte ne peut pas dépasser 200 caractères']
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'La catégorie est requise']
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
      message: 'Les heures d\'ouverture doivent contenir 7 entrées (lundi à dimanche)'
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
      message: 'Le statut doit être en attente, actif, inactif ou rejeté'
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
      values: ['libre', 'temporaire', 'occupee'],
      message: 'Le statut emplacement doit être: libre, temporaire ou occupee'
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
  },
  // Modélisation 2D du centre commercial (étages / zones)
  zoneId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Zone',
    default: null
  },
  floorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Floor',
    default: null
  },
  mapShape: {
    x: { type: Number },
    y: { type: Number },
    width: { type: Number },
    height: { type: Number }
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
boutiqueSchema.index({ zoneId: 1 });
boutiqueSchema.index({ floorId: 1 });

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

  // Validate photos array length
  if (this.photos && this.photos.length > 10) {
    throw new Error('Le tableau de photos ne peut pas dépasser 10 éléments');
  }
});

module.exports = mongoose.model('Boutique', boutiqueSchema);
