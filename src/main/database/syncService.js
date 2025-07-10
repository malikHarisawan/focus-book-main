const { DatabaseConnection } = require('./connection')
const NeDBConnection = require('./nedbConnection')

class SyncService {
  constructor() {
    this.mongoConnection = new DatabaseConnection()
    this.nedbConnection = new NeDBConnection()
    this.isSyncing = false
    this.lastSyncTime = null
    this.syncStats = {
      totalSynced: 0,
      categoriesSynced: 0,
      mappingsSynced: 0,
      appUsageSynced: 0,
      errors: []
    }
  }

  async syncMongoToNeDB() {
    if (this.isSyncing) {
      console.log('⚠️ Sync already in progress, skipping...')
      return false
    }

    this.isSyncing = true
    this.syncStats = {
      totalSynced: 0,
      categoriesSynced: 0,
      mappingsSynced: 0,
      appUsageSynced: 0,
      errors: []
    }

    try {
      console.log('🔄 Starting MongoDB to NeDB sync...')

      // Connect to both databases
      await this.mongoConnection.connect()
      await this.nedbConnection.connect()

      // Sync categories
      await this.syncCategories()

      // Sync custom category mappings
      await this.syncCustomMappings()

      // Sync app usage data
      await this.syncAppUsage()

      this.lastSyncTime = new Date()

      console.log('✅ MongoDB to NeDB sync completed successfully')
      console.log(
        `📊 Sync stats: ${this.syncStats.totalSynced} total records, ${this.syncStats.categoriesSynced} categories, ${this.syncStats.mappingsSynced} mappings, ${this.syncStats.appUsageSynced} app usage records`
      )

      return true
    } catch (error) {
      console.error('❌ MongoDB to NeDB sync failed:', error.message)
      this.syncStats.errors.push(error.message)
      return false
    } finally {
      this.isSyncing = false
    }
  }

  async syncCategories() {
    try {
      console.log('🔄 Syncing categories...')

      // Get categories from MongoDB
      const { Category } = require('./models')
      const mongoCategories = await Category.find({}).lean()

      // Clear existing categories in NeDB
      await this.nedbConnection.remove('categories', {}, { multi: true })

      // Insert categories into NeDB
      for (const category of mongoCategories) {
        await this.nedbConnection.insert('categories', {
          name: category.name,
          type: category.type
        })
        this.syncStats.categoriesSynced++
      }

      console.log(`✅ Synced ${this.syncStats.categoriesSynced} categories`)
    } catch (error) {
      console.error('❌ Failed to sync categories:', error.message)
      this.syncStats.errors.push(`Categories sync: ${error.message}`)
    }
  }

  async syncCustomMappings() {
    try {
      console.log('🔄 Syncing custom category mappings...')

      // Get custom mappings from MongoDB
      const { CustomCategoryMapping } = require('./models')
      const mongoMappings = await CustomCategoryMapping.find({}).lean()

      // Clear existing mappings in NeDB
      await this.nedbConnection.remove('customCategoryMappings', {}, { multi: true })

      // Insert mappings into NeDB
      for (const mapping of mongoMappings) {
        await this.nedbConnection.insert('customCategoryMappings', {
          appIdentifier: mapping.appIdentifier,
          customCategory: mapping.customCategory
        })
        this.syncStats.mappingsSynced++
      }

      console.log(`✅ Synced ${this.syncStats.mappingsSynced} custom category mappings`)
    } catch (error) {
      console.error('❌ Failed to sync custom mappings:', error.message)
      this.syncStats.errors.push(`Custom mappings sync: ${error.message}`)
    }
  }

  async syncAppUsage() {
    try {
      console.log('🔄 Syncing app usage data...')

      // Get app usage from MongoDB
      const { AppUsage } = require('./models')
      const mongoAppUsage = await AppUsage.find({}).lean()

      // Clear existing app usage in NeDB
      await this.nedbConnection.remove('appUsage', {}, { multi: true })

      // Insert app usage into NeDB
      for (const record of mongoAppUsage) {
        await this.nedbConnection.insert('appUsage', {
          date: record.date.toISOString().split('T')[0], // Convert to string format
          hour: record.hour,
          appName: record.appName,
          timeSpent: record.timeSpent,
          category: record.category,
          description: record.description,
          domain: record.domain,
          timestamps: record.timestamps || []
        })
        this.syncStats.appUsageSynced++
      }

      console.log(`✅ Synced ${this.syncStats.appUsageSynced} app usage records`)
    } catch (error) {
      console.error('❌ Failed to sync app usage:', error.message)
      this.syncStats.errors.push(`App usage sync: ${error.message}`)
    }
  }

  async syncNeDBToMongo() {
    if (this.isSyncing) {
      console.log('⚠️ Sync already in progress, skipping...')
      return false
    }

    this.isSyncing = true
    this.syncStats = {
      totalSynced: 0,
      categoriesSynced: 0,
      mappingsSynced: 0,
      appUsageSynced: 0,
      errors: []
    }

    try {
      console.log('🔄 Starting NeDB to MongoDB sync...')

      // Connect to both databases
      await this.mongoConnection.connect()
      await this.nedbConnection.connect()

      // Sync categories
      await this.syncCategoriesToMongo()

      // Sync custom category mappings
      await this.syncCustomMappingsToMongo()

      // Sync app usage data
      await this.syncAppUsageToMongo()

      this.lastSyncTime = new Date()

      console.log('✅ NeDB to MongoDB sync completed successfully')
      console.log(
        `📊 Sync stats: ${this.syncStats.totalSynced} total records, ${this.syncStats.categoriesSynced} categories, ${this.syncStats.mappingsSynced} mappings, ${this.syncStats.appUsageSynced} app usage records`
      )

      return true
    } catch (error) {
      console.error('❌ NeDB to MongoDB sync failed:', error.message)
      this.syncStats.errors.push(error.message)
      return false
    } finally {
      this.isSyncing = false
    }
  }

  async syncCategoriesToMongo() {
    try {
      console.log('🔄 Syncing categories to MongoDB...')

      // Get categories from NeDB
      const nedbCategories = await this.nedbConnection.find('categories', {})

      // Prepare categories for MongoDB
      const categoriesData = {
        productive: nedbCategories
          .filter((cat) => cat.type === 'productive')
          .map((cat) => cat.name),
        distracted: nedbCategories.filter((cat) => cat.type === 'distracted').map((cat) => cat.name)
      }

      // Use existing categories service
      const CategoriesService = require('./categoriesService')
      await CategoriesService.saveCategories(categoriesData)

      this.syncStats.categoriesSynced = nedbCategories.length
      console.log(`✅ Synced ${this.syncStats.categoriesSynced} categories to MongoDB`)
    } catch (error) {
      console.error('❌ Failed to sync categories to MongoDB:', error.message)
      this.syncStats.errors.push(`Categories to MongoDB sync: ${error.message}`)
    }
  }

  async syncCustomMappingsToMongo() {
    try {
      console.log('🔄 Syncing custom mappings to MongoDB...')

      // Get custom mappings from NeDB
      const nedbMappings = await this.nedbConnection.find('customCategoryMappings', {})

      // Prepare mappings for MongoDB
      const mappingsData = {}
      nedbMappings.forEach((mapping) => {
        mappingsData[mapping.appIdentifier] = mapping.customCategory
      })

      // Use existing categories service
      const CategoriesService = require('./categoriesService')
      await CategoriesService.saveCustomCategoryMappings(mappingsData)

      this.syncStats.mappingsSynced = nedbMappings.length
      console.log(`✅ Synced ${this.syncStats.mappingsSynced} custom mappings to MongoDB`)
    } catch (error) {
      console.error('❌ Failed to sync custom mappings to MongoDB:', error.message)
      this.syncStats.errors.push(`Custom mappings to MongoDB sync: ${error.message}`)
    }
  }

  async syncAppUsageToMongo() {
    try {
      console.log('🔄 Syncing app usage to MongoDB...')

      // Get app usage from NeDB
      const nedbAppUsage = await this.nedbConnection.find('appUsage', {})

      // Group by date for efficient bulk operations
      const groupedData = {}
      nedbAppUsage.forEach((record) => {
        if (!groupedData[record.date]) {
          groupedData[record.date] = { apps: {} }
        }

        if (record.hour !== null) {
          const hourKey = `${record.hour.toString().padStart(2, '0')}:00`
          if (!groupedData[record.date][hourKey]) {
            groupedData[record.date][hourKey] = {}
          }
          groupedData[record.date][hourKey][record.appName] = {
            time: record.timeSpent,
            category: record.category,
            description: record.description,
            domain: record.domain,
            timestamps: record.timestamps || []
          }
        } else {
          groupedData[record.date].apps[record.appName] = {
            time: record.timeSpent,
            category: record.category,
            description: record.description,
            domain: record.domain,
            timestamps: record.timestamps || []
          }
        }
      })

      // Use existing app usage service
      const AppUsageService = require('./appUsageService')
      await AppUsageService.bulkUpdateAppUsageData(groupedData)

      this.syncStats.appUsageSynced = nedbAppUsage.length
      console.log(`✅ Synced ${this.syncStats.appUsageSynced} app usage records to MongoDB`)
    } catch (error) {
      console.error('❌ Failed to sync app usage to MongoDB:', error.message)
      this.syncStats.errors.push(`App usage to MongoDB sync: ${error.message}`)
    }
  }

  async exportNeDBData() {
    try {
      console.log('🔄 Exporting NeDB data...')

      await this.nedbConnection.connect()

      const [categories, customMappings, appUsage] = await Promise.all([
        this.nedbConnection.find('categories', {}),
        this.nedbConnection.find('customCategoryMappings', {}),
        this.nedbConnection.find('appUsage', {})
      ])

      const exportData = {
        categories: categories,
        customMappings: customMappings,
        appUsage: appUsage,
        exportDate: new Date(),
        totalRecords: categories.length + customMappings.length + appUsage.length
      }

      console.log(`✅ Exported ${exportData.totalRecords} records from NeDB`)
      return exportData
    } catch (error) {
      console.error('❌ Failed to export NeDB data:', error.message)
      throw error
    }
  }

  async importNeDBData(importData) {
    try {
      console.log('🔄 Importing data to NeDB...')

      await this.nedbConnection.connect()

      let importedCount = 0

      // Import categories
      if (importData.categories && importData.categories.length > 0) {
        await this.nedbConnection.remove('categories', {}, { multi: true })
        for (const category of importData.categories) {
          await this.nedbConnection.insert('categories', {
            name: category.name,
            type: category.type
          })
          importedCount++
        }
      }

      // Import custom mappings
      if (importData.customMappings && importData.customMappings.length > 0) {
        await this.nedbConnection.remove('customCategoryMappings', {}, { multi: true })
        for (const mapping of importData.customMappings) {
          await this.nedbConnection.insert('customCategoryMappings', {
            appIdentifier: mapping.appIdentifier,
            customCategory: mapping.customCategory
          })
          importedCount++
        }
      }

      // Import app usage
      if (importData.appUsage && importData.appUsage.length > 0) {
        await this.nedbConnection.remove('appUsage', {}, { multi: true })
        for (const record of importData.appUsage) {
          await this.nedbConnection.insert('appUsage', {
            date: record.date,
            hour: record.hour,
            appName: record.appName,
            timeSpent: record.timeSpent,
            category: record.category,
            description: record.description,
            domain: record.domain,
            timestamps: record.timestamps || []
          })
          importedCount++
        }
      }

      console.log(`✅ Imported ${importedCount} records to NeDB`)
      return { success: true, importedCount }
    } catch (error) {
      console.error('❌ Failed to import data to NeDB:', error.message)
      throw error
    }
  }

  getSyncStats() {
    return {
      ...this.syncStats,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime
    }
  }

  async getStorageStats() {
    try {
      const [mongoStats, nedbStats] = await Promise.all([
        this.mongoConnection.getStats(),
        this.nedbConnection.getStats()
      ])

      return {
        mongodb: mongoStats,
        nedb: nedbStats,
        lastSyncTime: this.lastSyncTime
      }
    } catch (error) {
      console.error('Error getting storage stats:', error.message)
      return {
        error: error.message,
        lastSyncTime: this.lastSyncTime
      }
    }
  }
}

module.exports = new SyncService()
