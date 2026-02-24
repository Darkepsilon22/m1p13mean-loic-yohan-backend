const mongoose = require('mongoose');

/**
 * Connect to MongoDB database
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Fix userId index: ensure it is sparse (not unique) to allow multiple null values
    try {
      const boutiqueCollection = conn.connection.collection('boutiques');
      const indexes = await boutiqueCollection.indexes();
      const userIdIdx = indexes.find(i => i.name === 'userId_1');
      if (userIdIdx && userIdIdx.unique) {
        await boutiqueCollection.dropIndex('userId_1');
        console.log('Dropped old unique userId index on boutiques');
      }
    } catch (e) {
      // Index might not exist yet, ignore
    }

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed through app termination');
        process.exit(0);
      } catch (err) {
        console.error('Error closing MongoDB connection:', err);
        process.exit(1);
      }
    });

    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
