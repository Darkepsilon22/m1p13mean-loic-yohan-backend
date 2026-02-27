const connectDB = require('./database');
const { connectRedis, getRedis } = require('./redis');

module.exports = {
  connectDB,
  connectRedis,
  getRedis
};
