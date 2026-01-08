/**
 * Development Configuration
 * This file is loaded when NODE_ENV=development (default)
 * Uses sensible defaults for local development
 */

module.exports = {
  // Server configuration
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: 'development',
    logLevel: process.env.LOG_LEVEL || 'debug', // More verbose in development
    corsOrigins: ['*'] // Allow all origins in development
  },

  // PostgreSQL Configuration (Google Cloud SQL)
  database: {
    host: process.env.DB_HOST || '34.55.228.77',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'BurakPrecision',
    user: process.env.DB_USER || 'vivek',
    password: process.env.DB_PASSWORD || '{-cUD3p_Z7.zPr"&',
    ssl: process.env.DB_SSL === 'true',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000', 10)
    }
  },

  // File upload configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    maxFiles: parseInt(process.env.MAX_FILES_PER_REQUEST || '10', 10),
    allowedTypes: ['application/pdf'],
    tempDir: process.env.UPLOAD_TEMP_DIR || './uploads/temp'
  },

  // Rate limiting - More lenient in development
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000', 10) // Higher limit for testing
  },

  // Biomarker analysis configuration
  analysis: {
    // Category weights for risk scoring
    categoryWeights: {
      'Inflammation': 1.5,
      'Metabolism': 1.5,
      'Cardiovascular': 1.3,
      'Liver Function': 1.2,
      'Kidney Function': 1.2,
      'Thyroid Function': 1.1,
      'Hormones': 1.1,
      'Vitamins/Minerals': 1.0,
      'Blood Health': 1.2,
      'Gut Health': 1.0
    },

    // Markers where lower values are worse
    lowerIsWorseMarkers: [
      'HDL', 'VITD', 'B12', 'OMEGA3',
      'FT3', 'TESTOSTERONE', 'SHANNON_INDEX'
    ],

    // Biological age adjustment factor
    biologicalAgeAdjustment: 1.5,

    // Pattern detection rules
    patterns: {
      'Chronic Inflammation': {
        markers: ['CRP', 'IL6', 'TNFA', 'FIB', 'HOMOCYSTEINE'],
        minAbnormal: 2,
        description: 'Multiple inflammatory markers elevated, indicating chronic inflammatory state'
      },
      'Metabolic Syndrome': {
        markers: ['GLU', 'HBA1C', 'INS', 'TG', 'HDL'],
        minAbnormal: 3,
        description: 'Multiple metabolic markers abnormal, indicating metabolic syndrome risk'
      },
      'Insulin Resistance': {
        markers: ['INS', 'HOMAIR', 'GLU'],
        minAbnormal: 1,
        description: 'Insulin or glucose regulation markers abnormal'
      },
      'Cardiovascular Risk': {
        markers: ['LDL', 'TG', 'APOB', 'CRP'],
        minAbnormal: 2,
        description: 'Multiple cardiovascular risk markers elevated'
      },
      'Liver Stress': {
        markers: ['ALT', 'GGT'],
        minAbnormal: 1,
        description: 'Liver enzyme markers elevated, indicating liver stress'
      },
      'Vitamin Deficiency': {
        markers: ['VITD', 'B12', 'FERR'],
        minAbnormal: 1,
        description: 'Vitamin deficiency detected, requiring supplementation'
      },
      'Thyroid Dysfunction': {
        markers: ['TSH', 'FT3', 'FT4'],
        minAbnormal: 1,
        description: 'Thyroid hormone markers abnormal'
      }
    }
  },

  // Security settings for development
  security: {
    helmet: {
      contentSecurityPolicy: false, // Disabled for easier development
      hsts: false,
      noSniff: true
    }
  }
};
