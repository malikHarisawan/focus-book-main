/**
 * SQLite Database Connection
 *
 * This class implements the DatabaseAdapter interface using SQLite3, a lightweight
 * but powerful SQL database engine. SQLite provides better performance, ACID
 * compliance, and proper relational database features.
 *
 * Key Features:
 * - Local file-based relational database
 * - SQL query syntax with full relational capabilities
 * - ACID compliance and data integrity
 * - Better performance for complex queries and analytics
 * - Full-text search and advanced indexing
 *
 * Database Tables:
 * - app_usage: Application usage tracking data
 * - categories: Productivity category definitions
 * - custom_category_mappings: User-defined app categorizations
 * - focus_sessions: Focus session tracking and analytics
 * - timestamps: Detailed session timestamps
 * - focus_session_interruptions: Focus session interruption tracking
 *
 * Storage Location: {userData}/focusbook.db
 *
 * @extends DatabaseAdapter
 * @author FocusBook Team
 * @version 3.0.0
 */

const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')
const { app } = require('electron')
const DatabaseAdapter = require('./databaseAdapter')

class SQLiteConnection extends DatabaseAdapter {
  constructor() {
    super()
    this.storageType = 'sqlite'
    this.db = null
    this.dbPath = null
    this.retryCount = 0
    this.maxRetries = 3
    this.retryDelay = 1000
  }

  async connect() {
    try {
      console.log('Initializing SQLite database...')

      // Get app data directory
      const userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), 'userData')
      this.dbPath = path.join(userDataPath, 'focusbook.db')

      // Ensure directory exists
      const dbDir = path.dirname(this.dbPath)
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true })
      }

      // Connect to SQLite database
      await this.createConnection()

      // Initialize schema
      await this.initializeSchema()

      this.isConnected = true
      this.retryCount = 0

      console.log('✅ SQLite database initialized successfully at:', this.dbPath)

      // Initialize default data
      await this.initializeDefaultData()

      return true
    } catch (error) {
      console.error('Failed to initialize SQLite:', error.message)
      this.isConnected = false

      if (this.retryCount < this.maxRetries) {
        this.retryCount++
        console.log(`Retrying SQLite initialization... (${this.retryCount}/${this.maxRetries})`)
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay))
        return this.connect()
      }

      throw new Error(
        `Failed to initialize SQLite after ${this.maxRetries} attempts: ${error.message}`
      )
    }
  }

  async createConnection() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err)
        } else {
          // Enable foreign key support
          this.db.run('PRAGMA foreign_keys = ON;')
          // Enable WAL mode for better concurrency
          this.db.run('PRAGMA journal_mode = WAL;')
          // Set reasonable timeout for busy database
          this.db.run('PRAGMA busy_timeout = 30000;')
          resolve()
        }
      })
    })
  }

  async initializeSchema() {
    const schemaPath = path.join(__dirname, 'schema.sql')
    let schema = fs.readFileSync(schemaPath, 'utf8')
    
    // Remove comments
    schema = schema.replace(/--.*$/gm, '').trim()
    
    // Parse statements more carefully, considering multi-line triggers
    const statements = this.parseSchemaStatements(schema)

    for (const statement of statements) {
      try {
        if (statement.trim()) {
          await this.run(statement)
        }
      } catch (error) {
        console.warn(`Warning executing schema statement: ${error.message}`)
        console.warn(`Statement: ${statement.substring(0, 100)}...`)
      }
    }

    // Run schema migrations to add missing columns to existing databases
    await this.runSchemaMigrations()
  }
  
  parseSchemaStatements(schema) {
    const statements = []
    let current = ''
    let inTrigger = false
    let triggerDepth = 0
    
    const lines = schema.split('\n')
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      
      if (!trimmedLine) continue
      
      // Check if we're starting a trigger
      if (trimmedLine.toUpperCase().includes('CREATE TRIGGER')) {
        inTrigger = true
        triggerDepth = 0
      }
      
      current += line + '\n'
      
      // Check for BEGIN/END in triggers
      if (inTrigger) {
        if (trimmedLine.toUpperCase().includes('BEGIN')) {
          triggerDepth++
        } else if (trimmedLine.toUpperCase().includes('END')) {
          triggerDepth--
          if (triggerDepth === 0) {
            // End of trigger
            statements.push(current.trim())
            current = ''
            inTrigger = false
            continue
          }
        }
      }
      
      // Regular statement ending with semicolon
      if (!inTrigger && trimmedLine.endsWith(';')) {
        statements.push(current.trim())
        current = ''
      }
    }
    
    // Add any remaining statement
    if (current.trim()) {
      statements.push(current.trim())
    }
    
    return statements.filter(stmt => stmt.length > 0)
  }

  async runSchemaMigrations() {
    console.log('🔄 Running database schema migrations...')
    
    try {
      // Check if updated_at column exists in focus_session_interruptions table
      const interruptionsInfo = await this.all("PRAGMA table_info(focus_session_interruptions)")
      const hasUpdatedAtColumn = interruptionsInfo.some(col => col.name === 'updated_at')
      
      if (!hasUpdatedAtColumn) {
        console.log('Adding updated_at column to focus_session_interruptions table...')
        await this.run('ALTER TABLE focus_session_interruptions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP')
        
        // Create trigger for updated_at column
        await this.run(`
          CREATE TRIGGER IF NOT EXISTS update_focus_session_interruptions_updated_at 
              AFTER UPDATE ON focus_session_interruptions 
              FOR EACH ROW
              WHEN NEW.updated_at = OLD.updated_at
              BEGIN
                  UPDATE focus_session_interruptions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
              END;
        `)
        console.log('✅ Added updated_at column to focus_session_interruptions')
      }
      
      // Check if paused_at column exists in focus_sessions table
      const sessionsInfo = await this.all("PRAGMA table_info(focus_sessions)")
      const hasPausedAtColumn = sessionsInfo.some(col => col.name === 'paused_at')
      const hasPausedDurationColumn = sessionsInfo.some(col => col.name === 'paused_duration')
      
      if (!hasPausedAtColumn) {
        console.log('Adding paused_at column to focus_sessions table...')
        await this.run('ALTER TABLE focus_sessions ADD COLUMN paused_at DATETIME')
        console.log('✅ Added paused_at column to focus_sessions')
      }
      
      if (!hasPausedDurationColumn) {
        console.log('Adding paused_duration column to focus_sessions table...')
        await this.run('ALTER TABLE focus_sessions ADD COLUMN paused_duration INTEGER DEFAULT 0')
        console.log('✅ Added paused_duration column to focus_sessions')
      }
      
      console.log('✅ Schema migrations completed successfully')
    } catch (error) {
      console.warn('Schema migration warning:', error.message)
    }
  }

  async disconnect() {
    try {
      if (this.db) {
        await new Promise((resolve, reject) => {
          this.db.close((err) => {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          })
        })
        this.db = null
      }
      this.isConnected = false
      console.log('✅ SQLite database disconnected')
    } catch (error) {
      console.error('Error disconnecting SQLite:', error.message)
    }
  }

  async healthCheck() {
    try {
      if (!this.isConnected || !this.db) {
        return false
      }

      // Simple health check - count rows in categories table
      const result = await this.get('SELECT COUNT(*) as count FROM categories')
      return result !== null
    } catch (error) {
      console.error('SQLite health check failed:', error.message)
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
        console.error(`SQLite operation failed (attempt ${attempt}/${maxRetries}):`, error.message)

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
        }
      }
    }

    throw new Error(`SQLite operation failed after ${maxRetries} attempts: ${lastError.message}`)
  }

  async initializeDefaultData() {
    try {
      console.log('🔧 Initializing default categories in SQLite...')

      const result = await this.get('SELECT COUNT(*) as count FROM categories')
      
      if (result.count === 0) {
        console.log('✅ Default categories inserted via schema initialization')
      } else {
        console.log('✅ Default categories already exist in SQLite')
      }
    } catch (error) {
      console.error('Failed to initialize default data in SQLite:', error.message)
    }
  }

  async getStats() {
    try {
      const stats = await Promise.all([
        this.get('SELECT COUNT(*) as count FROM app_usage'),
        this.get('SELECT COUNT(*) as count FROM categories'),
        this.get('SELECT COUNT(*) as count FROM custom_category_mappings'),
        this.get('SELECT COUNT(*) as count FROM focus_sessions')
      ])

      return {
        storageType: 'sqlite',
        dataPath: this.dbPath,
        collections: {
          appUsage: stats[0]?.count || 0,
          categories: stats[1]?.count || 0,
          customCategoryMappings: stats[2]?.count || 0,
          focusSessions: stats[3]?.count || 0
        }
      }
    } catch (error) {
      console.error('Error getting SQLite stats:', error.message)
      return null
    }
  }

  // SQLite-specific helper methods
  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err)
        } else {
          resolve({
            lastID: this.lastID,
            changes: this.changes
          })
        }
      })
    })
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err)
        } else {
          resolve(row)
        }
      })
    })
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err)
        } else {
          resolve(rows)
        }
      })
    })
  }

  // Methods that match NeDB interface for compatibility
  async find(collection, query = {}, options = {}) {
    const transformedQuery = this.transformFieldNames(collection, query)
    const { whereClause, params } = this.buildWhereClause(transformedQuery)
    let sql = `SELECT * FROM ${this.getTableName(collection)}`
    
    if (whereClause) {
      sql += ` WHERE ${whereClause}`
    }

    if (options.sort) {
      const transformedSort = this.transformFieldNames(collection, options.sort)
      const sortClause = Object.entries(transformedSort)
        .map(([field, direction]) => `${field} ${direction === 1 ? 'ASC' : 'DESC'}`)
        .join(', ')
      sql += ` ORDER BY ${sortClause}`
    }

    if (options.limit) {
      sql += ` LIMIT ${options.limit}`
    }

    if (options.skip) {
      sql += ` OFFSET ${options.skip}`
    }

    const results = await this.all(sql, params)
    // Transform results back to NeDB format and include timestamps for appUsage
    const transformedResults = results.map(result => this.transformFieldNames(collection, result, true))
    
    if (collection === 'appUsage') {
      return await this.attachTimestamps(transformedResults)
    }
    
    return transformedResults
  }

  async findOne(collection, query) {
    const transformedQuery = this.transformFieldNames(collection, query)
    const { whereClause, params } = this.buildWhereClause(transformedQuery)
    let sql = `SELECT * FROM ${this.getTableName(collection)}`
    
    if (whereClause) {
      sql += ` WHERE ${whereClause}`
    }
    
    sql += ' LIMIT 1'

    const result = await this.get(sql, params)
    if (!result) return null
    
    const transformedResult = this.transformFieldNames(collection, result, true)
    
    if (collection === 'appUsage') {
      const resultsWithTimestamps = await this.attachTimestamps([transformedResult])
      return resultsWithTimestamps[0]
    }
    
    return transformedResult
  }

  async insert(collection, doc) {
    const tableName = this.getTableName(collection)
    const now = new Date().toISOString()
    
    // Transform field names and handle special cases
    let transformedDoc = this.transformFieldNames(collection, doc)
    
    // Handle timestamps arrays for appUsage
    let timestamps = null
    if (collection === 'appUsage' && transformedDoc.timestamps) {
      timestamps = transformedDoc.timestamps
      delete transformedDoc.timestamps
    }
    
    const docWithTimestamps = {
      ...transformedDoc,
      created_at: now,
      updated_at: now
    }

    const fields = Object.keys(docWithTimestamps)
    const placeholders = fields.map(() => '?').join(', ')
    const values = Object.values(docWithTimestamps)

    const sql = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`
    const result = await this.run(sql, values)

    const appUsageId = result.lastID

    // Insert timestamps if they exist
    if (collection === 'appUsage' && timestamps && Array.isArray(timestamps)) {
      await this.insertTimestamps(appUsageId, timestamps)
    }

    // Return result in NeDB format
    const resultDoc = {
      ...doc,
      _id: appUsageId,
      createdAt: now,
      updatedAt: now
    }

    return resultDoc
  }

  async update(collection, query, update, options = {}) {
    const tableName = this.getTableName(collection)
    const transformedQuery = this.transformFieldNames(collection, query)
    const { whereClause, params: whereParams } = this.buildWhereClause(transformedQuery)
    
    const updateFields = []
    const updateValues = []
    let timestamps = null
    
    // Handle $set operations
    if (update.$set) {
      const transformedSet = this.transformFieldNames(collection, update.$set)
      Object.entries(transformedSet).forEach(([field, value]) => {
        // Handle timestamps arrays for appUsage separately
        if (collection === 'appUsage' && field === 'timestamps') {
          timestamps = value
          return
        }
        updateFields.push(`${field} = ?`)
        updateValues.push(value)
      })
    } else {
      // Direct update
      const transformedUpdate = this.transformFieldNames(collection, update)
      Object.entries(transformedUpdate).forEach(([field, value]) => {
        if (field !== 'updated_at' && field !== 'timestamps') {
          updateFields.push(`${field} = ?`)
          updateValues.push(value)
        } else if (field === 'timestamps') {
          timestamps = value
        }
      })
    }

    // Always update the updated_at timestamp
    updateFields.push('updated_at = ?')
    updateValues.push(new Date().toISOString())

    const sql = `UPDATE ${tableName} SET ${updateFields.join(', ')} WHERE ${whereClause}`
    const result = await this.run(sql, [...updateValues, ...whereParams])

    // Handle timestamps updates for appUsage
    if (collection === 'appUsage' && timestamps && result.changes > 0) {
      // Get the app usage record ID(s) that were updated
      const updatedRecords = await this.all(`SELECT id FROM ${tableName} WHERE ${whereClause}`, whereParams)
      
      for (const record of updatedRecords) {
        // Replace existing timestamps with new ones
        await this.run('DELETE FROM timestamps WHERE app_usage_id = ?', [record.id])
        await this.insertTimestamps(record.id, timestamps)
      }
    }

    return {
      numReplaced: result.changes,
      affectedDocuments: result.changes
    }
  }

  async remove(collection, query, options = {}) {
    const tableName = this.getTableName(collection)
    const transformedQuery = this.transformFieldNames(collection, query)
    const { whereClause, params } = this.buildWhereClause(transformedQuery)
    
    let sql = `DELETE FROM ${tableName} WHERE ${whereClause}`
    
    const result = await this.run(sql, params)
    return result.changes
  }

  async count(collection, query) {
    const tableName = this.getTableName(collection)
    const transformedQuery = this.transformFieldNames(collection, query)
    const { whereClause, params } = this.buildWhereClause(transformedQuery)
    
    let sql = `SELECT COUNT(*) as count FROM ${tableName}`
    if (whereClause) {
      sql += ` WHERE ${whereClause}`
    }

    const result = await this.get(sql, params)
    return result.count
  }

  // Helper methods
  getTableName(collection) {
    const tableMap = {
      'appUsage': 'app_usage',
      'categories': 'categories',
      'customCategoryMappings': 'custom_category_mappings',
      'focusSessions': 'focus_sessions',
      'focus_session_interruptions': 'focus_session_interruptions'
    }
    return tableMap[collection] || collection
  }

  // Field mapping for NeDB to SQLite compatibility
  getFieldMap(collection) {
    const fieldMaps = {
      'appUsage': {
        'appName': 'app_name',
        'timeSpent': 'time_spent',
        '_id': 'id'
      },
      'customCategoryMappings': {
        'appIdentifier': 'app_identifier',
        'customCategory': 'custom_category',
        '_id': 'id'
      },
      'focusSessions': {
        'startTime': 'start_time',
        'endTime': 'end_time',
        'plannedDuration': 'planned_duration',
        'actualDuration': 'actual_duration',
        'pausedDuration': 'paused_duration',
        'pausedAt': 'paused_at',
        '_id': 'id'
      },
      'focus_session_interruptions': {
        'focus_session_id': 'focus_session_id',
        'app_name': 'app_name',
        '_id': 'id'
      },
      'categories': {
        '_id': 'id'
      }
    }
    return fieldMaps[collection] || { '_id': 'id' }
  }

  // Transform field names from NeDB to SQLite
  transformFieldNames(collection, obj, reverse = false) {
    if (!obj || typeof obj !== 'object') return obj
    
    const fieldMap = this.getFieldMap(collection)
    const transformed = {}
    
    Object.entries(obj).forEach(([key, value]) => {
      let newKey = key
      
      if (reverse) {
        // SQLite to NeDB (for return values)
        const reverseMap = Object.fromEntries(Object.entries(fieldMap).map(([k, v]) => [v, k]))
        newKey = reverseMap[key] || key
      } else {
        // NeDB to SQLite (for queries and inserts)
        newKey = fieldMap[key] || key
      }
      
      // Handle nested objects (like $set operations)
      if (key === '$set' && typeof value === 'object') {
        transformed[key] = this.transformFieldNames(collection, value, reverse)
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
        transformed[newKey] = this.transformFieldNames(collection, value, reverse)
      } else {
        transformed[newKey] = value
      }
    })
    
    return transformed
  }

  buildWhereClause(query) {
    if (!query || Object.keys(query).length === 0) {
      return { whereClause: '', params: [] }
    }

    const conditions = []
    const params = []

    Object.entries(query).forEach(([field, value]) => {
      if (value === null) {
        conditions.push(`${field} IS NULL`)
      } else if (typeof value === 'object' && value.$gte !== undefined) {
        conditions.push(`${field} >= ?`)
        params.push(value.$gte)
      } else if (typeof value === 'object' && value.$lte !== undefined) {
        conditions.push(`${field} <= ?`)
        params.push(value.$lte)
      } else if (typeof value === 'object' && value.$ne !== undefined) {
        conditions.push(`${field} != ?`)
        params.push(value.$ne)
      } else {
        conditions.push(`${field} = ?`)
        params.push(value)
      }
    })

    return {
      whereClause: conditions.join(' AND '),
      params
    }
  }

  // Helper methods for timestamps management
  async insertTimestamps(appUsageId, timestamps) {
    if (!timestamps || !Array.isArray(timestamps)) return
    
    for (const timestamp of timestamps) {
      try {
        await this.run(
          'INSERT INTO timestamps (app_usage_id, start_time, duration, created_at) VALUES (?, ?, ?, ?)',
          [
            appUsageId,
            this.formatDateForSQLite(timestamp.start),
            timestamp.duration || 0,
            new Date().toISOString()
          ]
        )
      } catch (error) {
        console.error('Failed to insert timestamp:', error.message)
      }
    }
  }

  async attachTimestamps(appUsageRecords) {
    if (!appUsageRecords || !Array.isArray(appUsageRecords) || appUsageRecords.length === 0) {
      return appUsageRecords
    }

    // Get all app usage IDs
    const appUsageIds = appUsageRecords.map(record => record._id).filter(id => id)
    
    if (appUsageIds.length === 0) return appUsageRecords

    // Query timestamps for all records at once
    const placeholders = appUsageIds.map(() => '?').join(', ')
    const timestampsQuery = `
      SELECT app_usage_id, start_time, duration 
      FROM timestamps 
      WHERE app_usage_id IN (${placeholders})
      ORDER BY start_time ASC
    `
    
    const allTimestamps = await this.all(timestampsQuery, appUsageIds)
    
    // Group timestamps by app_usage_id
    const timestampsByAppId = {}
    allTimestamps.forEach(ts => {
      if (!timestampsByAppId[ts.app_usage_id]) {
        timestampsByAppId[ts.app_usage_id] = []
      }
      timestampsByAppId[ts.app_usage_id].push({
        start: ts.start_time,
        duration: ts.duration
      })
    })

    // Attach timestamps to each app usage record
    return appUsageRecords.map(record => ({
      ...record,
      timestamps: timestampsByAppId[record._id] || []
    }))
  }

  formatDateForSQLite(date) {
    if (!date) return null
    
    try {
      if (typeof date === 'string') {
        return new Date(date).toISOString()
      } else if (date instanceof Date) {
        return date.toISOString()
      } else {
        return new Date(date).toISOString()
      }
    } catch (error) {
      console.warn('Invalid date format:', date)
      return new Date().toISOString()
    }
  }

  getConnection() {
    return this.db
  }
}

module.exports = SQLiteConnection