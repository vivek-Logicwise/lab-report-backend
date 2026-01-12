const { Semaphore } = require('async-mutex');

/**
 * Semaphore Manager
 * Manages concurrency control for different types of operations
 * Similar to C# SemaphoreSlim pattern
 * 
 * Usage:
 * const result = await semaphoreManager.executePDF(async () => {
 *   // Your resource-intensive operation here
 * });
 */

class SemaphoreManager {
  constructor() {
    // Load concurrency limits from environment or use defaults
    const pdfConcurrency = parseInt(process.env.PDF_CONCURRENCY_LIMIT) || 3;
    const dbConcurrency = parseInt(process.env.DB_CONCURRENCY_LIMIT) || 10;
    const apiConcurrency = parseInt(process.env.API_CONCURRENCY_LIMIT) || 50;

    // Create semaphores for different operation types
    this.pdfSemaphore = new Semaphore(pdfConcurrency);
    this.dbSemaphore = new Semaphore(dbConcurrency);
    this.apiSemaphore = new Semaphore(apiConcurrency);

    // Track metrics
    this.metrics = {
      pdf: { total: 0, active: 0, queued: 0, completed: 0, failed: 0 },
      db: { total: 0, active: 0, queued: 0, completed: 0, failed: 0 },
      api: { total: 0, active: 0, queued: 0, completed: 0, failed: 0 }
    };

    console.log('[Semaphore] Initialized with limits:');
    console.log(`[Semaphore] - PDF Processing: ${pdfConcurrency} concurrent operations`);
    console.log(`[Semaphore] - Database: ${dbConcurrency} concurrent operations`);
    console.log(`[Semaphore] - API: ${apiConcurrency} concurrent operations`);
  }

  /**
   * Execute operation with PDF processing semaphore
   * @param {Function} operation - Async function to execute
   * @param {string} operationId - Optional identifier for logging
   * @returns {Promise} Result of the operation
   */
  async executePDF(operation, operationId = 'PDF-OP') {
    return this._executeWithSemaphore(
      this.pdfSemaphore,
      'pdf',
      operation,
      operationId
    );
  }

  /**
   * Execute operation with database semaphore
   * @param {Function} operation - Async function to execute
   * @param {string} operationId - Optional identifier for logging
   * @returns {Promise} Result of the operation
   */
  async executeDB(operation, operationId = 'DB-OP') {
    return this._executeWithSemaphore(
      this.dbSemaphore,
      'db',
      operation,
      operationId
    );
  }

  /**
   * Execute operation with API semaphore
   * @param {Function} operation - Async function to execute
   * @param {string} operationId - Optional identifier for logging
   * @returns {Promise} Result of the operation
   */
  async executeAPI(operation, operationId = 'API-OP') {
    return this._executeWithSemaphore(
      this.apiSemaphore,
      'api',
      operation,
      operationId
    );
  }

  /**
   * Internal method to execute with semaphore control
   */
  async _executeWithSemaphore(semaphore, metricsKey, operation, operationId) {
    const startTime = Date.now();
    this.metrics[metricsKey].total++;
    this.metrics[metricsKey].queued++;

    // Acquire semaphore (wait if limit reached)
    const [value, release] = await semaphore.acquire();

    try {
      this.metrics[metricsKey].queued--;
      this.metrics[metricsKey].active++;
      
      const waitTime = Date.now() - startTime;
      if (waitTime > 100) {
        console.log(`[Semaphore] ${operationId} waited ${waitTime}ms for ${metricsKey} slot`);
      }

      // Execute the operation
      const result = await operation();
      
      this.metrics[metricsKey].completed++;
      const duration = Date.now() - startTime;
      
      if (duration > 1000) {
        console.log(`[Semaphore] ${operationId} completed in ${duration}ms`);
      }

      return result;
    } catch (error) {
      this.metrics[metricsKey].failed++;
      console.error(`[Semaphore] ${operationId} failed:`, error.message);
      throw error;
    } finally {
      this.metrics[metricsKey].active--;
      release(); // Always release the semaphore
    }
  }

  /**
   * Get current semaphore statistics
   */
  getMetrics() {
    return {
      pdf: {
        ...this.metrics.pdf,
        available: this.pdfSemaphore.getValue()
      },
      db: {
        ...this.metrics.db,
        available: this.dbSemaphore.getValue()
      },
      api: {
        ...this.metrics.api,
        available: this.apiSemaphore.getValue()
      }
    };
  }

  /**
   * Get available slots for each semaphore
   */
  getAvailableSlots() {
    return {
      pdf: this.pdfSemaphore.getValue(),
      db: this.dbSemaphore.getValue(),
      api: this.apiSemaphore.getValue()
    };
  }

  /**
   * Reset metrics (useful for testing or monitoring)
   */
  resetMetrics() {
    Object.keys(this.metrics).forEach(key => {
      this.metrics[key] = { total: 0, active: 0, queued: 0, completed: 0, failed: 0 };
    });
  }
}

// Export singleton instance
const semaphoreManager = new SemaphoreManager();
module.exports = semaphoreManager;
