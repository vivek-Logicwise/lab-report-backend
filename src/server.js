const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const dbPool = require('./config/database');
const biomarkerRoutes = require('./routes/biomarkerRoutes');
const healthRoutes = require('./routes/healthRoutes');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');

/**
 * Burak Biomarker Backend Server
 * High-performance Node.js application for PDF biomarker extraction and analysis
 * 
 * Features:
 * - Multi-file PDF upload with concurrent processing
 * - 27 VIP + 280+ secondary biomarker extraction
 * - Advanced health pattern detection and risk scoring
 * - Transactional database operations with bulk inserts
 * - Production-grade security and error handling
 */

class Server {
  constructor() {
    this.app = express();
    this.port = config.server.port;
    this.setupMiddlewares();
    this.setupRoutes();
    this.setupErrorHandlers();
  }

  /**
   * Configure Express middlewares
   */
  setupMiddlewares() {
    // Trust proxy - Required for production environments (AWS, Azure, Heroku, etc.)
    // This allows Express to trust X-Forwarded-* headers from reverse proxies
    this.app.set('trust proxy', 1);

    // Security headers
    this.app.use(helmet());

    // CORS configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Body parsers
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: {
        success: false,
        error: 'Too many requests, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use('/api/', limiter);

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Configure API routes
   */
  setupRoutes() {
    // Health check
    this.app.use('/api', healthRoutes);

    // Biomarker routes
    this.app.use('/api/biomarkers', biomarkerRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'Burak Biomarker Backend API',
        version: '1.0.0',
        endpoints: {
          health: 'GET /api/health',
          upload: 'POST /api/biomarkers/upload',
          participant: 'GET /api/biomarkers/participant/:participantCode'
        }
      });
    });
  }

  /**
   * Configure error handling
   */
  setupErrorHandlers() {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  /**
   * Start the server
   */
  async start() {
    try {
      // Test database connection
      console.log('[Server] Testing database connection...');
      const connected = await dbPool.testConnection();
      
      if (!connected) {
        throw new Error('Failed to connect to database');
      }

      // Start Express server
      this.server = this.app.listen(this.port, () => {
        console.log('='.repeat(60));
        console.log('🚀 Burak Biomarker Backend Server Started');
        console.log('='.repeat(60));
        console.log(`Environment: ${config.server.env}`);
        console.log(`Port: ${this.port}`);
        console.log(`Database: ${config.database.database}@${config.database.host}:${config.database.port}`);
        console.log(`Max file size: ${config.upload.maxFileSize} bytes`);
        console.log(`Max files per request: ${config.upload.maxFiles}`);
        console.log('='.repeat(60));
        console.log(`API Documentation:`);
        console.log(`  Health Check: http://localhost:${this.port}/api/health`);
        console.log(`  Upload PDFs:  http://localhost:${this.port}/api/biomarkers/upload`);
        console.log('='.repeat(60));
      });

      // Setup graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('[Server] Failed to start:', error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown handler
   * Ensures all connections are closed properly
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);

      // Stop accepting new connections
      if (this.server) {
        this.server.close(() => {
          console.log('[Server] HTTP server closed');
        });
      }

      // Close database connections
      try {
        await dbPool.close();
        console.log('[Server] Database connections closed');
      } catch (error) {
        console.error('[Server] Error closing database:', error);
      }

      console.log('[Server] Shutdown complete');
      process.exit(0);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('[Server] Uncaught Exception:', error);
      shutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('UNHANDLED_REJECTION');
    });
  }
}

// Start server if this file is run directly (traditional deployment)
if (require.main === module) {
  const server = new Server();
  server.start();
}

// Export for serverless deployment (Lambda, etc.)
// Create and export the Express app instance
const serverInstance = new Server();
module.exports = serverInstance.app;
module.exports.Server = Server;
