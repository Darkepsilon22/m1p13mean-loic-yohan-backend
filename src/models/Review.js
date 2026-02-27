const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  boutiqueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Boutique',
    required: [true, 'Boutique is required']
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User (author) is required']
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: 1,
    max: 5,
    set: (v) => (v != null ? Math.round(v) : v)
  },
  comment: {
    type: String,
    trim: true,
    maxlength: [1000, 'Comment cannot exceed 1000 characters']
  },
  response: {
    text: {
      type: String,
      trim: true,
      maxlength: [500, 'Response cannot exceed 500 characters']
    },
    respondedAt: { type: Date }
  },
  status: {
    type: String,
    enum: {
      values: ['published', 'hidden', 'reported', 'deleted'],
      message: 'Status must be published, hidden, reported, or deleted'
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

reviewSchema.index({ boutiqueId: 1, productId: 1, userId: 1 }, { unique: true });
reviewSchema.index({ boutiqueId: 1, productId: 1 });
reviewSchema.index({ boutiqueId: 1 });
reviewSchema.index({ status: 1 });
reviewSchema.index({ rating: -1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ reportCount: 1 });
reviewSchema.index({ boutiqueId: 1, status: 1 });

const Review = mongoose.model('Review', reviewSchema);

// Migration: supprimer l'ancien index unique {boutiqueId, userId} s'il existe
Review.collection.dropIndex('boutiqueId_1_userId_1').catch(() => {
  // L'index n'existe plus, c'est OK
});

// Migration: ajouter productId: null aux anciens avis qui n'ont pas ce champ
Review.updateMany(
  { productId: { $exists: false } },
  { $set: { productId: null } }
).then(result => {
  if (result.modifiedCount > 0) {
    console.log(`[Review migration] ${result.modifiedCount} ancien(s) avis mis à jour avec productId: null`);
  }
}).catch(() => {});

module.exports = Review;
