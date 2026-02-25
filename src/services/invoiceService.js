const Invoice = require('../models/Invoice');
const Contract = require('../models/Contract');
const Boutique = require('../models/Boutique');
const User = require('../models/User');
const emailService = require('./emailService');

class InvoiceService {

  /**
   * Générer la facture mensuelle pour un contrat donné
   */
  static async generateMonthlyInvoice(contract, targetDate = new Date()) {
    const periodStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const periodEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    const dueDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), contract.billingDay);

    // Éviter les doublons
    const existing = await Invoice.findOne({
      contract: contract._id,
      periodStart,
      type: 'rent'
    });
    if (existing) return { created: false, invoice: existing };

    const invoice = new Invoice({
      contract: contract._id,
      tenant: contract.tenant,
      boutique: contract.boutique,
      amountDue: contract.monthlyRent,
      periodStart,
      periodEnd,
      dueDate,
      type: 'rent',
      status: 'pending'
    });

    await invoice.save();
    return { created: true, invoice };
  }

  /**
   * Générer les factures mensuelles pour tous les contrats actifs
   * Appelé quotidiennement par cron, ne génère que si billingDay = aujourd'hui
   */
  static async generateMonthlyInvoicesForAllContracts() {
    const today = new Date();
    const dayOfMonth = today.getDate();

    // Trouver tous les contrats actifs dont le billingDay correspond à aujourd'hui
    const contracts = await Contract.find({
      status: 'active',
      billingDay: dayOfMonth,
      startDate: { $lte: today },
      endDate: { $gte: today }
    });

    const results = { generated: 0, skipped: 0, errors: 0, details: [] };

    for (const contract of contracts) {
      try {
        const result = await this.generateMonthlyInvoice(contract, today);
        if (result.created) {
          results.generated++;
          results.details.push({ contractRef: contract.reference, invoiceRef: result.invoice.reference, invoice: result.invoice, status: 'generated' });
        } else {
          results.skipped++;
          results.details.push({ contractRef: contract.reference, status: 'already_exists' });
        }
      } catch (err) {
        results.errors++;
        results.details.push({ contractRef: contract.reference, status: 'error', error: err.message });
      }
    }

    return results;
  }

 
  static async recordPayment(invoiceId, paymentData, adminId) {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) throw new Error('Facture non trouvée');
    if (['paid', 'cancelled'].includes(invoice.status)) throw new Error('Cette facture ne peut pas recevoir de paiement');

    await invoice.recordPayment({
      amount: paymentData.amount,
      method: paymentData.method,
      reference: paymentData.reference || '',
      paidAt: new Date(),
      recordedBy: adminId,
      notes: paymentData.notes || ''
    });

    return invoice;
  }

  static async markLateInvoices() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lateInvoices = await Invoice.find({
      status: { $in: ['pending', 'partial'] },
      dueDate: { $lt: today },
      type: 'rent'
    });

    let marked = 0;
    for (const invoice of lateInvoices) {
      const wasAlreadyLate = !!invoice.lateAt;
      invoice.status = 'late';
      invoice.lateAt = invoice.lateAt || new Date();

      // Appliquer des frais de retard de 5% du montant dû
      if (invoice.lateFees === 0) {
        invoice.lateFees = Math.round(invoice.amountDue * 0.05);
      }

      await invoice.save();
      marked++;

      // Envoyer email Jour 1 seulement la première fois
      if (!wasAlreadyLate) {
        try {
          const tenant = await User.findById(invoice.tenant);
          const contract = await Contract.findById(invoice.contract);
          if (tenant && contract) {
            await emailService.sendRentLateDay1Email(tenant.email, tenant.firstName, {
              reference: contract.reference,
              amountDue: invoice.amountDue - invoice.amountPaid,
              dueDate: invoice.dueDate
            });
          }
        } catch (emailErr) {
          console.error(`[InvoiceService] Erreur envoi email retard J1 facture ${invoice.reference}:`, emailErr.message);
        }
      }
    }

    return { marked, total: lateInvoices.length };
  }

  /**
   * Marquer les factures en défaut (late depuis > 30 jours)
   */
  static async markDefaultInvoices() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const defaultInvoices = await Invoice.find({
      status: 'late',
      lateAt: { $lt: thirtyDaysAgo }
    });

    let marked = 0;
    for (const invoice of defaultInvoices) {
      invoice.status = 'default';
      invoice.defaultAt = new Date();
      await invoice.save();
      marked++;
    }

    return { marked, total: defaultInvoices.length };
  }

  /**
   * Résilier automatiquement les contrats avec factures en défaut > 60 jours
   */
  static async autoTerminateContracts() {
    const ContractService = require('./contractService');
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const defaultInvoices = await Invoice.find({
      status: 'default',
      defaultAt: { $lt: sixtyDaysAgo }
    }).distinct('contract');

    let terminated = 0;
    const details = [];

    for (const contractId of defaultInvoices) {
      try {
        const contract = await Contract.findById(contractId);
        if (contract && contract.status === 'active') {
          await ContractService.terminateContract(
            contractId,
            null,
            'Résiliation automatique - non-paiement supérieur à 60 jours'
          );
          terminated++;
          details.push({ contractId, reference: contract.reference, status: 'terminated' });
        }
      } catch (err) {
        details.push({ contractId, status: 'error', error: err.message });
      }
    }

    return { terminated, details };
  }

  /**
   * Vérifier et expirer les contrats dont la date de fin est dépassée
   */
  static async expireContracts() {
    const ReservationBoutique = require('../models/ReservationBoutique');
    const today = new Date();

    const expiredContracts = await Contract.find({
      status: 'active',
      endDate: { $lt: today }
    });

    let expired = 0;
    for (const contract of expiredContracts) {
      contract.status = 'expired';
      await contract.save();

      // Libérer la boutique
      await Boutique.findByIdAndUpdate(contract.boutique, {
        emplacementStatus: 'libre',
        assignee: null,
        userId: null,
        status: 'pending'
      });

      // Annuler les factures en attente
      await Invoice.updateMany(
        { contract: contract._id, status: { $in: ['pending', 'partial'] } },
        { status: 'cancelled', cancelledAt: new Date() }
      );

      // Annuler la réservation associée
      if (contract.reservation) {
        await ReservationBoutique.findByIdAndUpdate(contract.reservation, {
          status: 'annulee', cancelledAt: new Date(), rejectionReason: 'Contrat expiré'
        });
      } else {
        await ReservationBoutique.updateMany(
          { boutique: contract.boutique, user: contract.tenant, status: 'confirmee' },
          { status: 'annulee', cancelledAt: new Date(), rejectionReason: 'Contrat expiré' }
        );
      }

      expired++;
    }

    return { expired };
  }

  /**
   * Obtenir toutes les factures (admin) avec filtres
   */
  static async getAll(params = {}) {
    const { status, tenant, contract, type, page = 1, limit = 20 } = params;
    const query = {};

    if (status) query.status = status;
    if (tenant) query.tenant = tenant;
    if (contract) query.contract = contract;
    if (type) query.type = type;

    const total = await Invoice.countDocuments(query);
    const invoices = await Invoice.find(query)
      .populate('contract', 'reference monthlyRent status')
      .populate('tenant', 'firstName lastName email')
      .populate('boutique', 'name location')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Obtenir une facture par ID
   */
  static async getById(invoiceId) {
    const invoice = await Invoice.findById(invoiceId)
      .populate('contract', 'reference monthlyRent deposit startDate endDate status')
      .populate('tenant', 'firstName lastName email phone')
      .populate('boutique', 'name location surface');

    if (!invoice) throw new Error('Facture non trouvée');
    return invoice;
  }

  /**
   * Obtenir les factures en retard (admin)
   */
  static async getLateInvoices() {
    return Invoice.find({
      status: { $in: ['late', 'default'] }
    })
      .populate('contract', 'reference')
      .populate('tenant', 'firstName lastName email')
      .populate('boutique', 'name location')
      .sort({ dueDate: 1 });
  }

  /**
   * Obtenir les factures d'un locataire
   */
  static async getMyInvoices(tenantId, params = {}) {
    const { status, page = 1, limit = 20 } = params;
    const query = { tenant: tenantId };
    if (status) query.status = status;

    const total = await Invoice.countDocuments(query);
    const invoices = await Invoice.find(query)
      .populate('contract', 'reference monthlyRent status')
      .populate('boutique', 'name location')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return {
      invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Annuler une facture
   */
  static async cancelInvoice(invoiceId) {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) throw new Error('Facture non trouvée');
    if (invoice.status === 'paid') throw new Error('Impossible d\'annuler une facture payée');

    invoice.status = 'cancelled';
    invoice.cancelledAt = new Date();
    await invoice.save();

    return invoice;
  }

  /**
   * Envoyer rappels de loyer (5 jours avant échéance)
   * Appelé quotidiennement par cron
   */
  static async sendRentReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fiveDaysLater = new Date(today);
    fiveDaysLater.setDate(fiveDaysLater.getDate() + 5);
    const fiveDaysLaterEnd = new Date(fiveDaysLater);
    fiveDaysLaterEnd.setHours(23, 59, 59, 999);

    const invoices = await Invoice.find({
      status: { $in: ['pending', 'partial'] },
      type: 'rent',
      dueDate: { $gte: fiveDaysLater, $lte: fiveDaysLaterEnd }
    });

    let sent = 0;
    for (const invoice of invoices) {
      try {
        const tenant = await User.findById(invoice.tenant);
        const contract = await Contract.findById(invoice.contract);
        if (tenant && contract) {
          const period = `${invoice.periodStart.toLocaleDateString('fr-FR')} - ${invoice.periodEnd.toLocaleDateString('fr-FR')}`;
          await emailService.sendRentReminderEmail(tenant.email, tenant.firstName, {
            reference: contract.reference,
            amountDue: invoice.amountDue - invoice.amountPaid,
            dueDate: invoice.dueDate,
            period
          });
          sent++;
        }
      } catch (err) {
        console.error(`[InvoiceService] Erreur envoi rappel loyer facture ${invoice.reference}:`, err.message);
      }
    }

    return { sent };
  }

  /**
   * Envoyer emails de retard Jour 7 (pénalités appliquées)
   * Appelé quotidiennement par cron
   */
  static async sendDay7LateEmails() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dayStart = new Date(sevenDaysAgo);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(sevenDaysAgo);
    dayEnd.setHours(23, 59, 59, 999);

    const invoices = await Invoice.find({
      status: 'late',
      type: 'rent',
      lateAt: { $gte: dayStart, $lte: dayEnd }
    });

    let sent = 0;
    for (const invoice of invoices) {
      try {
        const tenant = await User.findById(invoice.tenant);
        const contract = await Contract.findById(invoice.contract);
        if (tenant && contract) {
          await emailService.sendRentLateDay7Email(tenant.email, tenant.firstName, {
            reference: contract.reference,
            amountDue: invoice.amountDue - invoice.amountPaid,
            lateFees: invoice.lateFees,
            totalDue: (invoice.amountDue - invoice.amountPaid) + invoice.lateFees
          });
          sent++;
        }
      } catch (err) {
        console.error(`[InvoiceService] Erreur envoi email retard J7 facture ${invoice.reference}:`, err.message);
      }
    }

    return { sent };
  }

  /**
   * Envoyer emails de retard Jour 30 (risque de résiliation)
   * Appelé quotidiennement par cron
   */
  static async sendDay30LateEmails() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dayStart = new Date(thirtyDaysAgo);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(thirtyDaysAgo);
    dayEnd.setHours(23, 59, 59, 999);

    const invoices = await Invoice.find({
      status: { $in: ['late', 'default'] },
      type: 'rent',
      lateAt: { $gte: dayStart, $lte: dayEnd }
    });

    let sent = 0;
    for (const invoice of invoices) {
      try {
        const tenant = await User.findById(invoice.tenant);
        const contract = await Contract.findById(invoice.contract);
        if (tenant && contract) {
          const totalDue = (invoice.amountDue - invoice.amountPaid) + invoice.lateFees;
          await emailService.sendRentLateDay30Email(tenant.email, tenant.firstName, {
            reference: contract.reference,
            totalDue
          });
          sent++;
        }
      } catch (err) {
        console.error(`[InvoiceService] Erreur envoi email retard J30 facture ${invoice.reference}:`, err.message);
      }
    }

    return { sent };
  }

  /**
   * Envoyer rappels d'expiration de contrat (30 jours avant fin)
   * Appelé quotidiennement par cron
   */
  static async sendContractExpirationReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const dayEnd = new Date(thirtyDaysLater);
    dayEnd.setHours(23, 59, 59, 999);

    const contracts = await Contract.find({
      status: 'active',
      endDate: { $gte: thirtyDaysLater, $lte: dayEnd }
    });

    let sent = 0;
    for (const contract of contracts) {
      try {
        const tenant = await User.findById(contract.tenant);
        const boutique = await Boutique.findById(contract.boutique);
        if (tenant && boutique) {
          const boutiqueLocation = `Étage ${boutique.location?.floor || 0}, Zone ${boutique.location?.zone || '?'}, N°${boutique.location?.number || '?'}`;
          await emailService.sendContractExpiringEmail(tenant.email, tenant.firstName, {
            reference: contract.reference,
            endDate: contract.endDate,
            boutiqueLocation
          });
          sent++;
        }
      } catch (err) {
        console.error(`[InvoiceService] Erreur envoi rappel expiration contrat ${contract.reference}:`, err.message);
      }
    }

    return { sent };
  }

  /**
   * Statistiques des factures pour le dashboard
   */
  static async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalPaidThisMonth,
      totalPendingAmount,
      lateCount,
      defaultCount
    ] = await Promise.all([
      Invoice.aggregate([
        { $match: { status: 'paid', type: 'rent', paidInFullAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } }
      ]),
      Invoice.aggregate([
        { $match: { status: { $in: ['pending', 'partial', 'late'] }, type: 'rent' } },
        { $group: { _id: null, total: { $sum: { $subtract: ['$amountDue', '$amountPaid'] } } } }
      ]),
      Invoice.countDocuments({ status: 'late' }),
      Invoice.countDocuments({ status: 'default' })
    ]);

    return {
      paidThisMonth: totalPaidThisMonth[0]?.total || 0,
      pendingAmount: totalPendingAmount[0]?.total || 0,
      lateCount,
      defaultCount
    };
  }
}

module.exports = InvoiceService;
