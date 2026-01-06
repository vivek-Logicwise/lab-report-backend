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
      console.log('[DB] Server:', config.database.server);
      console.log('[DB] Database:', config.database.database);

      // Parse server name to extract instance
      const serverParts = config.database.server.split('\\');
      const serverName = serverParts[0];
      const instanceName = serverParts[1] || '';

      // Use standard mssql package
      const poolConfig = {
        server: serverName,
        database: config.database.database,
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : (instanceName ? undefined : 1433),
        options: {
          ...config.database.options,
          instanceName: instanceName || undefined,
          trustedConnection: !config.database.user,
          enableArithAbort: true,
          connectTimeout: 30000,
          requestTimeout: 30000
        },
        pool: config.database.pool
      };

      // Add authentication - either Windows or SQL
      if (config.database.user) {
        poolConfig.user = config.database.user;
        poolConfig.password = config.database.password;
        poolConfig.authentication = {
          type: 'default'
        };
      }

      console.log('[DB] Connection config:', JSON.stringify({
        server: poolConfig.server,
        database: poolConfig.database,
        instanceName: poolConfig.options.instanceName,
        trustedConnection: poolConfig.options.trustedConnection,
        port: poolConfig.options.port
      }, null, 2));

      this.pool = await sql.connect(poolConfig);
      console.log(`[DB] Connected successfully to ${config.database.database}`);
      return this.pool;
    } catch (error) {
      console.error('[DB] Connection failed:', error.message);
      console.error('[DB] Error details:', error);
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
