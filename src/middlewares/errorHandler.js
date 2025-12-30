/**
 * Error Handler Middleware
 * Centralized error handling for all routes
 */

function errorHandler(err, req, res, next) {
  // Log error for debugging
  console.error('[Error Handler]', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method
  });

  // Default to 500 internal server error
  const statusCode = err.statusCode || 500;

  // Format error response
  const response = {
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

/**
 * Not Found Handler
 * Handles 404 errors for undefined routes
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
