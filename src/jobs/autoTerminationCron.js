const cron = require('node-cron');
const InvoiceService = require('../services/invoiceService');

/**
 * Cron job: Résiliation automatique des contrats en défaut > 60 jours
 * + Expiration des contrats dont la date de fin est dépassée
 * Exécution: Tous les jours à 9h00
 */
function startAutoTerminationJob() {
  cron.schedule('0 9 * * *', async () => {
    try {
      console.log('[CRON] Vérification résiliations automatiques...');

      const terminationResults = await InvoiceService.autoTerminateContracts();
      console.log(`[CRON] Contrats résiliés automatiquement: ${terminationResults.terminated}`);

      const expiredResults = await InvoiceService.expireContracts();
      console.log(`[CRON] Contrats expirés: ${expiredResults.expired}`);
    } catch (error) {
      console.error('[CRON] Erreur résiliation automatique:', error.message);
    }
  });

  console.log('[CRON] Job de résiliation automatique démarré (quotidien à 09:00)');
}

module.exports = { startAutoTerminationJob };
