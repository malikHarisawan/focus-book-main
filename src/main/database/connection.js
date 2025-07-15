const mongoose = require('mongoose')
const { Category } = require('./models')
require('dotenv').config()

class DatabaseConnection {
  constructor() {
    this.isConnected = false
    this.retryCount = 0
    this.maxRetries = 5
    this.retryDelay = 1000
    this.reconnectInterval = null
  }

  async connect() {
    if (this.isConnected && mongoose.connection.readyState === 1) {
      return mongoose.connection
    }

    const uri = process.env.MONGODB_URI
    if (!uri) {
      throw new Error('MONGODB_URI environment variable is not set')
    }

    const options = {
      maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE) || 10,
      minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE) || 5,
      maxIdleTimeMS: parseInt(process.env.MONGODB_MAX_IDLE_TIME_MS) || 30000,
      connectTimeoutMS: parseInt(process.env.MONGODB_CONNECT_TIMEOUT_MS) || 30000,
      serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 30000,
      retryWrites: true,
      w: 'majority',
      appName: 'FocusBook'
    }

    try {
      console.log('Connecting to MongoDB Atlas with Mongoose...')

      // Set up connection event handlers before connecting
      this.setupConnectionHandlers()

      await mongoose.connect(uri, options)

      this.isConnected = true
      this.retryCount = 0

      console.log('✅ Connected to MongoDB Atlas with Mongoose successfully')

      // Initialize default data
      await this.initializeDefaultData()

      return mongoose.connection
    } catch (error) {
      console.error('Failed to connect to MongoDB Atlas:', error.message)
      this.isConnected = false

      if (this.retryCount < this.maxRetries) {
        this.retryCount++
        console.log(
          `Retrying connection in ${this.retryDelay}ms... (${this.retryCount}/${this.maxRetries})`
        )

        await new Promise((resolve) => setTimeout(resolve, this.retryDelay))
        this.retryDelay *= 2 // Exponential backoff

        return this.connect()
      }

      throw new Error(
        `Failed to connect to MongoDB after ${this.maxRetries} attempts: ${error.message}`
      )
    }
  }

  setupConnectionHandlers() {
    // Remove existing listeners to prevent duplicates
    mongoose.connection.removeAllListeners()

    mongoose.connection.on('connected', () => {
      console.log('✅ Mongoose connected to MongoDB Atlas')
      this.isConnected = true
      this.retryCount = 0
    })

    mongoose.connection.on('error', (err) => {
      console.error('❌ Mongoose connection error:', err.message)
      this.isConnected = false
    })

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ Mongoose disconnected from MongoDB Atlas')
      this.isConnected = false
    })

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 Mongoose reconnected to MongoDB Atlas')
      this.isConnected = true
      this.retryCount = 0
    })

    mongoose.connection.on('close', () => {
      console.log('🔒 Mongoose connection closed')
      this.isConnected = false
    })

    // Handle process termination
    process.on('SIGINT', async () => {
      await this.disconnect()
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      await this.disconnect()
      process.exit(0)
    })
  }

  async initializeDefaultData() {
    try {
      console.log('🔧 Initializing default categories...')

      const defaultCategories = [
        { name: 'Code', type: 'productive' },
        { name: 'Browsing', type: 'neutral' },
        { name: 'Communication', type: 'neutral' },
        { name: 'Utilities', type: 'neutral' },
        { name: 'Entertainment', type: 'distracted' },
        { name: 'Miscellaneous', type: 'neutral' }
      ]

      // Use bulkWrite for better performance
      const bulkOps = defaultCategories.map((category) => ({
        updateOne: {
          filter: { name: category.name },
          update: { $setOnInsert: category },
          upsert: true
        }
      }))

      const result = await Category.bulkWrite(bulkOps, { ordered: false })

      if (result.upsertedCount > 0) {
        console.log(`✅ Inserted ${result.upsertedCount} default categories`)
      } else {
        console.log('✅ Default categories already exist')
      }
    } catch (error) {
      console.error('Failed to initialize default data:', error.message)
    }
  }

  async executeWithRetry(operation, maxRetries = 3) {
    let lastError

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!this.isConnected || mongoose.connection.readyState !== 1) {
          await this.connect()
        }

        return await operation()
      } catch (error) {
        lastError = error
        console.error(
          `Database operation failed (attempt ${attempt}/${maxRetries}):`,
          error.message
        )

        // Reset connection on certain errors
        if (error.name === 'MongoNetworkError' || error.name === 'MongoServerSelectionError') {
          this.isConnected = false
        }

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
        }
      }
    }

    throw new Error(`Database operation failed after ${maxRetries} attempts: ${lastError.message}`)
  }

  async healthCheck() {
    try {
      if (mongoose.connection.readyState !== 1) {
        await this.connect()
      }

      // Use Mongoose's built-in ping equivalent
      await mongoose.connection.db.admin().ping()
      return true
    } catch (error) {
      console.error('Database health check failed:', error.message)
      this.isConnected = false
      return false
    }
  }

  async disconnect() {
    try {
      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval)
        this.reconnectInterval = null
      }

      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect()
        console.log('✅ Mongoose disconnected from MongoDB Atlas')
      }

      this.isConnected = false
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error.message)
    }
  }

  getConnection() {
    return mongoose.connection
  }

  isConnectionHealthy() {
    return this.isConnected && mongoose.connection.readyState === 1
  }

  // Mongoose-specific helpers
  async startTransaction() {
    const session = await mongoose.startSession()
    session.startTransaction()
    return session
  }

  async commitTransaction(session) {
    await session.commitTransaction()
    session.endSession()
  }

  async abortTransaction(session) {
    await session.abortTransaction()
    session.endSession()
  }

  // Get database statistics
  async getStats() {
    try {
      const stats = await mongoose.connection.db.stats()
      return {
        database: stats.db,
        collections: stats.collections,
        objects: stats.objects,
        avgObjSize: stats.avgObjSize,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexes: stats.indexes,
        indexSize: stats.indexSize
      }
    } catch (error) {
      console.error('Error getting database stats:', error.message)
      return null
    }
  }
}

const dbConnection = new DatabaseConnection()

module.exports = {
  dbConnection,
  DatabaseConnection,
  mongoose
}
