const Datastore = require('nedb')
const path = require('path')
const { app } = require('electron')
const fs = require('fs')
const DatabaseAdapter = require('./databaseAdapter')

class NeDBConnection extends DatabaseAdapter {
  constructor() {
    super()
    this.storageType = 'nedb'
    this.databases = {}
    this.dataPath = null
    this.retryCount = 0
    this.maxRetries = 3
    this.retryDelay = 1000
  }

  async connect() {
    try {
      console.log('Initializing NeDB local storage...')

      // Get app data directory
      this.dataPath = app ? app.getPath('userData') : path.join(process.cwd(), 'userData')
      const dbPath = path.join(this.dataPath, 'LocalData')

      // Ensure directory exists
      if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath, { recursive: true })
      }

      // Initialize databases
      this.databases = {
        appUsage: new Datastore({
          filename: path.join(dbPath, 'appUsage.db'),
          autoload: true,
          timestampData: true
        }),
        categories: new Datastore({
          filename: path.join(dbPath, 'categories.db'),
          autoload: true,
          timestampData: true
        }),
        customCategoryMappings: new Datastore({
          filename: path.join(dbPath, 'customCategoryMappings.db'),
          autoload: true,
          timestampData: true
        })
      }

      // Wait for all databases to load
      await Promise.all([
        this.waitForDatabase('appUsage'),
        this.waitForDatabase('categories'),
        this.waitForDatabase('customCategoryMappings')
      ])

      // Create indexes for better performance
      await this.createIndexes()

      this.isConnected = true
      this.retryCount = 0

      console.log('✅ NeDB local storage initialized successfully')

      // Initialize default data
      await this.initializeDefaultData()

      return true
    } catch (error) {
      console.error('Failed to initialize NeDB:', error.message)
      this.isConnected = false

      if (this.retryCount < this.maxRetries) {
        this.retryCount++
        console.log(`Retrying NeDB initialization... (${this.retryCount}/${this.maxRetries})`)
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay))
        return this.connect()
      }

      throw new Error(
        `Failed to initialize NeDB after ${this.maxRetries} attempts: ${error.message}`
      )
    }
  }

  async waitForDatabase(dbName) {
    return new Promise((resolve, reject) => {
      const db = this.databases[dbName]
      if (db.datastore && db.datastore.persistence) {
        resolve()
      } else {
        db.loadDatabase((err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      }
    })
  }

  async createIndexes() {
    const appUsageDb = this.databases.appUsage
    const categoriesDb = this.databases.categories
    const mappingsDb = this.databases.customCategoryMappings

    // Create indexes for better query performance
    await Promise.all([
      this.ensureIndex(appUsageDb, { fieldName: 'date' }),
      this.ensureIndex(appUsageDb, { fieldName: 'appName' }),
      this.ensureIndex(appUsageDb, { fieldName: 'category' }),
      this.ensureIndex(appUsageDb, { fieldName: 'hour' }),
      this.ensureIndex(appUsageDb, { fieldName: 'date,hour', unique: false }),
      this.ensureIndex(appUsageDb, { fieldName: 'date,appName', unique: false }),

      this.ensureIndex(categoriesDb, { fieldName: 'name', unique: true }),
      this.ensureIndex(categoriesDb, { fieldName: 'type' }),

      this.ensureIndex(mappingsDb, { fieldName: 'appIdentifier', unique: true })
    ])
  }

  async ensureIndex(db, options) {
    return new Promise((resolve, reject) => {
      db.ensureIndex(options, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  async disconnect() {
    try {
      // NeDB doesn't require explicit disconnection
      // Just clear the databases reference
      this.databases = {}
      this.isConnected = false
      console.log('✅ NeDB local storage disconnected')
    } catch (error) {
      console.error('Error disconnecting NeDB:', error.message)
    }
  }

  async healthCheck() {
    try {
      if (!this.isConnected || !this.databases.appUsage) {
        return false
      }

      // Simple health check - count documents in appUsage collection
      const count = await this.count('appUsage', {})
      return true
    } catch (error) {
      console.error('NeDB health check failed:', error.message)
      return false
    }
  }

  async executeWithRetry(operation, maxRetries = 3) {
    let lastError

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!this.isConnected) {
          await this.connect()
        }

        return await operation()
      } catch (error) {
        lastError = error
        console.error(`NeDB operation failed (attempt ${attempt}/${maxRetries}):`, error.message)

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
        }
      }
    }

    throw new Error(`NeDB operation failed after ${maxRetries} attempts: ${lastError.message}`)
  }

  async initializeDefaultData() {
    try {
      console.log('🔧 Initializing default categories in NeDB...')

      const defaultCategories = [
        { name: 'Code', type: 'productive' },
        { name: 'Browsing', type: 'neutral' },
        { name: 'Communication', type: 'neutral' },
        { name: 'Utilities', type: 'neutral' },
        { name: 'Entertainment', type: 'distracted' },
        { name: 'Miscellaneous', type: 'neutral' }
      ]

      let insertedCount = 0

      for (const category of defaultCategories) {
        const existing = await this.findOne('categories', { name: category.name })
        if (!existing) {
          await this.insert('categories', category)
          insertedCount++
        }
      }

      if (insertedCount > 0) {
        console.log(`✅ Inserted ${insertedCount} default categories in NeDB`)
      } else {
        console.log('✅ Default categories already exist in NeDB')
      }
    } catch (error) {
      console.error('Failed to initialize default data in NeDB:', error.message)
    }
  }

  async getStats() {
    try {
      const stats = await Promise.all([
        this.count('appUsage', {}),
        this.count('categories', {}),
        this.count('customCategoryMappings', {})
      ])

      return {
        storageType: 'nedb',
        dataPath: this.dataPath,
        collections: {
          appUsage: stats[0],
          categories: stats[1],
          customCategoryMappings: stats[2]
        }
      }
    } catch (error) {
      console.error('Error getting NeDB stats:', error.message)
      return null
    }
  }

  // NeDB-specific helper methods
  async find(collection, query = {}, options = {}) {
    return new Promise((resolve, reject) => {
      const db = this.databases[collection]
      if (!db) {
        reject(new Error(`Collection ${collection} not found`))
        return
      }

      let cursor = db.find(query)

      if (options.sort) {
        cursor = cursor.sort(options.sort)
      }

      if (options.limit) {
        cursor = cursor.limit(options.limit)
      }

      if (options.skip) {
        cursor = cursor.skip(options.skip)
      }

      cursor.exec((err, docs) => {
        if (err) {
          reject(err)
        } else {
          resolve(docs)
        }
      })
    })
  }

  async findOne(collection, query) {
    return new Promise((resolve, reject) => {
      const db = this.databases[collection]
      if (!db) {
        reject(new Error(`Collection ${collection} not found`))
        return
      }

      db.findOne(query, (err, doc) => {
        if (err) {
          reject(err)
        } else {
          resolve(doc)
        }
      })
    })
  }

  async insert(collection, doc) {
    return new Promise((resolve, reject) => {
      const db = this.databases[collection]
      if (!db) {
        reject(new Error(`Collection ${collection} not found`))
        return
      }

      // Add timestamps manually since NeDB doesn't have Mongoose-style timestamps
      const now = new Date()
      const docWithTimestamps = {
        ...doc,
        createdAt: now,
        updatedAt: now
      }

      db.insert(docWithTimestamps, (err, newDoc) => {
        if (err) {
          reject(err)
        } else {
          resolve(newDoc)
        }
      })
    })
  }

  async update(collection, query, update, options = {}) {
    return new Promise((resolve, reject) => {
      const db = this.databases[collection]
      if (!db) {
        reject(new Error(`Collection ${collection} not found`))
        return
      }

      // Add updatedAt timestamp
      const updateWithTimestamp = {
        ...update,
        $set: {
          ...update.$set,
          updatedAt: new Date()
        }
      }

      db.update(query, updateWithTimestamp, options, (err, numReplaced, affectedDocuments) => {
        if (err) {
          reject(err)
        } else {
          resolve({ numReplaced, affectedDocuments })
        }
      })
    })
  }

  async remove(collection, query, options = {}) {
    return new Promise((resolve, reject) => {
      const db = this.databases[collection]
      if (!db) {
        reject(new Error(`Collection ${collection} not found`))
        return
      }

      db.remove(query, options, (err, numRemoved) => {
        if (err) {
          reject(err)
        } else {
          resolve(numRemoved)
        }
      })
    })
  }

  async count(collection, query) {
    return new Promise((resolve, reject) => {
      const db = this.databases[collection]
      if (!db) {
        reject(new Error(`Collection ${collection} not found`))
        return
      }

      db.count(query, (err, count) => {
        if (err) {
          reject(err)
        } else {
          resolve(count)
        }
      })
    })
  }

  getConnection() {
    return this.databases
  }
}

module.exports = NeDBConnection
