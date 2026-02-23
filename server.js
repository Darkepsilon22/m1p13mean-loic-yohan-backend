require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { connectDB } = require('./src/config');
const { startBoutiqueReservationCronJob } = require('./src/jobs/boutiqueReservationCron');
const { initSocket } = require('./src/socket');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

initSocket(server);

const startServer = async () => {
  try {
    await connectDB();

    startBoutiqueReservationCronJob();

    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
