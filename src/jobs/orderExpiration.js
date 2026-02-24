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
      console.log(`⏰ [CRON] Checking for expired orders at ${now.toISOString()}...`);

      // Log pending orders before processing
      const pendingOrders = await Order.find({
        status: 'pending',
        paymentStatus: { $in: ['pending', 'processing'] }
      }).select('orderReference paymentStatus expiresAt').lean();

      if (pendingOrders.length > 0) {
        console.log(`📋 [CRON] Found ${pendingOrders.length} pending order(s):`);
        pendingOrders.forEach(o => {
          const expired = o.expiresAt < now ? 'EXPIRED' : `expires in ${Math.round((o.expiresAt - now) / 1000)}s`;
          console.log(`   - ${o.orderReference} (payment: ${o.paymentStatus}, ${expired})`);
        });
      }

      const expiredCount = await Order.expirePendingOrders();

      if (expiredCount > 0) {
        console.log(`✅ [CRON] Expired ${expiredCount} order(s) and restored stock`);
      } else {
        console.log('✅ [CRON] No expired orders found');
      }
    } catch (error) {
      console.error('❌ [CRON] Error expiring orders:', error.message);
      console.error(error.stack);
    }
  });

  console.log('🚀 Order expiration cron job started (runs every 1 minute - TEST MODE)');
};

module.exports = { startOrderExpirationJob };
