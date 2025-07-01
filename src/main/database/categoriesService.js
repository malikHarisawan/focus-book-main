const { dbConnection } = require('./connection')

class CategoriesService {
  async getCategories() {
    try {
      const result = await dbConnection.query('SELECT name, type FROM categories ORDER BY name')

      const categories = {
        productive: [],
        distracted: [],
        neutral: []
      }

      result.rows.forEach((row) => {
        if (categories[row.type]) {
          categories[row.type].push(row.name)
        }
      })

      return categories
    } catch (error) {
      console.error('Error getting categories:', error)
      throw error
    }
  }

  async getCategoriesForSettings() {
    try {
      const result = await dbConnection.query('SELECT name, type FROM categories ORDER BY name')

      const categories = {
        productive: [],
        distracted: []
      }

      result.rows.forEach((row) => {
        if (row.type === 'productive') {
          categories.productive.push(row.name)
        } else if (row.type === 'distracted') {
          categories.distracted.push(row.name)
        }
      })

      return [categories.productive, categories.distracted]
    } catch (error) {
      console.error('Error getting categories for settings:', error)
      throw error
    }
  }

  async saveCategories(categoriesData) {
    try {
      await dbConnection.transaction(async (client) => {
        await client.query('DELETE FROM categories')

        for (const [type, categoryList] of Object.entries(categoriesData)) {
          if (Array.isArray(categoryList)) {
            for (const categoryName of categoryList) {
              await client.query('INSERT INTO categories (name, type) VALUES ($1, $2)', [
                categoryName,
                type
              ])
            }
          }
        }
      })

      return true
    } catch (error) {
      console.error('Error saving categories:', error)
      throw error
    }
  }

  async addCategory(name, type) {
    try {
      const result = await dbConnection.query(
        'INSERT INTO categories (name, type) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET type = $2 RETURNING id',
        [name, type]
      )

      return result.rows[0]
    } catch (error) {
      console.error('Error adding category:', error)
      throw error
    }
  }

  async updateCategoryType(name, newType) {
    try {
      const result = await dbConnection.query(
        'UPDATE categories SET type = $1 WHERE name = $2 RETURNING id',
        [newType, name]
      )

      return result.rowCount > 0
    } catch (error) {
      console.error('Error updating category type:', error)
      throw error
    }
  }

  async deleteCategory(name) {
    try {
      const result = await dbConnection.query('DELETE FROM categories WHERE name = $1', [name])

      return result.rowCount > 0
    } catch (error) {
      console.error('Error deleting category:', error)
      throw error
    }
  }

  async getCustomCategoryMappings() {
    try {
      const result = await dbConnection.query(
        'SELECT app_identifier, custom_category FROM custom_category_mappings ORDER BY app_identifier'
      )

      const mappings = {}
      result.rows.forEach((row) => {
        mappings[row.app_identifier] = row.custom_category
      })

      return mappings
    } catch (error) {
      console.error('Error getting custom category mappings:', error)
      throw error
    }
  }

  async saveCustomCategoryMappings(mappings) {
    try {
      await dbConnection.transaction(async (client) => {
        await client.query('DELETE FROM custom_category_mappings')

        for (const [appIdentifier, customCategory] of Object.entries(mappings)) {
          await client.query(
            'INSERT INTO custom_category_mappings (app_identifier, custom_category) VALUES ($1, $2)',
            [appIdentifier, customCategory]
          )
        }
      })

      return true
    } catch (error) {
      console.error('Error saving custom category mappings:', error)
      throw error
    }
  }

  async addCustomCategoryMapping(appIdentifier, customCategory) {
    try {
      const result = await dbConnection.query(
        'INSERT INTO custom_category_mappings (app_identifier, custom_category) VALUES ($1, $2) ON CONFLICT (app_identifier) DO UPDATE SET custom_category = $2, updated_at = CURRENT_TIMESTAMP RETURNING id',
        [appIdentifier, customCategory]
      )

      return result.rows[0]
    } catch (error) {
      console.error('Error adding custom category mapping:', error)
      throw error
    }
  }

  async removeCustomCategoryMapping(appIdentifier) {
    try {
      const result = await dbConnection.query(
        'DELETE FROM custom_category_mappings WHERE app_identifier = $1',
        [appIdentifier]
      )

      return result.rowCount > 0
    } catch (error) {
      console.error('Error removing custom category mapping:', error)
      throw error
    }
  }

  async getCustomCategoryForApp(appIdentifier) {
    try {
      const result = await dbConnection.query(
        'SELECT custom_category FROM custom_category_mappings WHERE app_identifier = $1',
        [appIdentifier]
      )

      return result.rows.length > 0 ? result.rows[0].custom_category : null
    } catch (error) {
      console.error('Error getting custom category for app:', error)
      throw error
    }
  }

  async getCategoryType(categoryName) {
    try {
      const result = await dbConnection.query('SELECT type FROM categories WHERE name = $1', [
        categoryName
      ])

      return result.rows.length > 0 ? result.rows[0].type : 'neutral'
    } catch (error) {
      console.error('Error getting category type:', error)
      return 'neutral'
    }
  }

  async getAllCategoryNames() {
    try {
      const result = await dbConnection.query('SELECT DISTINCT name FROM categories ORDER BY name')

      return result.rows.map((row) => row.name)
    } catch (error) {
      console.error('Error getting all category names:', error)
      throw error
    }
  }

  async bulkUpdateAppCategories(appCategoryMap) {
    try {
      await dbConnection.transaction(async (client) => {
        for (const [appName, newCategory] of Object.entries(appCategoryMap)) {
          await client.query('UPDATE app_usage SET category = $1 WHERE app_name = $2', [
            newCategory,
            appName
          ])
        }
      })

      return true
    } catch (error) {
      console.error('Error bulk updating app categories:', error)
      throw error
    }
  }

  async getAppsWithCategory(categoryName) {
    try {
      const result = await dbConnection.query(
        'SELECT DISTINCT app_name FROM app_usage WHERE category = $1 ORDER BY app_name',
        [categoryName]
      )

      return result.rows.map((row) => row.app_name)
    } catch (error) {
      console.error('Error getting apps with category:', error)
      throw error
    }
  }
}

module.exports = new CategoriesService()
