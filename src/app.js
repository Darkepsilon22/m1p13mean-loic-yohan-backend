const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { errorHandler, notFound } = require('./middlewares/errorHandler');

const app = express();

// CORS configuration — must be BEFORE helmet and all other middleware
const allowedOrigins = [
  'http://localhost:4200',
  'http://localhost:5000',
  process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
  origin: function(origin, callback) {
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        return callback(null, false);
      }
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition']
};

app.use(cors(corsOptions));

// Explicit preflight handling for all routes (Express 5 compatible)
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      return res.sendStatus(204);
    }
  }
  next();
});

// Security headers (helmet) — after CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));

// Body parser - Exclude Stripe webhook route from JSON parsing (needs raw body)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/stripe/webhook') {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// NoSQL injection protection (sanitize req.body and req.params only — req.query is read-only in Express 5)
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else if (typeof obj[key] === 'object') {
      sanitizeObject(obj[key]);
    }
  }
}
app.use((req, res, next) => {
  sanitizeObject(req.body);
  sanitizeObject(req.params);
  next();
});

// Rate limiting global (200 req/min par IP)
const { apiLimiter } = require('./middlewares/rateLimiter');
app.use('/api', apiLimiter);

// Health check route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API Centre Commercial - Backend is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API routes
const routes = require('./routes');
app.use('/api', routes);

// 404 handler - must be after all routes
app.use(notFound);

// Global error handler - must be last
app.use(errorHandler);

module.exports = app;
