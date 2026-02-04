const mongoose = require('mongoose');

/**
 * Modèle ReservationBoutique - Historique des réservations de boutiques
 * Pour l'audit, statistiques, facturation et traçabilité
 * Note: Emplacement = Boutique (pas de collection Emplacement séparée)
 */
const reservationBoutiqueSchema = new mongoose.Schema({
  boutique: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Boutique',
    required: [true, 'La boutique est requise']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'L\'utilisateur est requis']
  },
  status: {
    type: String,
    enum: {
      values: ['temporaire', 'en_attente_validation', 'confirmee', 'refusee', 'annulee', 'expiree'],
      message: 'Le statut doit être: temporaire, en_attente_validation, confirmee, refusee, annulee ou expiree'
    },
    default: 'temporaire'
  },
  price: {
    type: Number,
    required: [true, 'Le prix est requis']
  },
  boutiqueSnapshot: {
    name: String,
    location: {
      floor: Number,
      zone: String,
      number: String
    },
    surface: Number
  },
  expiresAt: {
    type: Date,
    required: [true, 'La date d\'expiration est requise']
  },
  // Date de demande de confirmation (passage en en_attente_validation)
  requestedAt: {
    type: Date,
    default: null
  },
  // Date de validation par l'admin
  confirmedAt: {
    type: Date,
    default: null
  },
  // Admin qui a validé/refusé
  validatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  // Raison du refus par l'admin
  rejectionReason: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
reservationBoutiqueSchema.index({ boutique: 1 });
reservationBoutiqueSchema.index({ user: 1 });
reservationBoutiqueSchema.index({ status: 1 });
reservationBoutiqueSchema.index({ expiresAt: 1 });
reservationBoutiqueSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ReservationBoutique', reservationBoutiqueSchema);
