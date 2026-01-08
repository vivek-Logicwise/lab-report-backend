const { Pool } = require('pg');

/**
 * PostgreSQL Database Connection Pool
 * Google Cloud SQL connection configuration
 * Instance: waseem-mvp:us-central1:waseem-mvp-test-db
 */

// Load environment variables
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || '34.55.228.77',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'BurakPrecision',
  user: process.env.DB_USER || 'vivek',
  password: process.env.DB_PASSWORD || '{-cUD3p_Z7.zPr"&',
  
  // Connection pool settings
  min: parseInt(process.env.DB_POOL_MIN) || 2,
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  
  // Connection timeout in milliseconds
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 30000,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
  
  // SSL configuration for Cloud SQL
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false,
  
  // Application name for logging
  application_name: 'BurakBackend'
};

console.log('[DB] PostgreSQL configuration loaded');
console.log('[DB] Host:', dbConfig.host);
console.log('[DB] Port:', dbConfig.port);
console.log('[DB] Database:', dbConfig.database);
console.log('[DB] User:', dbConfig.user);
console.log('[DB] Pool: min=' + dbConfig.min + ', max=' + dbConfig.max);

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
  console.error('[DB] Stack:', err.stack);
});

// Handle pool connection (only log in development)
pool.on('connect', (client) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[DB] New client connected to pool');
  }
});

// Handle pool removal (only log in development)
pool.on('remove', (client) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[DB] Client removed from pool');
  }
});

/**
 * Test database connection
 */
async function testConnection() {
  let client;
  try {
    console.log('[DB] Testing PostgreSQL connection...');
    client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        NOW() as current_time, 
        current_database() as database,
        version() as pg_version
    `);
    
    console.log('[DB] ✅ Connected successfully to PostgreSQL!');
    console.log('[DB] 📅 Server time:', result.rows[0].current_time);
    console.log('[DB] 🗄️  Database:', result.rows[0].database);
    console.log('[DB] 📦 Version:', result.rows[0].pg_version.split(' ')[0] + ' ' + result.rows[0].pg_version.split(' ')[1]);
    
    client.release();
    return true;
  } catch (error) {
    console.error('[DB] ❌ Connection failed:', error.message);
    console.error('[DB] Error code:', error.code);
    console.error('[DB] Error details:', error.stack);
    if (client) client.release();
    return false;
  }
}

/**
 * Execute a query
 */
async function query(text, params) {
  const start = Date.now();
  let client;
  
  try {
    client = await pool.connect();
    const result = await client.query(text, params);
    const duration = Date.now() - start;
    
    // Only log slow queries (> 1 second)
    if (duration > 1000) {
      console.warn('[DB] Slow query detected', { duration, rows: result.rowCount });
    }
    
    client.release();
    return result;
  } catch (error) {
    console.error('[DB] Query error:', error.message);
    console.error('[DB] Query text:', text.substring(0, 200));
    if (client) client.release();
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 */
async function getClient() {
  try {
    const client = await pool.connect();
    return client;
  } catch (error) {
    console.error('[DB] Failed to get client:', error.message);
    throw error;
  }
}

/**
 * Execute query with transaction support
 */
async function transaction(callback) {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[DB] Transaction rolled back:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close the connection pool gracefully
 */
async function close() {
  try {
    console.log('[DB] Closing connection pool...');
    await pool.end();
    console.log('[DB] Connection pool closed successfully');
  } catch (error) {
    console.error('[DB] Error closing pool:', error.message);
    throw error;
  }
}

/**
 * Check if database is connected and responsive
 */
async function healthCheck() {
  try {
    const result = await query('SELECT 1 as health');
    return result.rows[0].health === 1;
  } catch (error) {
    console.error('[DB] Health check failed:', error.message);
    return false;
  }
}

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('[DB] Received SIGINT, closing database connections...');
  await close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[DB] Received SIGTERM, closing database connections...');
  await close();
  process.exit(0);
});

module.exports = {
  pool,
  query,
  getClient,
  transaction,
  testConnection,
  healthCheck,
  close
};
