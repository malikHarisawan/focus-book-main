/**
 * Database Adapter - Abstract Base Class
 *
 * This abstract class defines the interface for different database implementations
 * in the FocusBook application. It provides a common contract that all database
 * adapters must implement.
 *
 * Key Features:
 * - Unified API for different database backends
 * - Connection state management
 * - Health check capabilities
 * - Error handling and retry logic
 *
 * Current Implementation: SQLiteConnection (local relational database)
 * Future Possibilities: MongoDB, PostgreSQL, etc.
 *
 * @abstract
 * @author FocusBook Team
 * @version 3.0.0
 */

class DatabaseAdapter {
  constructor() {
    this.isConnected = false
    this.storageType = null // 'sqlite', 'mongodb', etc.
  }

  /**
   * Connect to the database
   * @returns {Promise<boolean>} Connection success status
   */
  async connect() {
    throw new Error('connect() method must be implemented')
  }

  /**
   * Disconnect from the database
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('disconnect() method must be implemented')
  }

  /**
   * Check if connection is healthy
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    throw new Error('healthCheck() method must be implemented')
  }

  /**
   * Execute operation with retry logic
   * @param {Function} operation - The operation to execute
   * @param {number} maxRetries - Maximum retry attempts
   * @returns {Promise<any>}
   */
  async executeWithRetry(operation, maxRetries = 3) {
    throw new Error('executeWithRetry() method must be implemented')
  }

  /**
   * Get connection status
   * @returns {boolean}
   */
  isConnectionHealthy() {
    return this.isConnected
  }

  /**
   * Get storage type
   * @returns {string}
   */
  getStorageType() {
    return this.storageType
  }

  /**
   * Initialize default data (categories, etc.)
   * @returns {Promise<void>}
   */
  async initializeDefaultData() {
    throw new Error('initializeDefaultData() method must be implemented')
  }

  /**
   * Get database statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    throw new Error('getStats() method must be implemented')
  }
}

module.exports = DatabaseAdapter
