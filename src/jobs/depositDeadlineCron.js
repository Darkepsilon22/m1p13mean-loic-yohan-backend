const cron = require('node-cron');
const ContractService = require('../services/contractService');

/**
 * Cron job: Annulation automatique des contrats pending_activation
 * dont le délai de 7 jours est dépassé (dépôt ou premier loyer non payé)
 * Exécution: Tous les jours à 7h00
 */
function startDepositDeadlineJob() {
  cron.schedule('0 7 * * *', async () => {
    try {
      console.log('[CRON] Vérification délais dépôt/premier loyer...');
      const results = await ContractService.autoCancelExpiredPendingContracts();
      console.log(`[CRON] Contrats annulés (délai 7j dépassé): ${results.cancelled}`);
    } catch (error) {
      console.error('[CRON] Erreur vérification délais dépôt:', error.message);
    }
  });

  console.log('[CRON] Job de vérification des délais de dépôt démarré (quotidien à 07:00)');
}

module.exports = { startDepositDeadlineJob };
