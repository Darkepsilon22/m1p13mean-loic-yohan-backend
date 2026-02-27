const Boutique = require('../models/Boutique');
const ReservationBoutique = require('../models/ReservationBoutique');
const User = require('../models/User');
const mongoose = require('mongoose');
const emailService = require('./emailService');

const RESERVATION_DURATION_MINUTES = 15; // Durée de réservation temporaire

class BoutiqueReservationService {
 
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

      if (boutique.emplacementStatus === 'occupee' || boutique.emplacementStatus === 'reservee') {
        throw new Error('Cette boutique est déjà occupée ou réservée');
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

      // Confirmer la boutique - statut 'reservee' (pas occupee)
      // La boutique ne passera en 'occupee' que lorsque le contrat sera activé
      boutique.emplacementStatus = 'reservee';
      boutique.userId = reservation.user;
      boutique.reservationExpires = null;
      await boutique.save({ session });

      // Mettre à jour l'historique - confirmée par admin
      reservation.status = 'confirmee';
      reservation.confirmedAt = new Date();
      reservation.validatedBy = adminId;
      await reservation.save({ session });

      await session.commitTransaction();

      // Envoyer email de réservation approuvée (après commit)
      try {
        const tenant = await User.findById(reservation.user);
        if (tenant) {
          const boutiqueLocation = `Étage ${boutique.location?.floor || 0}, Zone ${boutique.location?.zone || '?'}, N°${boutique.location?.number || '?'}`;
          await emailService.sendReservationApprovedEmail(tenant.email, tenant.firstName, {
            boutiqueLocation,
            surface: boutique.surface,
            price: boutique.price
          });
        }
      } catch (emailErr) {
        console.error('[ReservationService] Erreur envoi email réservation approuvée:', emailErr.message);
      }

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
      .populate('boutique') // full doc for floorId/mapShape (plan link)
      .populate('user', 'firstName lastName email')
      .sort({ requestedAt: 1 }); // Les plus anciennes d'abord

    return {
      success: true,
      count: reservations.length,
      data: reservations
    };
  }

  /**
   * Annuler une réservation (temporaire, en attente de validation OU confirmée)
   * FIX CRITIQUE: Gérer aussi l'annulation des réservations confirmées (résiliation)
   * NOUVEAU FIX: Réinitialiser toutes les données utilisateur lors de la résiliation
   */
  static async cancelReservation(boutiqueId, userId, reason = null) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const boutique = await Boutique.findById(boutiqueId).session(session);

      if (!boutique) {
        throw new Error('Boutique non trouvée');
      }

      // FIX: Chercher la réservation active (temporaire, en_attente_validation OU confirmee)
      const reservation = await ReservationBoutique.findOne({
        boutique: boutiqueId,
        user: userId,
        status: { $in: ['temporaire', 'en_attente_validation', 'confirmee'] }
      }).session(session);

      if (!reservation) {
        throw new Error('Aucune réservation active trouvée');
      }

      // Vérifier que c'est bien l'utilisateur qui possède la réservation
      if (reservation.user.toString() !== userId.toString()) {
        throw new Error('Cette réservation ne vous appartient pas');
      }

      // FIX CRITIQUE: Libérer complètement la boutique ET réinitialiser les données utilisateur
      boutique.emplacementStatus = 'libre';
      boutique.assignee = null;
      boutique.userId = null;
      boutique.reservationExpires = null;
      boutique.name = undefined;
      
      // NOUVEAU: Réinitialiser toutes les données modifiables par l'utilisateur
      // On garde uniquement les données de base de l'emplacement (créées par l'admin)
      boutique.slug = undefined; // undefined (pas null) pour que sparse:true fonctionne avec l'index unique
      boutique.description = boutique.shortDescription || 'Emplacement disponible';
      boutique.shortDescription = boutique.shortDescription || 'Emplacement disponible';
      boutique.logo = null;
      boutique.coverImage = null;
      boutique.photos = [];
      
      // Réinitialiser les informations de contact
      boutique.contact = {
        phone: '',
        email: '',
        website: null,
        facebook: null,
        instagram: null
      };
      
      // Réinitialiser les horaires d'ouverture (tous fermés par défaut)
      boutique.openingHours = [
        { day: 0, open: null, close: null, isClosed: true },
        { day: 1, open: null, close: null, isClosed: true },
        { day: 2, open: null, close: null, isClosed: true },
        { day: 3, open: null, close: null, isClosed: true },
        { day: 4, open: null, close: null, isClosed: true },
        { day: 5, open: null, close: null, isClosed: true },
        { day: 6, open: null, close: null, isClosed: true }
      ];
      
      // Réinitialiser les statistiques
      boutique.rating = {
        average: null,
        count: 0
      };
      boutique.stats = {
        views: 0,
        favoritesCount: 0
      };
      
      // Remettre le statut à pending (en attente d'un nouveau locataire)
      boutique.status = 'pending';
      boutique.rejectionReason = undefined;
      
      await boutique.save({ session });

      // Mettre à jour l'historique
      reservation.status = 'annulee';
      reservation.cancelledAt = new Date();
      reservation.cancellationReason = reason || 'Annulé par l\'utilisateur';
      await reservation.save({ session });

      await session.commitTransaction();

      return {
        success: true,
        message: 'Réservation annulée et emplacement réinitialisé',
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

    if (filters.floorId) {
      query.floorId = filters.floorId;
    } else if (filters.floor !== undefined) {
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
      .populate('categoryId', 'name slug')
      .populate('zoneId', 'name')
      .populate('floorId', 'name order')
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
      data: {
        reservations
      }
    };
  }

  /**
   * Obtenir la réservation active d'un utilisateur
   * FIX CRITIQUE: Ne retourner QUE les réservations avec statut actif (pas annulee, refusee, expiree)
   */
  static async getUserActiveReservation(userId) {
    // FIX: Filtrer uniquement les statuts actifs
    const activeStatuses = ['temporaire', 'en_attente_validation', 'confirmee'];
    
    const reservation = await ReservationBoutique.findOne({
      user: userId,
      status: { $in: activeStatuses }  // ← CORRECTION: Filtrer par statuts actifs uniquement
    })
    .populate('boutique')
    .sort({ createdAt: -1 });  // La plus récente en premier

    if (!reservation) {
      return {
        success: true,
        data: null
      };
    }

    // Retourner la structure attendue par le frontend
    return {
      success: true,
      data: {
        reservation: {
          _id: reservation._id,
          status: reservation.status,
          createdAt: reservation.createdAt,
          expiresAt: reservation.expiresAt,
          requestedAt: reservation.requestedAt,
          confirmedAt: reservation.confirmedAt,
          rejectionReason: reservation.rejectionReason,
          cancellationReason: reservation.cancellationReason
        },
        boutique: reservation.boutique
      }
    };
  }
}

module.exports = BoutiqueReservationService;