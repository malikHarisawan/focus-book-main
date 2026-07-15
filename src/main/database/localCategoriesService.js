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

  // Add or update a category. `type` is required; color/icon optional. Upserts by
  // name so this doubles as create-or-edit for the settings UI.
  async addCategory(name, type, color, icon) {
    return this.db.executeWithRetry(async () => {
      const existing = await this.db.findOne('categories', { name: name })
      const fields = { type }
      if (color !== undefined) fields.color = color
      if (icon !== undefined) fields.icon = icon

      if (existing) {
        await this.db.update('categories', { name: name }, { $set: fields })
        return true
      } else {
        await this.db.insert('categories', { name, ...fields })
        return true
      }
    })
  }

  // Update an existing category's type/color/icon by name.
  async updateCategory(name, updates) {
    return this.db.executeWithRetry(async () => {
      // Back-compat: callers used to pass a bare type string.
      const set =
        typeof updates === 'string'
          ? { type: updates }
          : {
              ...(updates.type !== undefined ? { type: updates.type } : {}),
              ...(updates.color !== undefined ? { color: updates.color } : {}),
              ...(updates.icon !== undefined ? { icon: updates.icon } : {})
            }
      if (Object.keys(set).length === 0) return false
      const result = await this.db.update('categories', { name: name }, { $set: set })
      return (result.numReplaced || result) > 0
    })
  }

  async deleteCategory(name) {
    return this.db.executeWithRetry(async () => {
      const result = await this.db.remove('categories', { name: name })
      return result > 0
    })
  }

  // --- Work-modes (Level 2) ---
  // The five work-modes and their metadata are seeded in schema.sql; the renderer
  // reads them to drive the mode donut/drill-down palette and the mode -> verdict
  // rollup. Shape: { name, rollup, color, icon }. rollup is the source of truth for
  // mode -> Level-1 (productive/neutral/distracted) so the AreaChart bands stay in
  // sync without any hardcoded mapping in the renderer.
  async getModes() {
    return this.db.executeWithRetry(async () => {
      const modes = await this.db.find('modes', {}, { sort: { name: 1 } })
      return modes.map((m) => ({
        name: m.name,
        rollup: m.rollup,
        color: m.color || null,
        icon: m.icon || null
      }))
    })
  }

  // Update a mode's presentation/rollup by name (color/icon/rollup). The five mode
  // names are fixed by the schema CHECK, so there is no add/delete — only edit.
  async updateMode(name, updates) {
    return this.db.executeWithRetry(async () => {
      const set = {}
      if (updates.rollup !== undefined) set.rollup = updates.rollup
      if (updates.color !== undefined) set.color = updates.color
      if (updates.icon !== undefined) set.icon = updates.icon
      if (Object.keys(set).length === 0) return false
      const result = await this.db.update('modes', { name: name }, { $set: set })
      return (result.numReplaced || result) > 0
    })
  }

  // The category -> default_mode lookup used by getMode's fallback layer. Returns a
  // plain map { categoryName: modeName } so the renderer/preload can resolve a mode
  // for any category without a per-row lookup.
  async getCategoryDefaultModes() {
    return this.db.executeWithRetry(async () => {
      const categories = await this.db.find('categories', {})
      const map = {}
      categories.forEach((c) => {
        if (c && c.name && c.default_mode) map[c.name] = c.default_mode
      })
      return map
    })
  }

  // --- Per-app work-mode (Level 2) overrides ---
  // Mirrors the custom-category-mapping methods but for MODE. The preload loads
  // these into an in-memory map that getMode consults first (before rule/scorer/
  // default), so a user pin takes effect on the next tracking tick. Keyed by the
  // same identifier getMode looks up (appKey / domain / exe).

  // Return all overrides as a plain { appIdentifier: modeName } map.
  async getModeOverrides() {
    return this.db.executeWithRetry(async () => {
      const overrides = await this.db.find('modeOverrides', {})
      const result = {}
      overrides.forEach((o) => {
        if (o && o.appIdentifier && o.mode) result[o.appIdentifier] = o.mode
      })
      return result
    })
  }

  // Upsert a per-app mode override. Returns true on success.
  async setModeOverride(appIdentifier, mode) {
    return this.db.executeWithRetry(async () => {
      if (!appIdentifier || !mode) return false
      const existing = await this.db.findOne('modeOverrides', { appIdentifier })
      if (existing) {
        await this.db.update('modeOverrides', { appIdentifier }, { $set: { mode } })
      } else {
        await this.db.insert('modeOverrides', { appIdentifier, mode })
      }
      return true
    })
  }

  // Remove a per-app mode override so the app falls back to rule/scorer/default.
  async removeModeOverride(appIdentifier) {
    return this.db.executeWithRetry(async () => {
      const result = await this.db.remove('modeOverrides', { appIdentifier })
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

  // Return all classification rules. The preload sorts them for matching; here we
  // just surface the rows with a stable shape { id, pattern, category, match_type,
  // priority, mode }. id is included so the settings UI can edit/delete specific
  // rules. `mode` is the optional Level-2 override (null when the rule doesn't pin
  // a work-mode; getMode then falls back to the category's default_mode).
  async getCategoryRules() {
    return this.db.executeWithRetry(async () => {
      const rules = await this.db.find('categoryRules', {})
      return rules.map((r) => ({
        id: r._id,
        pattern: r.pattern,
        category: r.category,
        match_type: r.match_type || r.matchType,
        priority: typeof r.priority === 'number' ? r.priority : 0,
        mode: r.mode || null
      }))
    })
  }

  // Add a classification rule. Returns true on insert, false if an identical
  // (pattern, match_type) already exists (the table's UNIQUE constraint).
  // `mode` (optional) pins a Level-2 work-mode on the rule; null/undefined leaves
  // it unset so getMode falls back to the category's default_mode.
  async addCategoryRule(pattern, category, matchType = 'keyword', priority = 0, mode = null) {
    return this.db.executeWithRetry(async () => {
      const existing = await this.db.findOne('categoryRules', {
        pattern: pattern,
        match_type: matchType
      })
      if (existing) return false
      const row = {
        pattern: pattern,
        category: category,
        match_type: matchType,
        priority: priority
      }
      if (mode) row.mode = mode
      await this.db.insert('categoryRules', row)
      return true
    })
  }

  // Insert a rule, or if one with the same (pattern, match_type) already exists,
  // update its category. Used by the "change category from Activity/Dashboard"
  // flow, which turns a per-app tweak into a persistent classification rule.
  // Returns { id, created } — created=true if a new rule was inserted.
  async upsertCategoryRule(pattern, category, matchType = 'keyword', priority = 0) {
    return this.db.executeWithRetry(async () => {
      const existing = await this.db.findOne('categoryRules', {
        pattern: pattern,
        match_type: matchType
      })
      if (existing) {
        if (existing.category !== category) {
          await this.db.update(
            'categoryRules',
            { _id: existing._id },
            { $set: { category: category } }
          )
        }
        return { id: existing._id, created: false }
      }
      const inserted = await this.db.insert('categoryRules', {
        pattern: pattern,
        category: category,
        match_type: matchType,
        priority: priority
      })
      return { id: inserted && (inserted._id || inserted.id), created: true }
    })
  }

  // Update a rule's category/priority by its id.
  async updateCategoryRule(id, updates) {
    return this.db.executeWithRetry(async () => {
      const set = {}
      if (updates.category !== undefined) set.category = updates.category
      if (updates.priority !== undefined) set.priority = updates.priority
      if (updates.pattern !== undefined) set.pattern = updates.pattern
      if (updates.match_type !== undefined) set.match_type = updates.match_type
      if (updates.mode !== undefined) set.mode = updates.mode
      if (Object.keys(set).length === 0) return false
      const result = await this.db.update('categoryRules', { _id: id }, { $set: set })
      return (result.numReplaced || 0) > 0
    })
  }

  // Delete a rule by its id.
  async deleteCategoryRule(id) {
    return this.db.executeWithRetry(async () => {
      const result = await this.db.remove('categoryRules', { _id: id })
      return result > 0
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

  async getExclusionList() {
    return this.db.executeWithRetry(async () => {
      const excludedItems = await this.db.find('exclusionList', {});
      const apps = excludedItems.filter(item => item.type === 'app').map(item => item.identifier);
      const domains = excludedItems.filter(item => item.type === 'domain').map(item => item.identifier);
      return { apps, domains };
    });
  }

  async addToExclusionList(identifier, type) {
    return this.db.executeWithRetry(async () => {
      const existing = await this.db.findOne('exclusionList', { identifier, type });
      if (!existing) {
        await this.db.insert('exclusionList', { identifier, type });
        return true;
      }
      return false; // Already exists
    });
  }

  async removeFromExclusionList(identifier, type) {
    return this.db.executeWithRetry(async () => {
      const result = await this.db.remove('exclusionList', { identifier, type });
      return result > 0;
    });
  }

  async isExcluded(identifier, type) {
    return this.db.executeWithRetry(async () => {
      const existing = await this.db.findOne('exclusionList', { identifier, type });
      return !!existing;
    });
  }

  async clearExclusionList() {
    return this.db.executeWithRetry(async () => {
      const result = await this.db.remove('exclusionList', {}, { multi: true });
      return result;
    });
  }
}

module.exports = LocalCategoriesService
