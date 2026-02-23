const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  boutiqueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Boutique',
    required: [true, 'La boutique est requise']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'L\'utilisateur (auteur) est requis']
  },
  rating: {
    type: Number,
    required: [true, 'La note est requise'],
    min: 1,
    max: 5,
    set: (v) => (v != null ? Math.round(v) : v)
  },
  comment: {
    type: String,
    trim: true,
    maxlength: [1000, 'Le commentaire ne peut pas dépasser 1000 caractères']
  },
  response: {
    text: {
      type: String,
      trim: true,
      maxlength: [500, 'La réponse ne peut pas dépasser 500 caractères']
    },
    respondedAt: { type: Date }
  },
  status: {
    type: String,
    enum: {
      values: ['published', 'hidden', 'reported', 'deleted'],
      message: 'Le statut doit être publié, masqué, signalé ou supprimé'
    },
    required: true,
    default: 'published'
  },
  reportCount: {
    type: Number,
    default: 0
  },
  reportReasons: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

reviewSchema.index({ boutiqueId: 1, userId: 1 }, { unique: true });
reviewSchema.index({ boutiqueId: 1 });
reviewSchema.index({ status: 1 });
reviewSchema.index({ rating: -1 });
reviewSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
