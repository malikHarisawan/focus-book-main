const { dbConnection } = require('./connection')
const appUsageService = require('./appUsageService')
const categoriesService = require('./categoriesService')
const fs = require('fs')
const path = require('path')
const os = require('os')

let app
try {
  app = require('electron').app
} catch (error) {
  // Running in standalone mode, create mock app
  app = {
    getPath: (name) => {
      if (name === 'userData') {
        return path.join(os.homedir(), '.focusbook')
      }
      return os.tmpdir()
    }
  }
}

class MigrationService {
  constructor() {
    this.userDataDir = null
    this.migrationStatus = {
      isCompleted: false,
      lastMigrationDate: null,
      migratedRecords: 0,
      errors: []
    }
  }

  getUserDataDir() {
    if (!this.userDataDir) {
      this.userDataDir = path.join(app.getPath('userData'), 'Data')
    }
    return this.userDataDir
  }

  async checkMigrationStatus() {
    try {
      const result = await dbConnection.query(
        "SELECT value FROM app_metadata WHERE key = 'migration_completed' LIMIT 1"
      )

      return result.rows.length > 0 && result.rows[0].value === 'true'
    } catch (error) {
      await this.createMetadataTable()
      return false
    }
  }

  async createMetadataTable() {
    try {
      await dbConnection.query(`
        CREATE TABLE IF NOT EXISTS app_metadata (
          key VARCHAR(255) PRIMARY KEY,
          value TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)
    } catch (error) {
      console.error('Error creating metadata table:', error)
      throw error
    }
  }

  async markMigrationCompleted() {
    try {
      await dbConnection.query(
        `INSERT INTO app_metadata (key, value) 
         VALUES ('migration_completed', 'true') 
         ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = CURRENT_TIMESTAMP`
      )
    } catch (error) {
      console.error('Error marking migration completed:', error)
      throw error
    }
  }

  loadJsonData() {
    const dataFiles = {
      appUsage: null,
      categories: null,
      customCategories: null
    }

    try {
      const dataPath = path.join(this.getUserDataDir(), 'data.json')
      if (fs.existsSync(dataPath)) {
        const data = fs.readFileSync(dataPath, 'utf-8')
        dataFiles.appUsage = JSON.parse(data)
        console.log('Loaded app usage data from JSON')
      }
    } catch (error) {
      console.error('Error loading app usage data:', error)
      this.migrationStatus.errors.push(`Failed to load app usage data: ${error.message}`)
    }

    try {
      const categoriesPath = path.join(this.getUserDataDir(), 'categories_data.json')
      if (fs.existsSync(categoriesPath)) {
        const data = fs.readFileSync(categoriesPath, 'utf-8')
        dataFiles.categories = JSON.parse(data)
        console.log('Loaded categories data from JSON')
      }
    } catch (error) {
      console.error('Error loading categories data:', error)
      this.migrationStatus.errors.push(`Failed to load categories data: ${error.message}`)
    }

    try {
      const customCategoriesPath = path.join(this.getUserDataDir(), 'custom-categories.json')
      if (fs.existsSync(customCategoriesPath)) {
        const data = fs.readFileSync(customCategoriesPath, 'utf-8')
        dataFiles.customCategories = JSON.parse(data)
        console.log('Loaded custom categories data from JSON')
      }
    } catch (error) {
      console.error('Error loading custom categories data:', error)
      this.migrationStatus.errors.push(`Failed to load custom categories data: ${error.message}`)
    }

    return dataFiles
  }

  async migrateAppUsageData(appUsageData) {
    if (!appUsageData) return 0

    let recordCount = 0

    try {
      console.log('Starting app usage data migration...')

      // Use a single transaction for all migration to avoid connection issues
      await dbConnection.transaction(async (client) => {
        for (const [dateStr, dayData] of Object.entries(appUsageData)) {
          try {
            const date = new Date(dateStr)
            if (isNaN(date.getTime())) {
              console.warn(`Invalid date: ${dateStr}, skipping...`)
              continue
            }

            if (dayData.apps) {
              for (const [appName, appData] of Object.entries(dayData.apps)) {
                await this.migrateAppRecordInTransaction(client, date, null, appName, appData)
                recordCount++
              }
            }

            for (const [key, value] of Object.entries(dayData)) {
              if (key !== 'apps' && key.match(/^\d{2}:\d{2}$/)) {
                const hour = parseInt(key.split(':')[0])

                for (const [appName, appData] of Object.entries(value)) {
                  await this.migrateAppRecordInTransaction(client, date, hour, appName, appData)
                  recordCount++
                }
              }
            }

            if (recordCount % 100 === 0) {
              console.log(`Migrated ${recordCount} app usage records...`)
            }
          } catch (error) {
            console.error(`Error migrating data for date ${dateStr}:`, error)
            this.migrationStatus.errors.push(
              `Failed to migrate data for ${dateStr}: ${error.message}`
            )
          }
        }
      })

      console.log(`Completed app usage data migration. Total records: ${recordCount}`)
      return recordCount
    } catch (error) {
      console.error('Error during app usage data migration:', error)
      throw error
    }
  }

  async migrateAppRecordInTransaction(client, date, hour, appName, appData) {
    try {
      const timestamps = appData.timestamps || []
      const formattedTimestamps = timestamps.map((ts) => ({
        start: new Date(ts.start),
        duration: ts.duration
      }))

      await appUsageService.saveAppUsageInTransaction(
        client,
        date,
        hour,
        appName,
        appData.time || 0,
        appData.category || 'Miscellaneous',
        appData.description || null,
        appData.domain || null,
        formattedTimestamps
      )
    } catch (error) {
      console.error(`Error migrating app record for ${appName}:`, error)
      throw error
    }
  }

  async migrateCategoriesData(categoriesData) {
    if (!categoriesData) return false

    try {
      console.log('Starting categories data migration...')

      const formattedCategories = {}

      if (categoriesData.productive) {
        formattedCategories.productive = categoriesData.productive
      }

      if (categoriesData.distracted) {
        formattedCategories.distracted = categoriesData.distracted
      }

      await categoriesService.saveCategories(formattedCategories)
      console.log('Completed categories data migration')
      return true
    } catch (error) {
      console.error('Error during categories data migration:', error)
      this.migrationStatus.errors.push(`Failed to migrate categories: ${error.message}`)
      throw error
    }
  }

  async migrateCustomCategoriesData(customCategoriesData) {
    if (!customCategoriesData) return false

    try {
      console.log('Starting custom categories data migration...')

      await categoriesService.saveCustomCategoryMappings(customCategoriesData)
      console.log('Completed custom categories data migration')
      return true
    } catch (error) {
      console.error('Error during custom categories data migration:', error)
      this.migrationStatus.errors.push(`Failed to migrate custom categories: ${error.message}`)
      throw error
    }
  }

  async createBackup() {
    try {
      const backupDir = path.join(this.getUserDataDir(), 'migration-backup')
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true })
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const files = ['data.json', 'categories_data.json', 'custom-categories.json']

      for (const file of files) {
        const sourcePath = path.join(this.getUserDataDir(), file)
        if (fs.existsSync(sourcePath)) {
          const backupPath = path.join(backupDir, `${timestamp}-${file}`)
          fs.copyFileSync(sourcePath, backupPath)
          console.log(`Backed up ${file} to ${backupPath}`)
        }
      }

      return true
    } catch (error) {
      console.error('Error creating backup:', error)
      return false
    }
  }

  async runFullMigration() {
    try {
      console.log('Starting full migration from JSON to PostgreSQL...')

      const isAlreadyMigrated = await this.checkMigrationStatus()
      if (isAlreadyMigrated) {
        console.log('Migration already completed, skipping...')
        return {
          success: true,
          message: 'Migration already completed',
          recordCount: 0
        }
      }

      await this.createBackup()

      const jsonData = this.loadJsonData()

      if (!jsonData.appUsage && !jsonData.categories && !jsonData.customCategories) {
        console.log('No JSON data found to migrate')
        await this.markMigrationCompleted()
        return {
          success: true,
          message: 'No data to migrate',
          recordCount: 0
        }
      }

      let totalRecords = 0

      if (jsonData.categories) {
        await this.migrateCategoriesData(jsonData.categories)
      }

      if (jsonData.customCategories) {
        await this.migrateCustomCategoriesData(jsonData.customCategories)
      }

      if (jsonData.appUsage) {
        totalRecords = await this.migrateAppUsageData(jsonData.appUsage)
      }

      await this.markMigrationCompleted()

      this.migrationStatus.isCompleted = true
      this.migrationStatus.lastMigrationDate = new Date()
      this.migrationStatus.migratedRecords = totalRecords

      console.log(`Migration completed successfully! Migrated ${totalRecords} records.`)

      return {
        success: true,
        message: `Migration completed successfully! Migrated ${totalRecords} records.`,
        recordCount: totalRecords,
        errors: this.migrationStatus.errors
      }
    } catch (error) {
      console.error('Migration failed:', error)
      this.migrationStatus.errors.push(`Migration failed: ${error.message}`)

      return {
        success: false,
        message: `Migration failed: ${error.message}`,
        recordCount: 0,
        errors: this.migrationStatus.errors
      }
    }
  }

  getMigrationStatus() {
    return this.migrationStatus
  }
}

module.exports = new MigrationService()
