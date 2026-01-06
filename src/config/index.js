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

// Validate required configuration
function validateConfig() {
  const errors = [];

  // Only require password if using SQL Authentication (DB_USER is set)
  if (process.env.DB_USER && !config.database.password) {
    errors.push('DB_PASSWORD is required when using SQL Authentication');
  }

  if (!config.database.server) {
    errors.push('DB_SERVER is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

validateConfig();

module.exports = config;
