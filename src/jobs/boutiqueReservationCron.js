const cron = require('node-cron');
const BoutiqueReservationService = require('../services/boutiqueReservationService');

/**
 * Cron job pour libérer automatiquement les réservations de boutiques expirées
 * S'exécute toutes les minutes
 */
const startBoutiqueReservationCronJob = () => {
  // Exécuter toutes les minutes
  cron.schedule('* * * * *', async () => {
    try {
      const result = await BoutiqueReservationService.releaseExpiredReservations();

      if (result.data && result.data.length > 0) {
        console.log(`[CRON] ${result.message}`);
        result.data.forEach(item => {
          console.log(`  - Boutique "${item.name}" (${item.boutiqueId}): ${item.status}`);
        });
      }
    } catch (error) {
      console.error('[CRON] Erreur lors de la libération des réservations expirées:', error.message);
    }
  });

  console.log('[CRON] Job de libération des réservations de boutiques démarré (intervalle: 1 minute)');
};

module.exports = { startBoutiqueReservationCronJob };
