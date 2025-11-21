/**
 * Local Categories Service
 *
 * This service manages productivity categories and custom app categorizations
 * using NeDB as the storage backend. It handles both predefined categories
 * and user-defined custom mappings for applications.
 *
 * Category System:
 * - Productive: Code, Development, Work-related apps
 * - Neutral: Utilities, Communication, Browsing
 * - Distracting: Entertainment, Games, Social Media
 *
 * Features:
 * - Default category definitions and rules
 * - Custom user categorizations that override defaults
 * - Category-based productivity scoring
 * - Settings management for category preferences
 *
 * @author FocusBook Team
 * @version 2.0.0
 */

class LocalCategoriesService {
  constructor(dbConnection) {
    this.db = dbConnection
  }

  async saveCategories(categories) {
    return this.db.executeWithRetry(async () => {
      let saveCount = 0

      // Handle productive categories
      if (categories.productive && Array.isArray(categories.productive)) {
        for (const categoryName of categories.productive) {
          const existing = await this.db.findOne('categories', { name: categoryName })

          if (existing) {
            await this.db.update(
              'categories',
              { name: categoryName },
              {
                $set: { type: 'productive' }
              }
            )
          } else {
            await this.db.insert('categories', {
              name: categoryName,
              type: 'productive'
            })
          }
          saveCount++
        }
      }

      // Handle distracted categories
      if (categories.distracted && Array.isArray(categories.distracted)) {
        for (const categoryName of categories.distracted) {
          const existing = await this.db.findOne('categories', { name: categoryName })

          if (existing) {
            await this.db.update(
              'categories',
              { name: categoryName },
              {
                $set: { type: 'distracted' }
              }
            )
          } else {
            await this.db.insert('categories', {
              name: categoryName,
              type: 'distracted'
            })
          }
          saveCount++
        }
      }

      console.log(`Categories saved: ${saveCount} categories processed`)
      return saveCount > 0
    })
  }

  async getCategoriesForSettings() {
    return this.db.executeWithRetry(async () => {
      const [productiveCategories, distractedCategories] = await Promise.all([
        this.db.find('categories', { type: 'productive' }, { sort: { name: 1 } }),
        this.db.find('categories', { type: 'distracted' }, { sort: { name: 1 } })
      ])

      const productive = productiveCategories.map((cat) => cat.name)
      const distracted = distractedCategories.map((cat) => cat.name)

      return [productive, distracted]
    })
  }

  async getAllCategories() {
    return this.db.executeWithRetry(async () => {
      const categories = await this.db.find('categories', {}, { sort: { type: 1, name: 1 } })
      return categories
    })
  }

  async getCategoriesByType(type) {
    return this.db.executeWithRetry(async () => {
      const categories = await this.db.find('categories', { type: type }, { sort: { name: 1 } })
      return categories.map((cat) => cat.name)
    })
  }

  async addCategory(name, type) {
    return this.db.executeWithRetry(async () => {
      const existing = await this.db.findOne('categories', { name: name })

      if (existing) {
        // Update existing category
        await this.db.update(
          'categories',
          { name: name },
          {
            $set: { type: type }
          }
        )
        return true
      } else {
        // Add new category
        await this.db.insert('categories', { name, type })
        return true
      }
    })
  }

  async updateCategory(name, newType) {
    return this.db.executeWithRetry(async () => {
      const result = await this.db.update(
        'categories',
        { name: name },
        {
          $set: { type: newType }
        }
      )
      return result.numReplaced > 0
    })
  }

  async deleteCategory(name) {
    return this.db.executeWithRetry(async () => {
      const result = await this.db.remove('categories', { name: name })
      return result > 0
    })
  }

  async getCustomCategoryMappings() {
    return this.db.executeWithRetry(async () => {
      const mappings = await this.db.find('customCategoryMappings', {})

      const result = {}
      mappings.forEach((mapping) => {
        result[mapping.appIdentifier] = mapping.customCategory
      })

      return result
    })
  }

  async saveCustomCategoryMappings(mappings) {
    return this.db.executeWithRetry(async () => {
      if (!mappings || typeof mappings !== 'object') {
        console.log('No valid mappings provided')
        return false
      }

      let saveCount = 0

      for (const [appIdentifier, customCategory] of Object.entries(mappings)) {
        const existing = await this.db.findOne('customCategoryMappings', {
          appIdentifier: appIdentifier
        })

        if (existing) {
          await this.db.update(
            'customCategoryMappings',
            { appIdentifier: appIdentifier },
            {
              $set: { customCategory: customCategory }
            }
          )
        } else {
          await this.db.insert('customCategoryMappings', {
            appIdentifier: appIdentifier,
            customCategory: customCategory
          })
        }
        saveCount++
      }

      console.log(`Custom mappings saved: ${saveCount} mappings processed`)
      return saveCount > 0
    })
  }

  async addCustomCategoryMapping(appIdentifier, customCategory) {
    return this.db.executeWithRetry(async () => {
      const existing = await this.db.findOne('customCategoryMappings', {
        appIdentifier: appIdentifier
      })

      if (existing) {
        await this.db.update(
          'customCategoryMappings',
          { appIdentifier: appIdentifier },
          {
            $set: { customCategory: customCategory }
          }
        )
      } else {
        await this.db.insert('customCategoryMappings', {
          appIdentifier,
          customCategory
        })
      }
      return true
    })
  }

  async removeCustomCategoryMapping(appIdentifier) {
    return this.db.executeWithRetry(async () => {
      const result = await this.db.remove('customCategoryMappings', {
        appIdentifier: appIdentifier
      })
      return result > 0
    })
  }

  async getCustomCategoryMapping(appIdentifier) {
    return this.db.executeWithRetry(async () => {
      const mapping = await this.db.findOne('customCategoryMappings', {
        appIdentifier: appIdentifier
      })
      return mapping ? mapping.customCategory : null
    })
  }

  async clearAllCustomMappings() {
    return this.db.executeWithRetry(async () => {
      const result = await this.db.remove('customCategoryMappings', {}, { multi: true })
      return result
    })
  }

  async bulkUpdateCustomMappings(mappingsArray) {
    return this.db.executeWithRetry(async () => {
      if (!Array.isArray(mappingsArray) || mappingsArray.length === 0) {
        return false
      }

      let updateCount = 0

      for (const mapping of mappingsArray) {
        const existing = await this.db.findOne('customCategoryMappings', {
          appIdentifier: mapping.appIdentifier
        })

        if (existing) {
          await this.db.update(
            'customCategoryMappings',
            {
              appIdentifier: mapping.appIdentifier
            },
            {
              $set: { customCategory: mapping.customCategory }
            }
          )
        } else {
          await this.db.insert('customCategoryMappings', {
            appIdentifier: mapping.appIdentifier,
            customCategory: mapping.customCategory
          })
        }
        updateCount++
      }

      console.log(`Bulk custom mappings update: ${updateCount} mappings processed`)
      return true
    })
  }

  async getCategoryStats() {
    return this.db.executeWithRetry(async () => {
      const [categories, mappingsCount] = await Promise.all([
        this.db.find('categories', {}),
        this.db.count('customCategoryMappings', {})
      ])

      // Group categories by type
      const categoryStats = {}
      categories.forEach((cat) => {
        if (!categoryStats[cat.type]) {
          categoryStats[cat.type] = {
            _id: cat.type,
            count: 0,
            categories: []
          }
        }
        categoryStats[cat.type].count++
        categoryStats[cat.type].categories.push(cat.name)
      })

      return {
        categoryStats: Object.values(categoryStats),
        customMappingsCount: mappingsCount
      }
    })
  }

  async searchCategories(searchTerm) {
    return this.db.executeWithRetry(async () => {
      const categories = await this.db.find(
        'categories',
        {
          name: new RegExp(searchTerm, 'i')
        },
        { sort: { name: 1 } }
      )

      return categories
    })
  }

  async getRecentlyUsedCategories(limit = 10) {
    return this.db.executeWithRetry(async () => {
      // Since we don't have aggregation in NeDB, we'll simulate this
      const appUsageResults = await this.db.find('appUsage', {}, { sort: { updatedAt: -1 } })

      const categoryUsage = {}

      appUsageResults.forEach((record) => {
        if (!categoryUsage[record.category]) {
          categoryUsage[record.category] = {
            category: record.category,
            lastUsed: record.updatedAt || record.createdAt,
            usageCount: 0
          }
        }
        categoryUsage[record.category].usageCount++

        const recordDate = new Date(record.updatedAt || record.createdAt)
        const currentLastUsed = new Date(categoryUsage[record.category].lastUsed)

        if (recordDate > currentLastUsed) {
          categoryUsage[record.category].lastUsed = recordDate
        }
      })

      return Object.values(categoryUsage)
        .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))
        .slice(0, limit)
    })
  }

  async getCategoryWithUsageStats(categoryName) {
    return this.db.executeWithRetry(async () => {
      const [category, usageRecords] = await Promise.all([
        this.db.findOne('categories', { name: categoryName }),
        this.db.find('appUsage', { category: categoryName })
      ])

      let stats = {
        totalTime: 0,
        totalSessions: 0,
        uniqueApps: new Set(),
        firstUsed: null,
        lastUsed: null
      }

      if (usageRecords.length > 0) {
        usageRecords.forEach((record) => {
          stats.totalTime += record.timeSpent
          stats.totalSessions += 1
          stats.uniqueApps.add(record.appName)

          const recordDate = new Date(record.createdAt)
          if (!stats.firstUsed || recordDate < stats.firstUsed) {
            stats.firstUsed = recordDate
          }
          if (!stats.lastUsed || recordDate > stats.lastUsed) {
            stats.lastUsed = recordDate
          }
        })

        stats.uniqueApps = Array.from(stats.uniqueApps)
      }

      return {
        category,
        stats: {
          totalTime: stats.totalTime,
          totalSessions: stats.totalSessions,
          uniqueApps: stats.uniqueApps,
          firstUsed: stats.firstUsed,
          lastUsed: stats.lastUsed
        }
      }
    })
  }

  async validateCategoryExists(categoryName) {
    return this.db.executeWithRetry(async () => {
      const category = await this.db.findOne('categories', { name: categoryName })
      return !!category
    })
  }

  async getCategoriesWithCounts() {
    return this.db.executeWithRetry(async () => {
      const [categories, usageRecords] = await Promise.all([
        this.db.find('categories', {}, { sort: { type: 1, name: 1 } }),
        this.db.find('appUsage', {})
      ])

      // Count usage for each category
      const usageCounts = {}
      const timeCounts = {}

      usageRecords.forEach((record) => {
        if (!usageCounts[record.category]) {
          usageCounts[record.category] = 0
          timeCounts[record.category] = 0
        }
        usageCounts[record.category]++
        timeCounts[record.category] += record.timeSpent
      })

      return categories.map((category) => ({
        name: category.name,
        type: category.type,
        usageCount: usageCounts[category.name] || 0,
        totalTime: timeCounts[category.name] || 0
      }))
    })
  }

  async exportCategories() {
    return this.db.executeWithRetry(async () => {
      const [categories, customMappings] = await Promise.all([
        this.db.find('categories', {}),
        this.db.find('customCategoryMappings', {})
      ])

      return {
        categories: categories,
        customMappings: customMappings,
        exportDate: new Date(),
        version: '1.0'
      }
    })
  }

  async importCategories(importData) {
    return this.db.executeWithRetry(async () => {
      if (!importData.categories || !Array.isArray(importData.categories)) {
        throw new Error('Invalid import data format')
      }

      // Clear existing data (optional - could be made configurable)
      await this.db.remove('categories', {}, { multi: true })
      await this.db.remove('customCategoryMappings', {}, { multi: true })

      // Import categories
      let categoriesImported = 0
      for (const category of importData.categories) {
        await this.db.insert('categories', {
          name: category.name,
          type: category.type
        })
        categoriesImported++
      }

      // Import custom mappings
      let mappingsImported = 0
      if (importData.customMappings && importData.customMappings.length > 0) {
        for (const mapping of importData.customMappings) {
          await this.db.insert('customCategoryMappings', {
            appIdentifier: mapping.appIdentifier,
            customCategory: mapping.customCategory
          })
          mappingsImported++
        }
      }

      return {
        success: true,
        categoriesImported: categoriesImported,
        mappingsImported: mappingsImported
      }
    })
  }
}

module.exports = LocalCategoriesService
