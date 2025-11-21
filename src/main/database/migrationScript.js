/**
 * NeDB to SQLite Migration Script
 *
 * This script migrates data from the existing NeDB file-based storage
 * to the new SQLite relational database. It handles data transformation,
 * validation, and provides progress reporting.
 *
 * Migration Process:
 * 1. Initialize both NeDB and SQLite connections
 * 2. Read all data from NeDB collections
 * 3. Transform data to match SQLite schema
 * 4. Insert data into SQLite tables with proper relationships
 * 5. Validate migration success
 * 6. Create backup of NeDB data
 *
 * Data Transformations:
 * - Convert MongoDB ObjectIds to auto-increment integers
 * - Extract embedded timestamps arrays to separate table
 * - Extract embedded focus session interruptions to separate table
 * - Normalize date formats to ISO strings
 * - Handle null/undefined values properly
 *
 * @author FocusBook Team
 * @version 3.0.0
 */

const path = require('path')
const fs = require('fs')
const { app } = require('electron')
const NeDBConnection = require('./nedbConnection')
const SQLiteConnection = require('./sqliteConnection')

class DataMigrator {
  constructor() {
    this.nedbConnection = new NeDBConnection()
    this.sqliteConnection = new SQLiteConnection()
    this.migrationStats = {
      appUsage: { total: 0, migrated: 0, failed: 0 },
      categories: { total: 0, migrated: 0, failed: 0 },
      customCategoryMappings: { total: 0, migrated: 0, failed: 0 },
      focusSessions: { total: 0, migrated: 0, failed: 0 },
      timestamps: { total: 0, migrated: 0, failed: 0 },
      interruptions: { total: 0, migrated: 0, failed: 0 }
    }
  }

  async migrate() {
    console.log('🚀 Starting NeDB to SQLite migration...')
    
    try {
      // Initialize connections
      await this.initializeConnections()
      
      // Check if migration is needed
      const migrationNeeded = await this.checkIfMigrationNeeded()
      if (!migrationNeeded) {
        console.log('✅ Migration not needed - SQLite database already has data')
        return true
      }

      // Create backup of NeDB data
      await this.createNedbBackup()
      
      // Migrate data
      await this.migrateCategories()
      await this.migrateCustomCategoryMappings()
      await this.migrateAppUsage()
      await this.migrateFocusSessions()
      
      // Verify migration
      await this.verifyMigration()
      
      // Print final statistics
      this.printMigrationStats()
      
      console.log('✅ Migration completed successfully!')
      return true
      
    } catch (error) {
      console.error('❌ Migration failed:', error.message)
      console.error(error.stack)
      return false
    } finally {
      await this.cleanup()
    }
  }

  async initializeConnections() {
    console.log('🔄 Initializing database connections...')
    
    try {
      await this.nedbConnection.connect()
      console.log('✅ NeDB connection established')
      
      await this.sqliteConnection.connect()
      console.log('✅ SQLite connection established')
    } catch (error) {
      throw new Error(`Failed to initialize connections: ${error.message}`)
    }
  }

  async checkIfMigrationNeeded() {
    try {
      // Check if SQLite has any app usage data
      const sqliteAppUsageCount = await this.sqliteConnection.count('app_usage', {})
      const nedbAppUsageCount = await this.nedbConnection.count('appUsage', {})
      
      console.log(`📊 NeDB app usage records: ${nedbAppUsageCount}`)
      console.log(`📊 SQLite app usage records: ${sqliteAppUsageCount}`)
      
      // If SQLite has data and NeDB has data, assume migration already done
      if (sqliteAppUsageCount > 0 && nedbAppUsageCount > 0) {
        const userChoice = await this.promptUserForForceMove()
        return userChoice
      }
      
      return nedbAppUsageCount > 0
    } catch (error) {
      console.warn('Could not determine if migration is needed, proceeding with migration:', error.message)
      return true
    }
  }

  async promptUserForForceMove() {
    // In a real implementation, you might want to show a dialog to the user
    // For now, we'll default to not migrating if SQLite already has data
    console.log('⚠️ SQLite database already contains data. Skipping migration to prevent data loss.')
    console.log('⚠️ If you want to force migration, please manually delete the SQLite database file.')
    return false
  }

  async createNedbBackup() {
    try {
      console.log('💾 Creating backup of NeDB data...')
      
      const userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), 'userData')
      const backupDir = path.join(userDataPath, 'migration-backup')
      
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true })
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = path.join(backupDir, `nedb-backup-${timestamp}`)
      
      if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true })
      }
      
      // Copy all NeDB files
      const nedbDir = path.join(userDataPath, 'LocalData')
      if (fs.existsSync(nedbDir)) {
        const files = fs.readdirSync(nedbDir)
        for (const file of files) {
          if (file.endsWith('.db')) {
            fs.copyFileSync(
              path.join(nedbDir, file),
              path.join(backupPath, file)
            )
          }
        }
      }
      
      console.log(`✅ Backup created at: ${backupPath}`)
    } catch (error) {
      console.warn('Could not create backup:', error.message)
    }
  }

  async migrateCategories() {
    console.log('🔄 Migrating categories...')
    
    try {
      const nedbCategories = await this.nedbConnection.find('categories', {})
      this.migrationStats.categories.total = nedbCategories.length
      
      for (const category of nedbCategories) {
        try {
          // Check if category already exists
          const existing = await this.sqliteConnection.findOne('categories', { name: category.name })
          if (!existing) {
            await this.sqliteConnection.insert('categories', {
              name: category.name,
              type: category.type
            })
            this.migrationStats.categories.migrated++
          } else {
            console.log(`⚠️ Category '${category.name}' already exists, skipping`)
          }
        } catch (error) {
          console.error(`❌ Failed to migrate category '${category.name}':`, error.message)
          this.migrationStats.categories.failed++
        }
      }
      
      console.log(`✅ Categories migration: ${this.migrationStats.categories.migrated}/${this.migrationStats.categories.total}`)
    } catch (error) {
      throw new Error(`Categories migration failed: ${error.message}`)
    }
  }

  async migrateCustomCategoryMappings() {
    console.log('🔄 Migrating custom category mappings...')
    
    try {
      const nedbMappings = await this.nedbConnection.find('customCategoryMappings', {})
      this.migrationStats.customCategoryMappings.total = nedbMappings.length
      
      for (const mapping of nedbMappings) {
        try {
          // Check if mapping already exists
          const existing = await this.sqliteConnection.findOne('custom_category_mappings', { 
            app_identifier: mapping.appIdentifier 
          })
          if (!existing) {
            await this.sqliteConnection.insert('custom_category_mappings', {
              app_identifier: mapping.appIdentifier,
              custom_category: mapping.customCategory
            })
            this.migrationStats.customCategoryMappings.migrated++
          }
        } catch (error) {
          console.error(`❌ Failed to migrate mapping '${mapping.appIdentifier}':`, error.message)
          this.migrationStats.customCategoryMappings.failed++
        }
      }
      
      console.log(`✅ Mappings migration: ${this.migrationStats.customCategoryMappings.migrated}/${this.migrationStats.customCategoryMappings.total}`)
    } catch (error) {
      throw new Error(`Custom category mappings migration failed: ${error.message}`)
    }
  }

  async migrateAppUsage() {
    console.log('🔄 Migrating app usage data...')
    
    try {
      const nedbAppUsage = await this.nedbConnection.find('appUsage', {}, { sort: { date: 1 } })
      this.migrationStats.appUsage.total = nedbAppUsage.length
      
      let processedCount = 0
      
      for (const usage of nedbAppUsage) {
        try {
          // Transform the data for SQLite
          const sqliteUsage = {
            date: this.formatDateForSQLite(usage.date),
            hour: usage.hour,
            app_name: usage.appName,
            time_spent: usage.timeSpent || 0,
            category: usage.category,
            description: usage.description || null,
            domain: usage.domain || null
          }
          
          // Insert app usage record
          const result = await this.sqliteConnection.insert('app_usage', sqliteUsage)
          const appUsageId = result.id
          
          // Migrate timestamps if they exist
          if (usage.timestamps && Array.isArray(usage.timestamps)) {
            await this.migrateTimestamps(usage.timestamps, appUsageId)
          }
          
          this.migrationStats.appUsage.migrated++
          processedCount++
          
          // Progress reporting
          if (processedCount % 100 === 0) {
            console.log(`📊 Processed ${processedCount}/${this.migrationStats.appUsage.total} app usage records`)
          }
        } catch (error) {
          console.error(`❌ Failed to migrate app usage record:`, error.message)
          this.migrationStats.appUsage.failed++
        }
      }
      
      console.log(`✅ App usage migration: ${this.migrationStats.appUsage.migrated}/${this.migrationStats.appUsage.total}`)
    } catch (error) {
      throw new Error(`App usage migration failed: ${error.message}`)
    }
  }

  async migrateTimestamps(timestamps, appUsageId) {
    if (!timestamps || !Array.isArray(timestamps)) return
    
    for (const timestamp of timestamps) {
      try {
        await this.sqliteConnection.insert('timestamps', {
          app_usage_id: appUsageId,
          start_time: this.formatDateForSQLite(timestamp.start),
          duration: timestamp.duration || 0
        })
        this.migrationStats.timestamps.migrated++
      } catch (error) {
        console.error(`❌ Failed to migrate timestamp:`, error.message)
        this.migrationStats.timestamps.failed++
      }
    }
    
    this.migrationStats.timestamps.total += timestamps.length
  }

  async migrateFocusSessions() {
    console.log('🔄 Migrating focus sessions...')
    
    try {
      const nedbSessions = await this.nedbConnection.find('focusSessions', {}, { sort: { startTime: 1 } })
      this.migrationStats.focusSessions.total = nedbSessions.length
      
      for (const session of nedbSessions) {
        try {
          const sqliteSession = {
            type: session.type,
            start_time: this.formatDateForSQLite(session.startTime),
            end_time: session.endTime ? this.formatDateForSQLite(session.endTime) : null,
            planned_duration: session.plannedDuration || 0,
            actual_duration: session.actualDuration || null,
            status: session.status || 'active',
            notes: session.notes || null,
            productivity: session.productivity || null,
            date: this.formatDateForSQLite(session.date || session.startTime)
          }
          
          // Insert focus session record
          const result = await this.sqliteConnection.insert('focus_sessions', sqliteSession)
          const sessionId = result.id
          
          // Migrate interruptions if they exist
          if (session.interruptions && Array.isArray(session.interruptions)) {
            await this.migrateInterruptions(session.interruptions, sessionId)
          }
          
          this.migrationStats.focusSessions.migrated++
        } catch (error) {
          console.error(`❌ Failed to migrate focus session:`, error.message)
          this.migrationStats.focusSessions.failed++
        }
      }
      
      console.log(`✅ Focus sessions migration: ${this.migrationStats.focusSessions.migrated}/${this.migrationStats.focusSessions.total}`)
    } catch (error) {
      throw new Error(`Focus sessions migration failed: ${error.message}`)
    }
  }

  async migrateInterruptions(interruptions, sessionId) {
    if (!interruptions || !Array.isArray(interruptions)) return
    
    for (const interruption of interruptions) {
      try {
        await this.sqliteConnection.insert('focus_session_interruptions', {
          focus_session_id: sessionId,
          timestamp: this.formatDateForSQLite(interruption.timestamp),
          reason: interruption.reason || null,
          app_name: interruption.appName || null
        })
        this.migrationStats.interruptions.migrated++
      } catch (error) {
        console.error(`❌ Failed to migrate interruption:`, error.message)
        this.migrationStats.interruptions.failed++
      }
    }
    
    this.migrationStats.interruptions.total += interruptions.length
  }

  async verifyMigration() {
    console.log('🔍 Verifying migration...')
    
    try {
      const verification = {
        categories: await this.sqliteConnection.count('categories', {}),
        customCategoryMappings: await this.sqliteConnection.count('custom_category_mappings', {}),
        appUsage: await this.sqliteConnection.count('app_usage', {}),
        focusSessions: await this.sqliteConnection.count('focus_sessions', {}),
        timestamps: await this.sqliteConnection.count('timestamps', {}),
        interruptions: await this.sqliteConnection.count('focus_session_interruptions', {})
      }
      
      console.log('📊 Migration verification:')
      Object.entries(verification).forEach(([table, count]) => {
        console.log(`   ${table}: ${count} records`)
      })
      
      return verification
    } catch (error) {
      throw new Error(`Migration verification failed: ${error.message}`)
    }
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

  printMigrationStats() {
    console.log('\n📊 Migration Statistics:')
    console.log('=' .repeat(50))
    
    Object.entries(this.migrationStats).forEach(([table, stats]) => {
      const successRate = stats.total > 0 ? ((stats.migrated / stats.total) * 100).toFixed(1) : '100.0'
      console.log(`${table.padEnd(25)} | ${stats.migrated.toString().padStart(6)}/${stats.total.toString().padStart(6)} (${successRate}%)`)
    })
    
    const totalMigrated = Object.values(this.migrationStats).reduce((sum, stats) => sum + stats.migrated, 0)
    const totalFailed = Object.values(this.migrationStats).reduce((sum, stats) => sum + stats.failed, 0)
    
    console.log('=' .repeat(50))
    console.log(`Total migrated: ${totalMigrated}`)
    console.log(`Total failed: ${totalFailed}`)
  }

  async cleanup() {
    try {
      await this.nedbConnection.disconnect()
      await this.sqliteConnection.disconnect()
      console.log('✅ Database connections closed')
    } catch (error) {
      console.error('Error during cleanup:', error.message)
    }
  }
}

// Export for use in other modules
module.exports = DataMigrator

// Allow running as standalone script
if (require.main === module) {
  const migrator = new DataMigrator()
  migrator.migrate()
    .then(success => {
      console.log(success ? '🎉 Migration completed successfully!' : '❌ Migration failed')
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('❌ Migration error:', error.message)
      process.exit(1)
    })
}