const mongoose = require('mongoose');

/**
 * Connect to MongoDB database
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`MongoDB connecté : ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error(`Erreur de connexion MongoDB : ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB déconnecté. Tentative de reconnexion...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnecté');
    });

    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('Connexion MongoDB fermée proprement');
        process.exit(0);
      } catch (err) {
        console.error('Erreur lors de la fermeture de la connexion MongoDB :', err);
        process.exit(1);
      }
    });

    return conn;
  } catch (error) {
    console.error(`Erreur de connexion à MongoDB : ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
