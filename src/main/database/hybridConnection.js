// const { DatabaseConnection } = require('./connection')
const NeDBConnection = require('./nedbConnection')
const LocalAppUsageService = require('./localAppUsageService')
const LocalCategoriesService = require('./localCategoriesService')

class HybridConnection {
  constructor() {
    // this.mongoConnection = new DatabaseConnection()
    this.nedbConnection = new NeDBConnection()
    this.currentConnection = null
    this.appUsageService = null
    this.categoriesService = null
    this.connectionMode = 'nedb' // 'mongodb', 'nedb', 'hybrid' - simplified to nedb only
    this.isOnline = false
    this.lastConnectionAttempt = null
    this.connectionCheckInterval = null
  }

  async connect() {
    console.log('🔄 Initializing NeDB database connection...')

    try {
      // Initialize NeDB (local storage only)
      await this.nedbConnection.connect()
      this.currentConnection = this.nedbConnection
      this.connectionMode = 'nedb'

      // Initialize services with NeDB
      this.appUsageService = new LocalAppUsageService(this.nedbConnection)
      this.categoriesService = new LocalCategoriesService(this.nedbConnection)

      console.log('✅ NeDB (local) storage initialized')

      // TODO: MongoDB integration can be added later if needed
      // await this.attemptMongoConnection()
      // this.startConnectionMonitoring()

      return true
    } catch (error) {
      console.error('Failed to initialize NeDB connection:', error.message)
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

  // NeDB is now the primary and only connection method
  // async switchToNeDB() {
  //   this.currentConnection = this.nedbConnection
  //   this.connectionMode = 'nedb'
  //   this.isOnline = false
  //   this.appUsageService = new LocalAppUsageService(this.nedbConnection)
  //   this.categoriesService = new LocalCategoriesService(this.nedbConnection)
  //   console.log('✅ Switched to NeDB (offline) services')
  // }

  // MongoDB sync methods commented out for simplified architecture
  // async syncLocalToMongoDB() {
  //   try {
  //     console.log('🔄 Syncing local data to MongoDB...')
  //     const localAppUsage = await this.nedbConnection.find('appUsage', {})
  //     const localCategories = await this.nedbConnection.find('categories', {})
  //     const localMappings = await this.nedbConnection.find('customCategoryMappings', {})
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

      // Only disconnect NeDB connection
      await this.nedbConnection.disconnect()
      // await Promise.all([this.mongoConnection.disconnect(), this.nedbConnection.disconnect()])

      this.currentConnection = null
      this.appUsageService = null
      this.categoriesService = null

      console.log('✅ NeDB connection disconnected')
    } catch (error) {
      console.error('Error disconnecting NeDB connection:', error.message)
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

  isOnlineMode() {
    return this.connectionMode === 'mongodb'
  }

  isOfflineMode() {
    return this.connectionMode === 'nedb'
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
