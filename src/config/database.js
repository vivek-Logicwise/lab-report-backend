const sqlv8 = require('msnodesqlv8');
const sql = require('mssql');
const config = require('./index');

/**
 * Database connection pool management
 * Implements connection pooling, error handling, and graceful shutdown
 */

class DatabasePool {
  constructor() {
    this.pool = null;
    this.isConnecting = false;
  }

  /**
   * Initialize database connection pool
   * Uses singleton pattern to ensure only one pool exists
   */
  async connect() {
    if (this.pool) {
      return this.pool;
    }

    if (this.isConnecting) {
      // Wait for existing connection attempt
      while (this.isConnecting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.pool;
    }

    try {
      this.isConnecting = true;
      console.log('[DB] Connecting to MSSQL database...');
      console.log('[DB] Using msnodesqlv8 driver');
      console.log('[DB] Connection string:', config.database.connectionString);

      // Use raw msnodesqlv8 wrapped in a promise
      this.pool = await new Promise((resolve, reject) => {
        sqlv8.open(config.database.connectionString, (err, conn) => {
          if (err) {
            reject(err);
          } else {
            // Wrap the raw connection to be compatible with mssql interface
            conn.request = function() {
              const self = this;
              return {
                query: function(queryText) {
                  return new Promise((resolve, reject) => {
                    self.query(queryText, (err, results) => {
                      if (err) reject(err);
                      else resolve({ recordset: results });
                    });
                  });
                }
              };
            };
            resolve(conn);
          }
        });
      });

      console.log(`[DB] Connected successfully to ${config.database.database}`);
      return this.pool;
    } catch (error) {
      console.error('[DB] Connection failed:', error.message);
      throw new Error(`Database connection failed: ${error.message}`);
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Get active connection pool
   * Automatically connects if not already connected
   */
  async getPool() {
    if (!this.pool) {
      await this.connect();
    }
    return this.pool;
  }

  /**
   * Execute query with automatic retry on connection failure
   */
  async query(queryText, params = []) {
    const pool = await this.getPool();
    try {
      const request = pool.request();

      // Bind parameters
      params.forEach((param, index) => {
        request.input(`param${index}`, param);
      });

      return await request.query(queryText);
    } catch (error) {
      console.error('[DB] Query error:', error.message);
      throw error;
    }
  }

  /**
   * Execute stored procedure
   */
  async execute(procedureName, params = {}) {
    const pool = await this.getPool();
    try {
      const request = pool.request();

      // Bind parameters
      Object.entries(params).forEach(([key, value]) => {
        request.input(key, value);
      });

      return await request.execute(procedureName);
    } catch (error) {
      console.error('[DB] Procedure execution error:', error.message);
      throw error;
    }
  }

  /**
   * Begin database transaction
   * Returns transaction object for commit/rollback
   */
  async beginTransaction() {
    const pool = await this.getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    return transaction;
  }

  /**
   * Close all database connections gracefully
   */
  async close() {
    if (this.pool) {
      try {
        console.log('[DB] Closing connection pool...');
        await this.pool.close();
        this.pool = null;
        console.log('[DB] Connection pool closed');
      } catch (error) {
        console.error('[DB] Error closing pool:', error.message);
      }
    }
  }

  /**
   * Check if database is connected and responsive
   */
  async healthCheck() {
    try {
      const pool = await this.getPool();
      await pool.request().query('SELECT 1 AS health');
      return { connected: true, message: 'Database is healthy' };
    } catch (error) {
      return { connected: false, message: error.message };
    }
  }
}

// Export singleton instance
const dbPool = new DatabasePool();

module.exports = dbPool;
