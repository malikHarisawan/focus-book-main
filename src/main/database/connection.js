const { Pool } = require('pg')
const { readFileSync } = require('fs')
const { join } = require('path')
require('dotenv').config()

class DatabaseConnection {
  constructor() {
    this.pool = null
    this.isConnected = false
    this.retryCount = 0
    this.maxRetries = 5
    this.retryDelay = 1000
  }

  async connect() {
    if (this.isConnected && this.pool) {
      return this.pool
    }

    const config = {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'focusbook',
      password: process.env.DB_PASSWORD || 'password',
      port: process.env.DB_PORT || 5432,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      application_name: 'FocusBook'
    }

    try {
      this.pool = new Pool(config)

      this.pool.on('error', (err) => {
        console.error('PostgreSQL pool error:', err)
        this.isConnected = false
      })

      this.pool.on('connect', () => {
        console.log('Connected to PostgreSQL database')
        this.isConnected = true
        this.retryCount = 0
      })

      const client = await this.pool.connect()
      await client.query('SELECT NOW()')
      client.release()

      await this.initializeDatabase()

      this.isConnected = true
      return this.pool
    } catch (error) {
      console.error('Failed to connect to PostgreSQL:', error)
      this.isConnected = false

      if (this.retryCount < this.maxRetries) {
        this.retryCount++
        console.log(
          `Retrying connection in ${this.retryDelay}ms... (${this.retryCount}/${this.maxRetries})`
        )

        await new Promise((resolve) => setTimeout(resolve, this.retryDelay))
        this.retryDelay *= 2

        return this.connect()
      }

      throw new Error(
        `Failed to connect to database after ${this.maxRetries} attempts: ${error.message}`
      )
    }
  }

  async initializeDatabase() {
    try {
      const schemaPath = join(__dirname, 'schema.sql')
      const schema = readFileSync(schemaPath, 'utf8')

      const client = await this.pool.connect()
      await client.query(schema)
      client.release()

      console.log('Database schema initialized successfully')
    } catch (error) {
      console.error('Failed to initialize database schema:', error)
      throw error
    }
  }

  async query(text, params = []) {
    if (!this.isConnected || !this.pool) {
      await this.connect()
    }

    try {
      const result = await this.pool.query(text, params)
      return result
    } catch (error) {
      console.error('Database query error:', error)

      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        this.isConnected = false
        throw new Error(`Database connection lost: ${error.message}`)
      }

      throw error
    }
  }

  async transaction(callback) {
    if (!this.isConnected || !this.pool) {
      await this.connect()
    }

    const client = await this.pool.connect()

    try {
      await client.query('BEGIN')
      const result = await callback(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('Transaction failed:', error)
      throw error
    } finally {
      client.release()
    }
  }

  async healthCheck() {
    try {
      const result = await this.query('SELECT 1 as health')
      return result.rowCount === 1
    } catch (error) {
      console.error('Database health check failed:', error)
      return false
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
      this.isConnected = false
      console.log('Disconnected from PostgreSQL database')
    }
  }

  getPool() {
    return this.pool
  }

  isConnectionHealthy() {
    return this.isConnected && this.pool
  }
}

const dbConnection = new DatabaseConnection()

module.exports = {
  dbConnection,
  DatabaseConnection
}
