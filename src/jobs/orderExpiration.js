const cron = require('node-cron');
const Order = require('../models/Order');

/**
 * Cron job to expire pending orders that haven't been paid within 2 minutes (TEST MODE)
 * Runs every 1 minute (TEST MODE - change to every 5 minutes in production)
 */
const startOrderExpirationJob = () => {
  // Run every 1 minute: * * * * * (TEST MODE)
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      console.log(`⏰ [CRON] Vérification des commandes expirées à ${now.toISOString()}...`);

      // Log pending orders before processing
      const pendingOrders = await Order.find({
        status: 'pending',
        paymentStatus: { $in: ['pending', 'processing'] }
      }).select('orderReference paymentStatus expiresAt').lean();

      if (pendingOrders.length > 0) {
        console.log(`📋 [CRON] ${pendingOrders.length} commande(s) en attente trouvée(s) :`);
        pendingOrders.forEach(o => {
          const expired = o.expiresAt < now ? 'EXPIRÉE' : `expire dans ${Math.round((o.expiresAt - now) / 1000)}s`;
          console.log(`   - ${o.orderReference} (paiement: ${o.paymentStatus}, ${expired})`);
        });
      }

      const expiredCount = await Order.expirePendingOrders();

      if (expiredCount > 0) {
        console.log(`✅ [CRON] ${expiredCount} commande(s) expirée(s) et stock restauré`);
      } else {
        console.log('✅ [CRON] Aucune commande expirée trouvée');
      }
    } catch (error) {
      console.error('❌ [CRON] Erreur lors de l\'expiration des commandes :', error.message);
      console.error(error.stack);
    }
  });

  console.log('🚀 Job d\'expiration des commandes démarré (s\'exécute toutes les minutes - MODE TEST)');
};

module.exports = { startOrderExpirationJob };
