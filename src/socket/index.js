const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Boutique = require('../models/Boutique');

let io = null;

const initSocket = (httpServer) => {
  const corsOrigins = process.env.SOCKET_CORS_ORIGINS
    ? process.env.SOCKET_CORS_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:4200', 'http://localhost:5000'];

  if (process.env.FRONTEND_URL && !corsOrigins.includes(process.env.FRONTEND_URL)) {
    corsOrigins.push(process.env.FRONTEND_URL);
  }

  io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT, 10) || 60000,
    pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL, 10) || 25000
  });

  // Redis adapter pour multi-instance
  if (process.env.REDIS_URL) {
    try {
      const pubClient = new Redis(process.env.REDIS_URL);
      const subClient = pubClient.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
      console.log('[Socket.io] Redis adapter activé');
    } catch (err) {
      console.warn('[Socket.io] Redis adapter indisponible, fallback mémoire :', err.message);
    }
  }

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) {
        return next(new Error('Authentification requise'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user || user.status !== 'active') {
        return next(new Error('Utilisateur invalide ou inactif'));
      }

      socket.user = user.toObject();
      socket.userId = user._id.toString();

      if (user.role === 'boutique') {
        const boutique = await Boutique.findOne({ userId: user._id }).select('_id');
        if (boutique) {
          socket.user.boutiqueId = boutique._id.toString();
        }
      }

      next();
    } catch (err) {
      next(new Error('Échec de l\'authentification'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Utilisateur connecté : ${socket.userId} (${socket.user.role})`);

    socket.join(`user:${socket.userId}`);

    if (socket.user.role === 'admin') {
      socket.join('admin');
    }

    if (socket.user.role === 'boutique' && socket.user.boutiqueId) {
      socket.join(`boutique:${socket.user.boutiqueId}`);
    }

    socket.join('public');

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] Utilisateur déconnecté : ${socket.userId} (${reason})`);
    });

    socket.on('error', (err) => {
      console.error(`[Socket.io] Erreur socket pour ${socket.userId} :`, err.message);
    });
  });

  console.log('[Socket.io] Serveur initialisé');
  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io non initialisé. Appelez initSocket d\'abord.');
  }
  return io;
};

const emitToAdmin = (event, data) => {
  if (io) io.to('admin').emit(event, data);
};

const emitToUser = (userId, event, data) => {
  if (io) io.to(`user:${userId}`).emit(event, data);
};

const emitToBoutique = (boutiqueId, event, data) => {
  if (io) io.to(`boutique:${boutiqueId}`).emit(event, data);
};

const emitToPublic = (event, data) => {
  if (io) io.to('public').emit(event, data);
};

module.exports = {
  initSocket,
  getIO,
  emitToAdmin,
  emitToUser,
  emitToBoutique,
  emitToPublic
};
