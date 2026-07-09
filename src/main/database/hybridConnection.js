/**
 * Hybrid Database Connection Manager
 *
 * This class manages the database architecture for FocusBook, providing a
 * unified interface to different storage backends. Currently configured for
 * SQLite-only operation but designed to support hybrid MongoDB/SQLite scenarios.
 *
 * Architecture Overview:
 * - Abstracts database operations from business logic
 * - Manages connection lifecycle and health monitoring
 * - Provides service instances for different data domains
 * - Handles error recovery and fallback strategies
 *
 * Current Configuration:
 * - Primary: SQLite (local relational database)
 * - Sync: Disabled (was MongoDB cloud sync)
 *
 * Service Providers:
 * - AppUsageService: Application usage tracking
 * - CategoriesService: Productivity category management
 * - FocusSessionService: Focus session analytics
 *
 * @author FocusBook Team
 * @version 3.0.0
 */

// const { DatabaseConnection } = require('./connection')
const SQLiteConnection = require('./sqliteConnection')
const LocalAppUsageService = require('./localAppUsageService')
const LocalCategoriesService = require('./localCategoriesService')
const LocalFocusSessionService = require('./localFocusSessionService')

class HybridConnection {
  constructor() {
    // this.mongoConnection = new DatabaseConnection()
    this.sqliteConnection = new SQLiteConnection()
    this.currentConnection = null
    this.appUsageService = null
    this.categoriesService = null
    this.focusSessionService = null
    this.connectionMode = 'sqlite' // 'mongodb', 'sqlite', 'hybrid' - simplified to sqlite only
    this.isOnline = false
    this.lastConnectionAttempt = null
    this.connectionCheckInterval = null

    // Readiness gate: resolves once the database services are constructed.
    // The main window is created before connect() completes (for fast startup),
    // so IPC data handlers await this promise instead of touching a null service.
    this.isReady = false
    this._readyResolve = null
    this._readyPromise = new Promise((resolve) => {
      this._readyResolve = resolve
    })
  }

  /**
   * Await database readiness. Resolves as soon as the connection is established
   * and the service instances exist. Safe to call any number of times and at
   * any point in the lifecycle — returns immediately once ready.
   */
  whenReady() {
    return this._readyPromise
  }

  async connect() {
    console.log('🔄 Initializing SQLite database connection...')

    try {
      // Initialize SQLite (local storage only)
      await this.sqliteConnection.connect()
      this.currentConnection = this.sqliteConnection
      this.connectionMode = 'sqlite'

      // Initialize services with SQLite
      this.appUsageService = new LocalAppUsageService(this.sqliteConnection)
      this.categoriesService = new LocalCategoriesService(this.sqliteConnection)
      this.focusSessionService = new LocalFocusSessionService(this.sqliteConnection)

      // Load any existing active session
      await this.focusSessionService.loadCurrentSession()

      console.log('✅ SQLite (local) storage initialized')

      // Signal that services are available so any waiting IPC handlers proceed.
      this.isReady = true
      if (this._readyResolve) {
        this._readyResolve()
        this._readyResolve = null
      }

      // TODO: MongoDB integration can be added later if needed
      // await this.attemptMongoConnection()
      // this.startConnectionMonitoring()

      return true
    } catch (error) {
      console.error('Failed to initialize SQLite connection:', error.message)
      throw error
    }
  }

  // MongoDB connection methods commented out for simplified architecture
  // async attemptMongoConnection() {
  //   try {
  //     console.log('🔄 Attempting MongoDB connection...')
  //     this.lastConnectionAttempt = new Date()
  //     await this.mongoConnection.connect()
  //     this.isOnline = true
  //     console.log('✅ MongoDB connection established - switching to online mode')
  //     await this.switchToMongoDB()
  //     return true
  //   } catch (error) {
  //     console.log('⚠️ MongoDB connection failed, continuing with local storage:', error.message)
  //     this.isOnline = false
  //     return false
  //   }
  // }

  // MongoDB switching methods commented out for simplified architecture
  // async switchToMongoDB() {
  //   try {
  //     this.currentConnection = this.mongoConnection
  //     this.connectionMode = 'mongodb'
  //     const AppUsageService = require('./appUsageService')
  //     const CategoriesService = require('./categoriesService')
  //     this.appUsageService = AppUsageService
  //     this.categoriesService = CategoriesService
  //     console.log('✅ Switched to MongoDB services')
  //     await this.syncLocalToMongoDB()
  //   } catch (error) {
  //     console.error('Failed to switch to MongoDB:', error.message)
  //     await this.switchToNeDB()
  //   }
  // }

  // SQLite is now the primary and only connection method
  // async switchToSQLite() {
  //   this.currentConnection = this.sqliteConnection
  //   this.connectionMode = 'sqlite'
  //   this.isOnline = false
  //   this.appUsageService = new LocalAppUsageService(this.sqliteConnection)
  //   this.categoriesService = new LocalCategoriesService(this.sqliteConnection)
  //   console.log('✅ Switched to SQLite (offline) services')
  // }

  // MongoDB sync methods commented out for simplified architecture
  // async syncLocalToMongoDB() {
  //   try {
  //     console.log('🔄 Syncing local data to MongoDB...')
  //     const localAppUsage = await this.sqliteConnection.find('appUsage', {})
  //     const localCategories = await this.sqliteConnection.find('categories', {})
  //     const localMappings = await this.sqliteConnection.find('customCategoryMappings', {})
  //     // ... sync logic can be restored later if needed
  //     console.log('✅ Local data synced to MongoDB successfully')
  //   } catch (error) {
  //     console.error('Failed to sync local data to MongoDB:', error.message)
  //   }
  // }

  // Connection monitoring commented out for simplified architecture
  // startConnectionMonitoring() {
  //   // Check connection every 30 seconds
  //   this.connectionCheckInterval = setInterval(async () => {
  //     await this.checkAndUpdateConnection()
  //   }, 30000)
  // }

  // Connection checking commented out for simplified architecture
  // async checkAndUpdateConnection() {
  //   try {
  //     // MongoDB connection checking logic
  //     // Can be restored later if needed
  //   } catch (error) {
  //     console.error('Error during connection check:', error.message)
  //   }
  // }

  async disconnect() {
    try {
      if (this.connectionCheckInterval) {
        clearInterval(this.connectionCheckInterval)
        this.connectionCheckInterval = null
      }

      // Only disconnect SQLite connection
      await this.sqliteConnection.disconnect()
      // await Promise.all([this.mongoConnection.disconnect(), this.sqliteConnection.disconnect()])

      this.currentConnection = null
      this.appUsageService = null
      this.categoriesService = null
      this.focusSessionService = null

      console.log('✅ SQLite connection disconnected')
    } catch (error) {
      console.error('Error disconnecting SQLite connection:', error.message)
    }
  }

  async executeWithRetry(operation, maxRetries = 3) {
    return this.currentConnection.executeWithRetry(operation, maxRetries)
  }

  async healthCheck() {
    return this.currentConnection ? this.currentConnection.healthCheck() : false
  }

  isConnectionHealthy() {
    return this.currentConnection ? this.currentConnection.isConnectionHealthy() : false
  }

  getStorageType() {
    return this.connectionMode
  }

  getConnection() {
    return this.currentConnection
  }

  getAppUsageService() {
    return this.appUsageService
  }

  getCategoriesService() {
    return this.categoriesService
  }

  getFocusSessionService() {
    return this.focusSessionService
  }

  isOnlineMode() {
    return this.connectionMode === 'mongodb'
  }

  isOfflineMode() {
    return this.connectionMode === 'sqlite'
  }

  async getStats() {
    try {
      const stats = await this.currentConnection.getStats()
      return {
        ...stats,
        connectionMode: this.connectionMode,
        isOnline: this.isOnline,
        lastConnectionAttempt: this.lastConnectionAttempt
      }
    } catch (error) {
      console.error('Error getting hybrid connection stats:', error.message)
      return {
        connectionMode: this.connectionMode,
        isOnline: this.isOnline,
        lastConnectionAttempt: this.lastConnectionAttempt,
        error: error.message
      }
    }
  }

  // Force mode methods commented out for simplified architecture
  // async forceOfflineMode() {
  //   console.log('🔄 Forcing offline mode...')
  //   await this.switchToNeDB()
  // }

  // async forceOnlineMode() {
  //   console.log('🔄 Forcing online mode...')
  //   const connected = await this.attemptMongoConnection()
  //   if (!connected) {
  //     throw new Error('Cannot force online mode - MongoDB connection failed')
  //   }
  // }
}

const hybridConnection = new HybridConnection()

module.exports = {
  hybridConnection,
  HybridConnection
}
