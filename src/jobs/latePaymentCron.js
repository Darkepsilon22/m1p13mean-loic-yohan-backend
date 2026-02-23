const cron = require('node-cron');
const InvoiceService = require('../services/invoiceService');

/**
 * Cron job: Vérifier les paiements en retard et en défaut
 * Exécution: Tous les jours à 8h00
 * Logique:
 *  1. Marquer les factures en retard (pending/partial + dueDate passée)
 *  2. Marquer les factures en défaut (late depuis > 30 jours)
 */
function startLatePaymentJob() {
  cron.schedule('0 8 * * *', async () => {
    try {
      console.log('[CRON] Vérification des paiements en retard...');

      // 1. Marquer les factures en retard (+ email Jour 1)
      const lateResults = await InvoiceService.markLateInvoices();
      console.log(`[CRON] Factures marquées en retard: ${lateResults.marked}`);

      // 2. Marquer les factures en défaut (late > 30 jours)
      const defaultResults = await InvoiceService.markDefaultInvoices();
      console.log(`[CRON] Factures marquées en défaut: ${defaultResults.marked}`);

      // 3. Envoyer emails Jour 7 (pénalités)
      const day7Results = await InvoiceService.sendDay7LateEmails();
      console.log(`[CRON] Emails retard J7 envoyés: ${day7Results.sent}`);

      // 4. Envoyer emails Jour 30 (risque résiliation)
      const day30Results = await InvoiceService.sendDay30LateEmails();
      console.log(`[CRON] Emails retard J30 envoyés: ${day30Results.sent}`);
    } catch (error) {
      console.error('[CRON] Erreur vérification retards:', error.message);
    }
  });

  console.log('[CRON] Job de vérification des paiements en retard démarré (quotidien à 08:00)');
}

module.exports = { startLatePaymentJob };
