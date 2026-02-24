const cron = require('node-cron');
const InvoiceService = require('../services/invoiceService');

/**
 * Cron job: Envoi des rappels
 * - Rappel de loyer 5 jours avant échéance
 * - Rappel d'expiration de contrat 30 jours avant fin
 * Exécution: Tous les jours à 10h00
 */
function startReminderJob() {
  cron.schedule('0 10 * * *', async () => {
    try {
      console.log('[CRON] Envoi des rappels...');

      // 1. Rappels de loyer (5 jours avant échéance)
      const rentReminders = await InvoiceService.sendRentReminders();
      console.log(`[CRON] Rappels de loyer envoyés: ${rentReminders.sent}`);

      // 2. Rappels d'expiration de contrat (30 jours avant fin)
      const expirationReminders = await InvoiceService.sendContractExpirationReminders();
      console.log(`[CRON] Rappels expiration contrat envoyés: ${expirationReminders.sent}`);
    } catch (error) {
      console.error('[CRON] Erreur envoi rappels:', error.message);
    }
  });

  console.log('[CRON] Reminder job started (daily at 10:00)');
}

module.exports = { startReminderJob };
