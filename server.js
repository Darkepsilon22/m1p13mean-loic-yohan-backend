require('dotenv').config();
const app = require('./src/app');
const { connectDB } = require('./src/config');
const { startBoutiqueReservationCronJob } = require('./src/jobs/boutiqueReservationCron');

const PORT = process.env.PORT || 5000;

// Connect to database and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start cron jobs
    startBoutiqueReservationCronJob();

    // Start Express server
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
