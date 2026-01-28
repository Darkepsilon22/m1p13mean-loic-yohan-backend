const express = require('express');
const cors = require('cors');
const { errorHandler, notFound } = require('./middlewares/errorHandler');

const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
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
