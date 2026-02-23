/**
 * Custom error class for API errors
 */
class ApiError extends Error {
  constructor(statusCode, message, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle MongoDB CastError (invalid ObjectId)
 */
const handleCastError = (err) => {
  const message = `${err.path} invalide : ${err.value}`;
  return new ApiError(400, message);
};

/**
 * Handle MongoDB Duplicate Key Error
 */
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const message = `${field} existe déjà. Veuillez utiliser une autre valeur.`;
  return new ApiError(400, message);
};

/**
 * Handle Mongoose Validation Error
 */
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Données invalides : ${errors.join('. ')}`;
  return new ApiError(400, message);
};

/**
 * Handle JWT Error
 */
const handleJWTError = () => {
  return new ApiError(401, 'Token invalide. Veuillez vous reconnecter.');
};

/**
 * Handle JWT Expired Error
 */
const handleJWTExpiredError = () => {
  return new ApiError(401, 'Votre session a expiré. Veuillez vous reconnecter.');
};

/**
 * Send error response in development mode
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    message: err.message,
    error: err,
    stack: err.stack
  });
};

/**
 * Send error response in production mode
 */
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message
    });
  } else {
    // Programming or other unknown error: don't leak error details
    console.error('ERROR:', err);
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'Une erreur s\'est produite. Veuillez réessayer plus tard.'
    });
  }
};

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (err.name === 'CastError') error = handleCastError(err);
    if (err.code === 11000) error = handleDuplicateKeyError(err);
    if (err.name === 'ValidationError') error = handleValidationError(err);
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

/**
 * Handle 404 Not Found
 */
const notFound = (req, res, next) => {
  const error = new ApiError(404, `Route ${req.originalUrl} introuvable`);
  next(error);
};

/**
 * Async handler wrapper to catch async errors
 * Eliminates the need for try-catch in every controller
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  ApiError,
  errorHandler,
  notFound,
  asyncHandler
};
