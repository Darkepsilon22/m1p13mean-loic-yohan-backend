const express = require('express');
const cors = require('cors');
const { errorHandler, notFound } = require('./middlewares/errorHandler');

const app = express();

// CORS configuration
const allowedOrigins = [
  'http://localhost:4200',
  'http://localhost:5000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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
