// Background sync service commented out for simplified architecture
// const syncService = require('./syncService')
// const { app } = require('electron')

class BackgroundSyncService {
  constructor() {
    // Sync functionality disabled for simplified architecture
    this.syncInterval = null
    this.syncIntervalMs = 5 * 60 * 1000 // 5 minutes
    this.isRunning = false
    this.lastSyncAttempt = null
    this.lastSuccessfulSync = null
    this.syncQueue = []
    this.maxRetries = 3
    this.retryDelay = 30000 // 30 seconds
    this.networkStatusListeners = []
  }

  start() {
    // Background sync disabled for simplified architecture
    console.log('ℹ️ Background sync service disabled (simplified architecture)')
    return

    // if (this.isRunning) {
    //   console.log('⚠️ Background sync service already running')
    //   return
    // }

    // console.log('🔄 Starting background sync service...')
    // this.isRunning = true

    // // Start periodic sync
    // this.syncInterval = setInterval(() => {
    //   this.performSync()
    // }, this.syncIntervalMs)

    // // Listen for network status changes
    // this.setupNetworkListeners()

    // // Perform initial sync
    // setTimeout(() => {
    //   this.performSync()
    // }, 10000) // Wait 10 seconds after startup

    // console.log('✅ Background sync service started')
  }

  stop() {
    // Background sync disabled for simplified architecture
    console.log('ℹ️ Background sync service stop called (simplified architecture)')
    return

    // if (!this.isRunning) {
    //   console.log('⚠️ Background sync service not running')
    //   return
    // }

    // console.log('🔄 Stopping background sync service...')
    // this.isRunning = false

    // if (this.syncInterval) {
    //   clearInterval(this.syncInterval)
    //   this.syncInterval = null
    // }

    // // Remove network listeners
    // this.removeNetworkListeners()

    // console.log('✅ Background sync service stopped')
  }

  setupNetworkListeners() {
    // Network listeners disabled for simplified architecture
    console.log('ℹ️ Network listeners disabled (simplified architecture)')
    return
    
    // // Listen for app online/offline events
    // if (app) {
    //   this.networkStatusListeners.push(
    //     app.on('online', () => {
    //       console.log('🌐 Network connection restored - triggering sync')
    //       setTimeout(() => {
    //         this.performSync()
    //       }, 5000) // Wait 5 seconds for connection to stabilize
    //     })
    //   )
    //
    //   this.networkStatusListeners.push(
    //     app.on('offline', () => {
    //       console.log('📱 Network connection lost')
    //     })
    //   )
    // }
  }

  removeNetworkListeners() {
    // Electron doesn't provide a direct way to remove specific listeners
    // This would need to be implemented if specific listener removal is needed
  }

  async performSync() {
    // Sync functionality disabled for simplified architecture
    console.log('ℹ️ performSync() disabled (simplified architecture)')
    return
    
    // if (!this.isRunning) {
    //   return
    // }
    //
    // this.lastSyncAttempt = new Date()
    //
    // try {
    //   console.log('🔄 Performing background sync...')
    //
    //   // Check if we can connect to MongoDB
    //   const canConnectToMongo = await this.checkMongoConnection()
    //
    //   if (canConnectToMongo) {
    //     // Sync NeDB data to MongoDB
    //     const success = await syncService.syncNeDBToMongo()
    //
    //     if (success) {
    //       this.lastSuccessfulSync = new Date()
    //       console.log('✅ Background sync completed successfully')
    //
    //       // Clear any queued sync operations
    //       this.syncQueue = []
    //     } else {
    //       console.log('❌ Background sync failed - adding to retry queue')
    //       this.addToSyncQueue('syncNeDBToMongo')
    //     }
    //   } else {
    //     console.log('⚠️ Cannot connect to MongoDB - sync skipped')
    //     this.addToSyncQueue('syncNeDBToMongo')
    //   }
    // } catch (error) {
    //   console.error('❌ Background sync error:', error.message)
    //   this.addToSyncQueue('syncNeDBToMongo')
    // }
  }

  async checkMongoConnection() {
    try {
      const { DatabaseConnection } = require('./connection')
      const mongoConnection = new DatabaseConnection()

      // Try to connect with a short timeout
      const connected = await mongoConnection.connect()
      if (connected) {
        const healthy = await mongoConnection.healthCheck()
        await mongoConnection.disconnect()
        return healthy
      }
      return false
    } catch (error) {
      return false
    }
  }

  addToSyncQueue(operation) {
    if (!this.syncQueue.includes(operation)) {
      this.syncQueue.push(operation)
      console.log(`📋 Added ${operation} to sync queue`)
    }
  }

  async processSyncQueue() {
    if (this.syncQueue.length === 0) {
      return
    }

    console.log(`🔄 Processing sync queue (${this.syncQueue.length} items)...`)

    const queueCopy = [...this.syncQueue]
    this.syncQueue = []

    for (const operation of queueCopy) {
      try {
        let success = false

        switch (operation) {
          case 'syncNeDBToMongo':
            success = await syncService.syncNeDBToMongo()
            break
          case 'syncMongoToNeDB':
            success = await syncService.syncMongoToNeDB()
            break
          default:
            console.log(`⚠️ Unknown sync operation: ${operation}`)
            continue
        }

        if (success) {
          console.log(`✅ Queue operation ${operation} completed successfully`)
        } else {
          console.log(`❌ Queue operation ${operation} failed - re-adding to queue`)
          this.addToSyncQueue(operation)
        }
      } catch (error) {
        console.error(`❌ Queue operation ${operation} error:`, error.message)
        this.addToSyncQueue(operation)
      }
    }
  }

  async forcePullFromMongo() {
    // Force pull functionality disabled for simplified architecture
    console.log('ℹ️ forcePullFromMongo() disabled (simplified architecture)')
    return false
    
    // try {
    //   console.log('🔄 Force pulling data from MongoDB...')
    //   const success = await syncService.syncMongoToNeDB()
    //
    //   if (success) {
    //     console.log('✅ Force pull from MongoDB completed successfully')
    //     this.lastSuccessfulSync = new Date()
    //     return true
    //   } else {
    //     console.log('❌ Force pull from MongoDB failed')
    //     return false
    //   }
    // } catch (error) {
    //   console.error('❌ Force pull from MongoDB error:', error.message)
    //   return false
    // }
  }

  async forcePushToMongo() {
    // Force push functionality disabled for simplified architecture
    console.log('ℹ️ forcePushToMongo() disabled (simplified architecture)')
    return false
    
    // try {
    //   console.log('🔄 Force pushing data to MongoDB...')
    //   const success = await syncService.syncNeDBToMongo()
    //
    //   if (success) {
    //     console.log('✅ Force push to MongoDB completed successfully')
    //     this.lastSuccessfulSync = new Date()
    //     return true
    //   } else {
    //     console.log('❌ Force push to MongoDB failed')
    //     return false
    //   }
    // } catch (error) {
    //   console.error('❌ Force push to MongoDB error:', error.message)
    //   return false
    // }
  }

  setSyncInterval(intervalMs) {
    this.syncIntervalMs = intervalMs

    if (this.isRunning && this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = setInterval(() => {
        this.performSync()
      }, this.syncIntervalMs)

      console.log(`✅ Sync interval updated to ${intervalMs}ms`)
    }
  }

  getSyncStatus() {
    // Sync status disabled for simplified architecture
    console.log('ℹ️ getSyncStatus() disabled (simplified architecture)')
    return {
      isRunning: false,
      syncIntervalMs: this.syncIntervalMs,
      lastSyncAttempt: null,
      lastSuccessfulSync: null,
      queueLength: 0,
      syncQueue: [],
      syncStats: null,
      message: 'Sync functionality disabled for simplified architecture'
    }
    
    // return {
    //   isRunning: this.isRunning,
    //   syncIntervalMs: this.syncIntervalMs,
    //   lastSyncAttempt: this.lastSyncAttempt,
    //   lastSuccessfulSync: this.lastSuccessfulSync,
    //   queueLength: this.syncQueue.length,
    //   syncQueue: [...this.syncQueue],
    //   syncStats: syncService.getSyncStats()
    // }
  }

  async exportLocalData() {
    // Export functionality disabled for simplified architecture
    console.log('ℹ️ exportLocalData() disabled (simplified architecture)')
    return null
    
    // try {
    //   console.log('🔄 Exporting local data...')
    //   const data = await syncService.exportNeDBData()
    //   console.log('✅ Local data exported successfully')
    //   return data
    // } catch (error) {
    //   console.error('❌ Export local data error:', error.message)
    //   throw error
    // }
  }

  async importLocalData(data) {
    // Import functionality disabled for simplified architecture
    console.log('ℹ️ importLocalData() disabled (simplified architecture)')
    return null
    
    // try {
    //   console.log('🔄 Importing local data...')
    //   const result = await syncService.importNeDBData(data)
    //   console.log('✅ Local data imported successfully')
    //   return result
    // } catch (error) {
    //   console.error('❌ Import local data error:', error.message)
    //   throw error
    // }
  }

  async getStorageStats() {
    // Storage stats disabled for simplified architecture
    console.log('ℹ️ getStorageStats() disabled (simplified architecture)')
    return { 
      error: 'Storage stats disabled for simplified architecture',
      message: 'Storage stats functionality disabled for simplified architecture'
    }
    
    // try {
    //   return await syncService.getStorageStats()
    // } catch (error) {
    //   console.error('❌ Get storage stats error:', error.message)
    //   return { error: error.message }
    // }
  }

  // Utility methods for debugging and monitoring
  clearSyncQueue() {
    this.syncQueue = []
    console.log('🗑️ Sync queue cleared')
  }

  async testConnections() {
    try {
      const mongoConnected = await this.checkMongoConnection()

      // Test NeDB connection
      const NeDBConnection = require('./nedbConnection')
      const nedbConnection = new NeDBConnection()
      const nedbConnected = await nedbConnection.healthCheck()

      return {
        mongodb: mongoConnected,
        nedb: nedbConnected,
        testTime: new Date()
      }
    } catch (error) {
      return {
        mongodb: false,
        nedb: false,
        error: error.message,
        testTime: new Date()
      }
    }
  }
}

const backgroundSyncService = new BackgroundSyncService()

module.exports = backgroundSyncService
