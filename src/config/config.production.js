/**
 * Production Configuration
 * This file is loaded when NODE_ENV=production
 * All values must come from environment variables for security
 */

// Validate required environment variables
const requiredEnvVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missing = requiredEnvVars.filter(varName => !process.env[varName]);

if (missing.length > 0) {
  console.error('❌ FATAL: Missing required environment variables in production:');
  missing.forEach(varName => console.error(`   - ${varName}`));
  console.error('\nPlease set these environment variables before starting the server.');
  console.error('See PRODUCTION_DEPLOYMENT.md for detailed instructions.');
  process.exit(1);
}

module.exports = {
  // Server configuration
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: 'production',
    logLevel: process.env.LOG_LEVEL || 'warn', // Less verbose in production
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*']
  },

  // PostgreSQL Configuration (Google Cloud SQL) - All from environment
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '5', 10), // Higher for production
      max: parseInt(process.env.DB_POOL_MAX || '50', 10), // Higher for production
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000', 10)
    }
  },

  // File upload configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    maxFiles: parseInt(process.env.MAX_FILES_PER_REQUEST || '10', 10),
    allowedTypes: ['application/pdf'],
    // Use /tmp for serverless/cloud environments
    tempDir: process.env.UPLOAD_TEMP_DIR || (process.env.LAMBDA_TASK_ROOT ? '/tmp/uploads' : './uploads/temp')
  },

  // Rate limiting - Stricter in production
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
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

  // Security settings for production
  security: {
    helmet: {
      contentSecurityPolicy: true,
      hsts: true,
      noSniff: true
    }
  }
};
