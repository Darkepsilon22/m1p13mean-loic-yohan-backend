const Boutique = require('../models/Boutique');
const ReservationBoutique = require('../models/ReservationBoutique');
const mongoose = require('mongoose');

const RESERVATION_DURATION_MINUTES = 15; // Durée de réservation temporaire

class BoutiqueReservationService {
  /**
   * Réserver temporairement une boutique (emplacement)
   */
  static async reserveBoutique(boutiqueId, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Libérer d'abord les réservations expirées
      await this.releaseExpiredReservations();

      // Vérifier si la boutique existe et est libre
      const boutique = await Boutique.findById(boutiqueId).session(session);

      if (!boutique) {
        throw new Error('Boutique non trouvée');
      }

      if (boutique.emplacementStatus === 'occupee') {
        throw new Error('Cette boutique est déjà occupée');
      }

      if (boutique.emplacementStatus === 'temporaire') {
        // Vérifier si c'est le même utilisateur
        if (boutique.assignee?.toString() === userId.toString()) {
          // Prolonger la réservation existante
          const expiresAt = new Date(Date.now() + RESERVATION_DURATION_MINUTES * 60 * 1000);
          boutique.reservationExpires = expiresAt;
          await boutique.save({ session });

          // Mettre à jour la réservation existante
          await ReservationBoutique.findOneAndUpdate(
            { boutique: boutiqueId, user: userId, status: 'temporaire' },
            { expiresAt },
            { session }
          );

          await session.commitTransaction();
          return {
            success: true,
            message: 'Réservation prolongée',
            data: {
              boutique,
              expiresAt,
              expiresInMinutes: RESERVATION_DURATION_MINUTES
            }
          };
        } else {
          throw new Error('Cette boutique est temporairement réservée par un autre utilisateur');
        }
      }

      // Vérifier si l'utilisateur a déjà une réservation active ou en attente
      const existingReservation = await ReservationBoutique.findOne({
        user: userId,
        status: { $in: ['temporaire', 'en_attente_validation'] }
      }).session(session);

      if (existingReservation) {
        const statusMessage = existingReservation.status === 'en_attente_validation'
          ? 'Vous avez déjà une demande de réservation en attente de validation.'
          : 'Vous avez déjà une réservation en cours. Veuillez la confirmer ou l\'annuler avant d\'en créer une nouvelle.';
        throw new Error(statusMessage);
      }

      // Créer la réservation temporaire
      const expiresAt = new Date(Date.now() + RESERVATION_DURATION_MINUTES * 60 * 1000);

      // Mettre à jour la boutique
      boutique.emplacementStatus = 'temporaire';
      boutique.assignee = userId;
      boutique.reservationExpires = expiresAt;
      await boutique.save({ session });

      // Créer l'entrée dans l'historique
      const reservation = new ReservationBoutique({
        boutique: boutiqueId,
        user: userId,
        status: 'temporaire',
        price: boutique.price || 0,
        boutiqueSnapshot: {
          name: boutique.name,
          location: boutique.location,
          surface: boutique.surface
        },
        expiresAt
      });
      await reservation.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        message: 'Boutique réservée temporairement',
        data: {
          reservation,
          boutique,
          expiresAt,
          expiresInMinutes: RESERVATION_DURATION_MINUTES
        }
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Confirmer une réservation temporaire (demande ferme - passe en attente de validation admin)
   * Étape 2 du flux: temporaire -> en_attente_validation
   */
  static async confirmReservation(boutiqueId, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const boutique = await Boutique.findById(boutiqueId).session(session);

      if (!boutique) {
        throw new Error('Boutique non trouvée');
      }

      if (boutique.emplacementStatus !== 'temporaire') {
        throw new Error('Aucune réservation temporaire à confirmer');
      }

      if (boutique.assignee?.toString() !== userId.toString()) {
        throw new Error('Cette réservation ne vous appartient pas');
      }

      // Vérifier si la réservation n'a pas expiré
      if (boutique.isReservationExpired()) {
        throw new Error('La réservation a expiré');
      }

      // Passer en attente de validation (la boutique reste bloquée mais sans expiration)
      boutique.emplacementStatus = 'temporaire'; // Reste temporaire jusqu'à validation admin
      boutique.reservationExpires = null; // Plus d'expiration automatique
      await boutique.save({ session });

      // Mettre à jour l'historique - passe en attente de validation
      const reservation = await ReservationBoutique.findOneAndUpdate(
        { boutique: boutiqueId, user: userId, status: 'temporaire' },
        { status: 'en_attente_validation', requestedAt: new Date() },
        { new: true, session }
      );

      await session.commitTransaction();

      return {
        success: true,
        message: 'Demande de réservation envoyée. En attente de validation par l\'administrateur.',
        data: { boutique, reservation }
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Valider une réservation (Admin uniquement)
   * Étape 3a du flux: en_attente_validation -> confirmee
   */
  static async validateReservation(boutiqueId, adminId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const boutique = await Boutique.findById(boutiqueId).session(session);

      if (!boutique) {
        throw new Error('Boutique non trouvée');
      }

      // Trouver la réservation en attente
      const reservation = await ReservationBoutique.findOne({
        boutique: boutiqueId,
        status: 'en_attente_validation'
      }).session(session);

      if (!reservation) {
        throw new Error('Aucune réservation en attente de validation pour cette boutique');
      }

      // Confirmer définitivement la boutique
      boutique.emplacementStatus = 'occupee';
      boutique.userId = reservation.user;
      boutique.reservationExpires = null;
      await boutique.save({ session });

      // Mettre à jour l'historique - confirmée par admin
      reservation.status = 'confirmee';
      reservation.confirmedAt = new Date();
      reservation.validatedBy = adminId;
      await reservation.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        message: 'Réservation validée avec succès',
        data: { boutique, reservation }
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Refuser une réservation (Admin uniquement)
   * Étape 3b du flux: en_attente_validation -> refusee
   */
  static async rejectReservation(boutiqueId, adminId, reason = null) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const boutique = await Boutique.findById(boutiqueId).session(session);

      if (!boutique) {
        throw new Error('Boutique non trouvée');
      }

      // Trouver la réservation en attente
      const reservation = await ReservationBoutique.findOne({
        boutique: boutiqueId,
        status: 'en_attente_validation'
      }).session(session);

      if (!reservation) {
        throw new Error('Aucune réservation en attente de validation pour cette boutique');
      }

      // Libérer la boutique
      boutique.emplacementStatus = 'libre';
      boutique.assignee = null;
      boutique.reservationExpires = null;
      await boutique.save({ session });

      // Mettre à jour l'historique - refusée par admin
      reservation.status = 'refusee';
      reservation.cancelledAt = new Date();
      reservation.validatedBy = adminId;
      reservation.rejectionReason = reason || 'Refusé par l\'administrateur';
      await reservation.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        message: 'Réservation refusée',
        data: { boutique, reservation }
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Obtenir les réservations en attente de validation (Admin)
   */
  static async getPendingReservations() {
    const reservations = await ReservationBoutique.find({
      status: 'en_attente_validation'
    })
      .populate('boutique', 'name location surface price')
      .populate('user', 'firstName lastName email')
      .sort({ requestedAt: 1 }); // Les plus anciennes d'abord

    return {
      success: true,
      count: reservations.length,
      data: reservations
    };
  }

  /**
   * Annuler une réservation (temporaire ou en attente de validation)
   */
  static async cancelReservation(boutiqueId, userId, reason = null) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const boutique = await Boutique.findById(boutiqueId).session(session);

      if (!boutique) {
        throw new Error('Boutique non trouvée');
      }

      if (boutique.assignee?.toString() !== userId.toString()) {
        throw new Error('Cette réservation ne vous appartient pas');
      }

      // Libérer la boutique
      boutique.emplacementStatus = 'libre';
      boutique.assignee = null;
      boutique.reservationExpires = null;
      await boutique.save({ session });

      // Mettre à jour l'historique (temporaire ou en_attente_validation)
      const reservation = await ReservationBoutique.findOneAndUpdate(
        { boutique: boutiqueId, user: userId, status: { $in: ['temporaire', 'en_attente_validation'] } },
        {
          status: 'annulee',
          cancelledAt: new Date(),
          cancellationReason: reason || 'Annulé par l\'utilisateur'
        },
        { new: true, session }
      );

      await session.commitTransaction();

      return {
        success: true,
        message: 'Réservation annulée',
        data: { boutique, reservation }
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Libérer automatiquement les réservations expirées (Cron job)
   */
  static async releaseExpiredReservations() {
    const now = new Date();

    // Trouver les boutiques avec réservations expirées
    const expiredBoutiques = await Boutique.find({
      emplacementStatus: 'temporaire',
      reservationExpires: { $lt: now }
    });

    const results = [];

    for (const boutique of expiredBoutiques) {
      try {
        const userId = boutique.assignee;

        // Libérer la boutique
        boutique.emplacementStatus = 'libre';
        boutique.assignee = null;
        boutique.reservationExpires = null;
        await boutique.save();

        // Mettre à jour l'historique
        await ReservationBoutique.findOneAndUpdate(
          { boutique: boutique._id, user: userId, status: 'temporaire' },
          {
            status: 'expiree',
            cancellationReason: 'Réservation expirée automatiquement'
          }
        );

        results.push({
          boutiqueId: boutique._id,
          name: boutique.name,
          status: 'released'
        });
      } catch (error) {
        results.push({
          boutiqueId: boutique._id,
          name: boutique.name,
          status: 'error',
          error: error.message
        });
      }
    }

    return {
      success: true,
      message: `${results.filter(r => r.status === 'released').length} réservation(s) expirée(s) libérée(s)`,
      data: results
    };
  }

  /**
   * Obtenir les boutiques (emplacements) libres
   */
  static async getAvailableBoutiques(filters = {}) {
    // D'abord libérer les réservations expirées
    await this.releaseExpiredReservations();

    const query = { emplacementStatus: 'libre' };

    if (filters.floor !== undefined) {
      query['location.floor'] = filters.floor;
    }
    if (filters.zone) {
      query['location.zone'] = filters.zone;
    }
    if (filters.minPrice !== undefined) {
      query.price = { ...query.price, $gte: filters.minPrice };
    }
    if (filters.maxPrice !== undefined) {
      query.price = { ...query.price, $lte: filters.maxPrice };
    }
    if (filters.minSurface !== undefined) {
      query.surface = { ...query.surface, $gte: filters.minSurface };
    }

    const boutiques = await Boutique.find(query)
      .sort({ price: 1 });

    return {
      success: true,
      data: boutiques
    };
  }

  /**
   * Obtenir l'historique des réservations d'un utilisateur
   */
  static async getUserReservationHistory(userId) {
    const reservations = await ReservationBoutique.find({ user: userId })
      .populate('boutique', 'name location surface price emplacementStatus')
      .sort({ createdAt: -1 });

    return {
      success: true,
      data: reservations
    };
  }

  /**
   * Obtenir la réservation active d'un utilisateur (temporaire ou en attente)
   */
  static async getUserActiveReservation(userId) {
    const reservation = await ReservationBoutique.findOne({
      user: userId,
      status: { $in: ['temporaire', 'en_attente_validation'] }
    }).populate('boutique');

    return {
      success: true,
      data: reservation
    };
  }
}

module.exports = BoutiqueReservationService;
