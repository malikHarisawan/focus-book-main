const { dbConnection } = require('./connection')
const { Category, CustomCategoryMapping } = require('./models')

class CategoriesService {
  async saveCategories(categories) {
    return dbConnection.executeWithRetry(async () => {
      const bulkOps = []

      // Handle productive categories
      if (categories.productive && Array.isArray(categories.productive)) {
        for (const categoryName of categories.productive) {
          bulkOps.push({
            updateOne: {
              filter: { name: categoryName },
              update: {
                $set: {
                  name: categoryName,
                  type: 'productive'
                }
              },
              upsert: true
            }
          })
        }
      }

      // Handle distracted categories
      if (categories.distracted && Array.isArray(categories.distracted)) {
        for (const categoryName of categories.distracted) {
          bulkOps.push({
            updateOne: {
              filter: { name: categoryName },
              update: {
                $set: {
                  name: categoryName,
                  type: 'distracted'
                }
              },
              upsert: true
            }
          })
        }
      }

      if (bulkOps.length > 0) {
        const result = await Category.bulkWrite(bulkOps, { ordered: false })
        console.log(
          `Categories saved: ${result.modifiedCount} updated, ${result.upsertedCount} inserted`
        )
        return true
      }

      return false
    })
  }

  async getCategoriesForSettings() {
    return dbConnection.executeWithRetry(async () => {
      const [productiveCategories, distractedCategories] = await Promise.all([
        Category.find({ type: 'productive' }).sort({ name: 1 }).lean(),
        Category.find({ type: 'distracted' }).sort({ name: 1 }).lean()
      ])

      const productive = productiveCategories.map((cat) => cat.name)
      const distracted = distractedCategories.map((cat) => cat.name)

      return [productive, distracted]
    })
  }

  async getAllCategories() {
    return dbConnection.executeWithRetry(async () => {
      const categories = await Category.find({}).sort({ type: 1, name: 1 }).lean()

      return categories
    })
  }

  async getCategoriesByType(type) {
    return dbConnection.executeWithRetry(async () => {
      const categories = await Category.find({ type: type }).sort({ name: 1 }).select('name').lean()

      return categories.map((cat) => cat.name)
    })
  }

  async addCategory(name, type) {
    return dbConnection.executeWithRetry(async () => {
      const category = new Category({ name, type })

      try {
        await category.save()
        return true
      } catch (error) {
        if (error.code === 11000) {
          // Duplicate key error
          // Update existing category
          await Category.updateOne({ name }, { type })
          return true
        }
        throw error
      }
    })
  }

  async updateCategory(name, newType) {
    return dbConnection.executeWithRetry(async () => {
      const result = await Category.updateOne({ name: name }, { $set: { type: newType } })

      return result.modifiedCount > 0
    })
  }

  async deleteCategory(name) {
    return dbConnection.executeWithRetry(async () => {
      const result = await Category.deleteOne({ name: name })
      return result.deletedCount > 0
    })
  }

  async getCustomCategoryMappings() {
    return dbConnection.executeWithRetry(async () => {
      const mappings = await CustomCategoryMapping.find({})
        .select('appIdentifier customCategory')
        .lean()

      const result = {}
      mappings.forEach((mapping) => {
        result[mapping.appIdentifier] = mapping.customCategory
      })

      return result
    })
  }

  async saveCustomCategoryMappings(mappings) {
    return dbConnection.executeWithRetry(async () => {
      if (!mappings || typeof mappings !== 'object') {
        console.log('No valid mappings provided')
        return false
      }

      const bulkOps = []

      for (const [appIdentifier, customCategory] of Object.entries(mappings)) {
        bulkOps.push({
          updateOne: {
            filter: { appIdentifier: appIdentifier },
            update: {
              $set: {
                appIdentifier: appIdentifier,
                customCategory: customCategory
              }
            },
            upsert: true
          }
        })
      }

      if (bulkOps.length > 0) {
        const result = await CustomCategoryMapping.bulkWrite(bulkOps, { ordered: false })
        console.log(
          `Custom mappings saved: ${result.modifiedCount} updated, ${result.upsertedCount} inserted`
        )
        return true
      }

      return false
    })
  }

  async addCustomCategoryMapping(appIdentifier, customCategory) {
    return dbConnection.executeWithRetry(async () => {
      const mapping = new CustomCategoryMapping({ appIdentifier, customCategory })

      try {
        await mapping.save()
        return true
      } catch (error) {
        if (error.code === 11000) {
          // Duplicate key error
          // Update existing mapping
          await CustomCategoryMapping.updateOne({ appIdentifier }, { customCategory })
          return true
        }
        throw error
      }
    })
  }

  async removeCustomCategoryMapping(appIdentifier) {
    return dbConnection.executeWithRetry(async () => {
      const result = await CustomCategoryMapping.deleteOne({ appIdentifier: appIdentifier })
      return result.deletedCount > 0
    })
  }

  async getCustomCategoryMapping(appIdentifier) {
    return dbConnection.executeWithRetry(async () => {
      const mapping = await CustomCategoryMapping.findOne({ appIdentifier: appIdentifier })
        .select('customCategory')
        .lean()

      return mapping ? mapping.customCategory : null
    })
  }

  async clearAllCustomMappings() {
    return dbConnection.executeWithRetry(async () => {
      const result = await CustomCategoryMapping.deleteMany({})
      return result.deletedCount
    })
  }

  async bulkUpdateCustomMappings(mappingsArray) {
    return dbConnection.executeWithRetry(async () => {
      if (!Array.isArray(mappingsArray) || mappingsArray.length === 0) {
        return false
      }

      const bulkOps = mappingsArray.map((mapping) => ({
        updateOne: {
          filter: { appIdentifier: mapping.appIdentifier },
          update: {
            $set: {
              appIdentifier: mapping.appIdentifier,
              customCategory: mapping.customCategory
            }
          },
          upsert: true
        }
      }))

      const result = await CustomCategoryMapping.bulkWrite(bulkOps, { ordered: false })
      console.log(
        `Bulk custom mappings update: ${result.modifiedCount} updated, ${result.upsertedCount} inserted`
      )
      return true
    })
  }

  async getCategoryStats() {
    return dbConnection.executeWithRetry(async () => {
      const [categoryStats, mappingsCount] = await Promise.all([
        Category.aggregate([
          {
            $group: {
              _id: '$type',
              count: { $sum: 1 },
              categories: { $push: '$name' }
            }
          }
        ]),
        CustomCategoryMapping.countDocuments()
      ])

      return {
        categoryStats: categoryStats,
        customMappingsCount: mappingsCount
      }
    })
  }

  async searchCategories(searchTerm) {
    return dbConnection.executeWithRetry(async () => {
      const categories = await Category.find({
        name: { $regex: searchTerm, $options: 'i' }
      })
        .sort({ name: 1 })
        .lean()

      return categories
    })
  }

  async getRecentlyUsedCategories(limit = 10) {
    return dbConnection.executeWithRetry(async () => {
      const { AppUsage } = require('./models') // Import here to avoid circular dependency

      const recentCategories = await AppUsage.aggregate([
        {
          $group: {
            _id: '$category',
            lastUsed: { $max: '$updatedAt' },
            usageCount: { $sum: 1 }
          }
        },
        {
          $sort: { lastUsed: -1 }
        },
        {
          $limit: limit
        },
        {
          $project: {
            category: '$_id',
            lastUsed: 1,
            usageCount: 1,
            _id: 0
          }
        }
      ])

      return recentCategories
    })
  }

  // New Mongoose-specific methods for enhanced functionality
  async getCategoryWithUsageStats(categoryName) {
    return dbConnection.executeWithRetry(async () => {
      const { AppUsage } = require('./models')

      const [category, usageStats] = await Promise.all([
        Category.findOne({ name: categoryName }).lean(),
        AppUsage.aggregate([
          { $match: { category: categoryName } },
          {
            $group: {
              _id: null,
              totalTime: { $sum: '$timeSpent' },
              totalSessions: { $sum: 1 },
              uniqueApps: { $addToSet: '$appName' },
              firstUsed: { $min: '$date' },
              lastUsed: { $max: '$date' }
            }
          }
        ])
      ])

      return {
        category,
        stats: usageStats[0] || {
          totalTime: 0,
          totalSessions: 0,
          uniqueApps: [],
          firstUsed: null,
          lastUsed: null
        }
      }
    })
  }

  async validateCategoryExists(categoryName) {
    return dbConnection.executeWithRetry(async () => {
      const exists = await Category.exists({ name: categoryName })
      return !!exists
    })
  }

  async getCategoriesWithCounts() {
    return dbConnection.executeWithRetry(async () => {
      const result = await Category.aggregate([
        {
          $lookup: {
            from: 'appUsage',
            localField: 'name',
            foreignField: 'category',
            as: 'usage'
          }
        },
        {
          $project: {
            name: 1,
            type: 1,
            usageCount: { $size: '$usage' },
            totalTime: { $sum: '$usage.timeSpent' }
          }
        },
        {
          $sort: { type: 1, name: 1 }
        }
      ])

      return result
    })
  }

  async exportCategories() {
    return dbConnection.executeWithRetry(async () => {
      const [categories, customMappings] = await Promise.all([
        Category.find({}).lean(),
        CustomCategoryMapping.find({}).lean()
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
    return dbConnection.executeWithRetry(async () => {
      if (!importData.categories || !Array.isArray(importData.categories)) {
        throw new Error('Invalid import data format')
      }

      // Use transactions for data integrity
      const session = await dbConnection.startTransaction()

      try {
        // Clear existing data (optional - could be made configurable)
        await Category.deleteMany({}, { session })
        await CustomCategoryMapping.deleteMany({}, { session })

        // Import categories
        if (importData.categories.length > 0) {
          await Category.insertMany(importData.categories, { session })
        }

        // Import custom mappings
        if (importData.customMappings && importData.customMappings.length > 0) {
          await CustomCategoryMapping.insertMany(importData.customMappings, { session })
        }

        await dbConnection.commitTransaction(session)

        return {
          success: true,
          categoriesImported: importData.categories.length,
          mappingsImported: importData.customMappings ? importData.customMappings.length : 0
        }
      } catch (error) {
        await dbConnection.abortTransaction(session)
        throw error
      }
    })
  }
}

module.exports = new CategoriesService()
