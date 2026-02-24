const cron = require('node-cron');
const InvoiceService = require('../services/invoiceService');

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
    } catch (error) {
      console.error('[CRON] Erreur génération factures:', error.message);
    }
  });

  console.log('[CRON] Invoice generation job started (daily at 00:00)');
}

module.exports = { startInvoiceGenerationJob };
