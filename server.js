require('dotenv').config();
const app = require('./src/app');
const { connectDB } = require('./src/config');
const { startBoutiqueReservationCronJob } = require('./src/jobs/boutiqueReservationCron');
const { startOrderExpirationJob } = require('./src/jobs/orderExpiration');
const { startInvoiceGenerationJob } = require('./src/jobs/invoiceGenerationCron');
const { startLatePaymentJob } = require('./src/jobs/latePaymentCron');
const { startAutoTerminationJob } = require('./src/jobs/autoTerminationCron');
const { startDepositDeadlineJob } = require('./src/jobs/depositDeadlineCron');
const { startReminderJob } = require('./src/jobs/reminderCron');
const { initBranding } = require('./src/services/stripeBrandingService');

const PORT = process.env.PORT || 5000;

// Connect to database and start server
const startServer = async () => {
  try {
    await connectDB();

    startBoutiqueReservationCronJob();
    startOrderExpirationJob();
    startInvoiceGenerationJob();
    startLatePaymentJob();
    startAutoTerminationJob();
    startDepositDeadlineJob();
    startReminderJob();

    // Upload logo & icône sur Stripe (cache en mémoire)
    await initBranding();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
