const Contract = require('../models/Contract');
const Invoice = require('../models/Invoice');
const Boutique = require('../models/Boutique');
const User = require('../models/User');
const ReservationBoutique = require('../models/ReservationBoutique');
const mongoose = require('mongoose');
const emailService = require('./emailService');

class ContractService {

  /**
   * Créer un contrat à partir d'une réservation validée
   */
  static async createContract(data, adminId) {
    const { boutiqueId, tenantId, reservationId, monthlyRent, deposit, startDate, endDate, billingDay, notes } = data;

    const boutique = await Boutique.findById(boutiqueId).populate('categoryId', 'name');
    if (!boutique) throw new Error('Boutique non trouvée');

    const contract = new Contract({
      boutique: boutiqueId,
      tenant: tenantId,
      reservation: reservationId || null,
      monthlyRent: monthlyRent || boutique.price || 0,
      deposit: deposit || 0,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      billingDay: billingDay || 1,
      status: 'draft',
      createdBy: adminId,
      boutiqueSnapshot: {
        location: {
          floor: boutique.location?.floor,
          zone: boutique.location?.zone,
          number: boutique.location?.number
        },
        surface: boutique.surface,
        category: boutique.categoryId?.name || 'Non catégorisé'
      },
      notes
    });

    await contract.save();

    // Email: contract.created
    try {
      const tenant = await User.findById(tenantId);
      if (tenant && tenant.email) {
        await emailService.sendContractCreatedEmail(tenant.email, tenant.firstName, {
          reference: contract.reference,
          monthlyRent: contract.monthlyRent,
          deposit: contract.deposit,
          startDate: contract.startDate,
          endDate: contract.endDate,
          boutiqueLocation: contract.boutiqueSnapshot?.location
        });
      }
    } catch (e) { console.error('Erreur email (contrat créé) :', e.message); }

    return contract;
  }

  /**
   * Envoyer le contrat pour signature au locataire
   */
  static async sendForSignature(contractId, adminId) {
    const contract = await Contract.findById(contractId);
    if (!contract) throw new Error('Contrat non trouvé');
    if (contract.status !== 'draft') throw new Error('Le contrat doit être en brouillon pour être envoyé');

    contract.status = 'pending_signature';
    await contract.save();

    return contract;
  }

  /**
   * Le locataire signe le contrat
   * -> Status passe à pending_activation
   * -> Boutique passe à reservee
   * -> Génère facture dépôt + facture 1er loyer (deadline 7 jours)
   */
  static async signContract(contractId, tenantId) {
    const contract = await Contract.findById(contractId);
    if (!contract) throw new Error('Contrat non trouvé');
    if (contract.tenant.toString() !== tenantId.toString()) throw new Error('Ce contrat ne vous appartient pas');
    if (contract.status !== 'pending_signature') throw new Error('Le contrat n\'est pas en attente de signature');

    contract.signedByTenant = true;
    contract.signedAt = new Date();
    contract.status = 'pending_activation';
    await contract.save();

    // Boutique -> reservee
    await Boutique.findByIdAndUpdate(contract.boutique, {
      emplacementStatus: 'reservee',
      assignee: contract.tenant
    });

    // Deadline: 7 jours après signature
    const deadline = new Date(contract.signedAt);
    deadline.setDate(deadline.getDate() + 7);

    // Générer facture dépôt (pending, due dans 7 jours)
    const existingDeposit = await Invoice.findOne({ contract: contract._id, type: 'deposit' });
    if (!existingDeposit) {
      const depositInvoice = new Invoice({
        contract: contract._id,
        tenant: contract.tenant,
        boutique: contract.boutique,
        amountDue: contract.deposit,
        periodStart: contract.startDate,
        periodEnd: contract.startDate,
        dueDate: deadline,
        type: 'deposit',
        status: 'pending'
      });
      await depositInvoice.save();
    }

    // Générer facture 1er loyer (pending, due dans 7 jours)
    const existingRent = await Invoice.findOne({ contract: contract._id, type: 'rent' });
    if (!existingRent) {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const rentInvoice = new Invoice({
        contract: contract._id,
        tenant: contract.tenant,
        boutique: contract.boutique,
        amountDue: contract.monthlyRent,
        periodStart,
        periodEnd,
        dueDate: deadline,
        type: 'rent',
        status: 'pending'
      });
      await rentInvoice.save();
    }

    // Email: contract.signed (avec deadline 7 jours)
    try {
      const tenant = await User.findById(contract.tenant);
      if (tenant && tenant.email) {
        await emailService.sendContractSignedEmail(tenant.email, tenant.firstName, {
          reference: contract.reference,
          deposit: contract.deposit,
          monthlyRent: contract.monthlyRent,
          deadline
        });
      }
    } catch (e) { console.error('Erreur email (contrat signé) :', e.message); }

    return contract;
  }

  /**
   * La boutique paie le dépôt de garantie (peut être partiel)
   * Synchronise aussi avec la facture deposit correspondante
   */
  static async payDeposit(contractId, tenantId, paymentData) {
    const contract = await Contract.findById(contractId);
    if (!contract) throw new Error('Contrat non trouvé');
    if (contract.tenant.toString() !== tenantId.toString()) throw new Error('Ce contrat ne vous appartient pas');
    if (!contract.signedByTenant) throw new Error('Vous devez d\'abord signer le contrat');
    if (['paid', 'confirmed'].includes(contract.depositStatus)) throw new Error('Le dépôt est déjà payé');

    const { amount, method, reference, notes } = paymentData;
    if (!amount || amount <= 0) throw new Error('Montant invalide');
    if (!method) throw new Error('Méthode de paiement requise');

    const remaining = contract.deposit - contract.depositPaid;
    if (amount > remaining) throw new Error(`Le montant dépasse le reste à payer (${remaining} Ar)`);

    contract.depositPayments.push({
      amount,
      method,
      reference: reference || '',
      paidAt: new Date(),
      notes: notes || ''
    });

    contract.depositPaid += amount;

    if (contract.depositPaid >= contract.deposit) {
      contract.depositStatus = 'paid';
      contract.depositPaidAt = new Date();
    } else {
      contract.depositStatus = 'partial';
    }

    await contract.save();

    const depositInvoice = await Invoice.findOne({ contract: contract._id, type: 'deposit' });
    if (depositInvoice && depositInvoice.status !== 'paid') {
      await depositInvoice.recordPayment({
        amount,
        method,
        reference: reference || '',
        paidAt: new Date(),
        recordedBy: tenantId,
        notes: notes || 'Paiement dépôt de garantie'
      });
    }

    // Email: paiement partiel
    if (contract.depositStatus === 'partial') {
      try {
        const tenant = await User.findById(tenantId);
        if (tenant && tenant.email) {
          const deadline = new Date(contract.signedAt);
          deadline.setDate(deadline.getDate() + 7);
          await emailService.sendDepositPartialEmail(tenant.email, tenant.firstName, {
            reference: contract.reference,
            amountPaid: contract.depositPaid,
            amountTotal: contract.deposit,
            remaining: contract.deposit - contract.depositPaid,
            deadline
          });
        }
      } catch (e) { console.error('Erreur email (dépôt partiel) :', e.message); }
    }

    return contract;
  }

  /**
   * Admin confirme/valide le dépôt + active le contrat
   * Vérifie que facture dépôt ET facture 1er loyer sont payées
   */
  static async confirmDeposit(contractId, adminId) {
    const contract = await Contract.findById(contractId);
    if (!contract) throw new Error('Contrat non trouvé');
    if (contract.status !== 'pending_activation') throw new Error('Le contrat n\'est pas en attente d\'activation');

    // Vérifier facture dépôt payée
    const depositInvoice = await Invoice.findOne({ contract: contract._id, type: 'deposit' });
    if (!depositInvoice || depositInvoice.status !== 'paid') {
      throw new Error('La facture de caution n\'est pas encore entièrement payée');
    }

    // Vérifier facture 1er loyer payée
    const rentInvoice = await Invoice.findOne({ contract: contract._id, type: 'rent' });
    if (!rentInvoice || rentInvoice.status !== 'paid') {
      throw new Error('La facture du premier loyer n\'est pas encore entièrement payée');
    }

    // Tout est payé -> confirmer et activer
    contract.depositStatus = 'confirmed';
    return this.activateContract(contract);
  }

  /**
   * Activer un contrat (dépôt + 1er loyer payés + admin confirmé)
   */
  static async activateContract(contract) {
    if (typeof contract === 'string') {
      contract = await Contract.findById(contract);
    }
    if (!contract) throw new Error('Contrat non trouvé');

    contract.status = 'active';
    await contract.save();

    // Boutique -> occupee
    await Boutique.findByIdAndUpdate(contract.boutique, {
      emplacementStatus: 'occupee',
      userId: contract.tenant,
      status: 'active'
    });

    // Email: contract.activated
    try {
      const tenant = await User.findById(contract.tenant);
      if (tenant && tenant.email) {
        await emailService.sendContractActivatedEmail(tenant.email, tenant.firstName, {
          reference: contract.reference,
          startDate: contract.startDate,
          boutiqueLocation: contract.boutiqueSnapshot?.location,
          monthlyRent: contract.monthlyRent
        });
      }
    } catch (e) { console.error('Erreur email (contrat activé) :', e.message); }

    return contract;
  }

  /**
   * Suspendre un contrat
   */
  static async suspendContract(contractId, adminId, reason) {
    const contract = await Contract.findById(contractId);
    if (!contract) throw new Error('Contrat non trouvé');
    if (contract.status !== 'active') throw new Error('Seul un contrat actif peut être suspendu');

    contract.status = 'suspended';
    contract.suspendedAt = new Date();
    contract.suspensionReason = reason || 'Suspendu par l\'administrateur';
    await contract.save();

    return contract;
  }

  /**
   * Réactiver un contrat suspendu
   */
  static async reactivateContract(contractId, adminId) {
    const contract = await Contract.findById(contractId);
    if (!contract) throw new Error('Contrat non trouvé');
    if (contract.status !== 'suspended') throw new Error('Seul un contrat suspendu peut être réactivé');

    contract.status = 'active';
    contract.suspendedAt = null;
    contract.suspensionReason = null;
    await contract.save();

    return contract;
  }

  /**
   * Résilier un contrat
   */
  static async terminateContract(contractId, adminId, reason) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const contract = await Contract.findById(contractId).session(session);
      if (!contract) throw new Error('Contrat non trouvé');
      if (['terminated', 'expired'].includes(contract.status)) throw new Error('Ce contrat est déjà terminé');

      contract.status = 'terminated';
      contract.terminatedAt = new Date();
      contract.terminationReason = reason || 'Résilié par l\'administrateur';
      contract.terminatedBy = adminId;
      await contract.save({ session });

      // Libérer la boutique et réinitialiser les données utilisateur
      const boutique = await Boutique.findById(contract.boutique).session(session);
      if (boutique) {
        boutique.emplacementStatus = 'libre';
        boutique.assignee = null;
        boutique.userId = null;
        boutique.reservationExpires = null;
        boutique.name = null;
        boutique.slug = null;
        boutique.description = null;
        boutique.shortDescription = null;
        boutique.logo = null;
        boutique.coverImage = null;
        boutique.photos = [];
        boutique.contact = { phone: '', email: '', website: null, facebook: null, instagram: null };
        boutique.openingHours = [
          { day: 0, open: null, close: null, isClosed: true },
          { day: 1, open: null, close: null, isClosed: true },
          { day: 2, open: null, close: null, isClosed: true },
          { day: 3, open: null, close: null, isClosed: true },
          { day: 4, open: null, close: null, isClosed: true },
          { day: 5, open: null, close: null, isClosed: true },
          { day: 6, open: null, close: null, isClosed: true }
        ];
        boutique.rating = { average: null, count: 0 };
        boutique.stats = { views: 0, favoritesCount: 0 };
        boutique.status = 'pending';
        boutique.rejectionReason = undefined;
        await boutique.save({ session });
      }

      // Annuler les factures en attente
      await Invoice.updateMany(
        { contract: contract._id, status: { $in: ['pending', 'partial'] } },
        { status: 'cancelled', cancelledAt: new Date() },
        { session }
      );

      if (contract.reservation) {
        await ReservationBoutique.findByIdAndUpdate(
          contract.reservation,
          { status: 'annulee', cancelledAt: new Date(), rejectionReason: reason || 'Contrat résilié' },
          { session }
        );
      } else {
        await ReservationBoutique.updateMany(
          { boutique: contract.boutique, user: contract.tenant, status: 'confirmee' },
          { status: 'annulee', cancelledAt: new Date(), rejectionReason: reason || 'Contrat résilié' },
          { session }
        );
      }

      await session.commitTransaction();

      try {
        const tenant = await User.findById(contract.tenant);
        if (tenant && tenant.email) {
          await emailService.sendContractTerminatedEmail(tenant.email, tenant.firstName, {
            reference: contract.reference,
            terminationReason: reason || 'Résilié par l\'administrateur',
            terminatedAt: contract.terminatedAt
          });
        }
      } catch (e) { console.error('Erreur email (contrat résilié) :', e.message); }

      return contract;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Auto-annuler les contrats pending_activation dont le délai de 7 jours est dépassé
   */
  static async autoCancelExpiredPendingContracts() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const expiredContracts = await Contract.find({
      status: 'pending_activation',
      signedAt: { $lt: sevenDaysAgo }
    });

    let cancelled = 0;
    const details = [];

    for (const contract of expiredContracts) {
      try {
        // Vérifier si les deux factures sont payées
        const depositInvoice = await Invoice.findOne({ contract: contract._id, type: 'deposit' });
        const rentInvoice = await Invoice.findOne({ contract: contract._id, type: 'rent' });

        const depositPaid = depositInvoice && depositInvoice.status === 'paid';
        const rentPaid = rentInvoice && rentInvoice.status === 'paid';

        // Si tout est payé, on ne résilie pas (l'admin n'a juste pas encore confirmé)
        if (depositPaid && rentPaid) continue;

        // Sinon, résilier automatiquement
        await this.terminateContract(
          contract._id,
          null,
          'Résiliation automatique - délai de 7 jours dépassé pour le paiement de la caution et/ou du premier loyer'
        );
        cancelled++;
        details.push({ contractId: contract._id, reference: contract.reference, status: 'cancelled' });
      } catch (err) {
        details.push({ contractId: contract._id, status: 'error', error: err.message });
      }
    }

    return { cancelled, details };
  }

  /**
   * Obtenir tous les contrats (admin) avec filtres
   */
  static async getAll(params = {}) {
    const { status, tenant, boutique, page = 1, limit = 20 } = params;
    const query = {};

    if (status) query.status = status;
    if (tenant) query.tenant = tenant;
    if (boutique) query.boutique = boutique;

    const total = await Contract.countDocuments(query);
    const contracts = await Contract.find(query)
      .populate('boutique', 'name location surface price emplacementStatus')
      .populate('tenant', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      contracts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Obtenir un contrat par ID
   */
  static async getById(contractId) {
    const contract = await Contract.findById(contractId)
      .populate('boutique', 'name location surface price emplacementStatus categoryId')
      .populate('tenant', 'firstName lastName email phone')
      .populate('reservation')
      .populate('createdBy', 'firstName lastName')
      .populate('terminatedBy', 'firstName lastName');

    if (!contract) throw new Error('Contrat non trouvé');

    // Récupérer les factures liées
    const invoices = await Invoice.find({ contract: contractId }).sort({ periodStart: -1 });

    return { contract, invoices };
  }

  /**
   * Obtenir le contrat actif d'un locataire
   */
  static async getMyActiveContract(tenantId) {
    const contract = await Contract.findOne({
      tenant: tenantId,
      status: { $in: ['draft', 'pending_signature', 'pending_activation', 'active', 'suspended'] }
    })
      .populate('boutique', 'name location surface price')
      .sort({ createdAt: -1 });

    return contract;
  }

  /**
   * Obtenir l'historique des contrats d'un locataire
   */
  static async getMyHistory(tenantId) {
    return Contract.find({ tenant: tenantId })
      .populate('boutique', 'name location surface price')
      .sort({ createdAt: -1 });
  }
}

module.exports = ContractService;
