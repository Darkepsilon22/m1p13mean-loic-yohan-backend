const cron = require('node-cron');
const InvoiceService = require('../services/invoiceService');
const { emitToUser } = require('../socket');

/**
 * Cron job: Générer les factures mensuelles de loyer
 * Exécution: Tous les jours à minuit (00:00)
 * Logique: Vérifie si le billingDay du contrat correspond au jour actuel
 */
function startInvoiceGenerationJob() {
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('[CRON] Génération des factures mensuelles...');
      const results = await InvoiceService.generateMonthlyInvoicesForAllContracts();
      console.log(`[CRON] Factures: ${results.generated} générées, ${results.skipped} existantes, ${results.errors} erreurs`);

      // Notify tenants of newly generated invoices
      for (const detail of results.details) {
        if (detail.status === 'generated' && detail.invoice) {
          emitToUser(detail.invoice.tenant.toString(), 'invoice:created', {
            invoiceId: detail.invoice._id,
            reference: detail.invoice.reference
          });
        }
      }
    } catch (error) {
      console.error('[CRON] Erreur génération factures:', error.message);
    }
  });

  console.log('[CRON] Invoice generation job started (daily at 00:00)');
}

module.exports = { startInvoiceGenerationJob };
