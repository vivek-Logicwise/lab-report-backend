require('dotenv').config();
const path = require('path');

/**
 * Application configuration
 * Loads environment-specific configuration based on NODE_ENV
 */

const env = process.env.NODE_ENV || 'development';
const configFile = path.join(__dirname, `config.${env}.js`);

console.log(`[CONFIG] Loading configuration for environment: ${env}`);
console.log(`[CONFIG] Configuration file: config.${env}.js`);

let config;
try {
  config = require(configFile);
  console.log(`[CONFIG] ✓ Successfully loaded ${env} configuration`);
} catch (error) {
  console.error(`[CONFIG] ✗ Failed to load configuration file: ${configFile}`);
  console.error(`[CONFIG] Error: ${error.message}`);
  console.error(`[CONFIG] Falling back to development configuration`);
  config = require('./config.development.js');
}

// Import database module
const database = require('./database');

// Validate required configuration
function validateConfig() {
  const errors = [];

  // Validate database configuration
  if (!config.database.host) {
    errors.push('Database host is required');
  }
  if (!config.database.database) {
    errors.push('Database name is required');
  }
  if (!config.database.user) {
    errors.push('Database user is required');
  }
  if (!config.database.password) {
    errors.push('Database password is required');
  }

  if (errors.length > 0) {
    console.error('[CONFIG] ✗ Configuration validation failed:');
    errors.forEach(error => console.error(`   - ${error}`));
    throw new Error('Invalid configuration');
  }

  console.log('[CONFIG] ✓ Configuration validated successfully');
}

// Run validation
validateConfig();

module.exports = {
  ...config,
  database: {
    ...config.database,
    pool: database.pool,
    query: database.query,
    getClient: database.getClient,
    transaction: database.transaction,
    testConnection: database.testConnection,
    healthCheck: database.healthCheck,
    close: database.close
  }
};
