class LocalAppUsageService {
  constructor(dbConnection) {
    this.db = dbConnection
  }

  async saveAppUsage(
    date,
    hour,
    appName,
    timeSpent,
    category,
    description = null,
    domain = null,
    timestamps = []
  ) {
    return this.db.executeWithRetry(async () => {
      const query = {
        date: new Date(date).toISOString().split('T')[0], // Store as string for NeDB
        appName: appName
      }

      if (hour !== null) {
        query.hour = hour
      }

      const existingRecord = await this.db.findOne('appUsage', query)

      if (existingRecord) {
        // Update existing record - ADD time instead of overwriting
        const updateData = {
          $set: {
            timeSpent: existingRecord.timeSpent + timeSpent,
            category: category,
            description: description,
            domain: domain,
            timestamps: [...(existingRecord.timestamps || []), ...timestamps]
          }
        }

        await this.db.update('appUsage', { _id: existingRecord._id }, updateData)
        return existingRecord._id
      } else {
        // Insert new record
        const newRecord = {
          date: new Date(date).toISOString().split('T')[0],
          hour: hour,
          appName: appName,
          timeSpent: timeSpent,
          category: category,
          description: description,
          domain: domain,
          timestamps: timestamps || []
        }

        const savedRecord = await this.db.insert('appUsage', newRecord)
        return savedRecord._id
      }
    })
  }

  async getAppUsageData(startDate = null, endDate = null) {
    return this.db.executeWithRetry(async () => {
      let query = {}

      if (startDate && endDate) {
        query.date = {
          $gte: new Date(startDate).toISOString().split('T')[0],
          $lte: new Date(endDate).toISOString().split('T')[0]
        }
      } else if (startDate) {
        query.date = { $gte: new Date(startDate).toISOString().split('T')[0] }
      } else if (endDate) {
        query.date = { $lte: new Date(endDate).toISOString().split('T')[0] }
      }

      const results = await this.db.find('appUsage', query, { sort: { date: -1, hour: -1 } })

      // Transform NeDB data to match expected format
      const formattedData = {}

      results.forEach((record) => {
        const dateStr = record.date
        const hourKey =
          record.hour !== null && record.hour !== undefined
            ? `${record.hour.toString().padStart(2, '0')}:00`
            : null

        if (!formattedData[dateStr]) {
          formattedData[dateStr] = { apps: {} }
        }

        if (hourKey) {
          if (!formattedData[dateStr][hourKey]) {
            formattedData[dateStr][hourKey] = {}
          }

          formattedData[dateStr][hourKey][record.appName] = {
            time: record.timeSpent,
            category: record.category,
            description: record.description,
            domain: record.domain,
            timestamps: record.timestamps || []
          }
        } else {
          formattedData[dateStr].apps[record.appName] = {
            time: record.timeSpent,
            category: record.category,
            description: record.description,
            domain: record.domain,
            timestamps: record.timestamps || []
          }
        }
      })

      return formattedData
    })
  }

  async getAppUsageForDate(date) {
    return this.db.executeWithRetry(async () => {
      const dateStr = new Date(date).toISOString().split('T')[0]
      const results = await this.db.find('appUsage', { date: dateStr }, { sort: { hour: -1 } })

      const dateData = { apps: {} }

      results.forEach((record) => {
        if (record.hour !== null && record.hour !== undefined) {
          const hourKey = record.hour.toString().padStart(2, '0') + ':00'
          if (!dateData[hourKey]) {
            dateData[hourKey] = {}
          }

          dateData[hourKey][record.appName] = {
            time: record.timeSpent,
            category: record.category,
            description: record.description,
            domain: record.domain,
            timestamps: record.timestamps || []
          }
        } else {
          dateData.apps[record.appName] = {
            time: record.timeSpent,
            category: record.category,
            description: record.description,
            domain: record.domain,
            timestamps: record.timestamps || []
          }
        }
      })

      return dateData
    })
  }

  async bulkUpdateAppUsageData(appUsageData) {
    return this.db.executeWithRetry(async () => {
      for (const [dateStr, dayData] of Object.entries(appUsageData)) {
        const date = new Date(dateStr).toISOString().split('T')[0]

        // Process daily apps data
        if (dayData.apps) {
          for (const [appName, appData] of Object.entries(dayData.apps)) {
            const query = {
              date: date,
              appName: appName,
              hour: null
            }

            const existingRecord = await this.db.findOne('appUsage', query)

            if (existingRecord) {
              await this.db.update(
                'appUsage',
                { _id: existingRecord._id },
                {
                  $set: {
                    timeSpent: appData.time,
                    category: appData.category,
                    description: appData.description,
                    domain: appData.domain,
                    timestamps: appData.timestamps || []
                  }
                }
              )
            } else {
              await this.db.insert('appUsage', {
                date: date,
                hour: null,
                appName: appName,
                timeSpent: appData.time,
                category: appData.category,
                description: appData.description,
                domain: appData.domain,
                timestamps: appData.timestamps || []
              })
            }
          }
        }

        // Process hourly data
        for (const [key, value] of Object.entries(dayData)) {
          if (key !== 'apps' && key.match(/^\d{2}:\d{2}$/)) {
            const hour = parseInt(key.split(':')[0])

            for (const [appName, appData] of Object.entries(value)) {
              const query = {
                date: date,
                hour: hour,
                appName: appName
              }

              const existingRecord = await this.db.findOne('appUsage', query)

              if (existingRecord) {
                await this.db.update(
                  'appUsage',
                  { _id: existingRecord._id },
                  {
                    $set: {
                      timeSpent: appData.time,
                      category: appData.category,
                      description: appData.description,
                      domain: appData.domain,
                      timestamps: appData.timestamps || []
                    }
                  }
                )
              } else {
                await this.db.insert('appUsage', {
                  date: date,
                  hour: hour,
                  appName: appName,
                  timeSpent: appData.time,
                  category: appData.category,
                  description: appData.description,
                  domain: appData.domain,
                  timestamps: appData.timestamps || []
                })
              }
            }
          }
        }
      }

      return true
    })
  }

  async deleteAppUsageData(date, appName = null, hour = null) {
    return this.db.executeWithRetry(async () => {
      const dateStr = new Date(date).toISOString().split('T')[0]
      let query = { date: dateStr }

      if (appName) {
        query.appName = appName

        if (hour !== null) {
          query.hour = hour
        }
      }

      const result = await this.db.remove('appUsage', query, { multi: true })
      return result
    })
  }

  async getAppUsageStats(startDate, endDate) {
    return this.db.executeWithRetry(async () => {
      const startDateStr = new Date(startDate).toISOString().split('T')[0]
      const endDateStr = new Date(endDate).toISOString().split('T')[0]

      const results = await this.db.find('appUsage', {
        date: { $gte: startDateStr, $lte: endDateStr }
      })

      // Group by category
      const categoryStats = {}

      results.forEach((record) => {
        if (!categoryStats[record.category]) {
          categoryStats[record.category] = {
            category: record.category,
            total_time: 0,
            app_count: new Set(),
            session_count: 0
          }
        }

        categoryStats[record.category].total_time += record.timeSpent
        categoryStats[record.category].app_count.add(record.appName)
        categoryStats[record.category].session_count += 1
      })

      // Convert to array format
      return Object.values(categoryStats)
        .map((stat) => ({
          category: stat.category,
          total_time: stat.total_time,
          app_count: stat.app_count.size,
          session_count: stat.session_count
        }))
        .sort((a, b) => b.total_time - a.total_time)
    })
  }

  async getTopApps(startDate, endDate, limit = 10) {
    return this.db.executeWithRetry(async () => {
      const startDateStr = new Date(startDate).toISOString().split('T')[0]
      const endDateStr = new Date(endDate).toISOString().split('T')[0]

      const results = await this.db.find('appUsage', {
        date: { $gte: startDateStr, $lte: endDateStr }
      })

      // Group by app
      const appStats = {}

      results.forEach((record) => {
        const key = `${record.appName}-${record.category}`
        if (!appStats[key]) {
          appStats[key] = {
            app_name: record.appName,
            category: record.category,
            total_time: 0,
            session_count: 0
          }
        }

        appStats[key].total_time += record.timeSpent
        appStats[key].session_count += 1
      })

      // Convert to array and sort
      return Object.values(appStats)
        .sort((a, b) => b.total_time - a.total_time)
        .slice(0, limit)
    })
  }

  async getDailyStats(date) {
    return this.db.executeWithRetry(async () => {
      const dateStr = new Date(date).toISOString().split('T')[0]
      const results = await this.db.find('appUsage', { date: dateStr })

      // Group by category
      const categoryStats = {}

      results.forEach((record) => {
        if (!categoryStats[record.category]) {
          categoryStats[record.category] = {
            category: record.category,
            totalTime: 0,
            apps: new Set()
          }
        }

        categoryStats[record.category].totalTime += record.timeSpent
        categoryStats[record.category].apps.add(record.appName)
      })

      // Convert to array format
      return Object.values(categoryStats)
        .map((stat) => ({
          category: stat.category,
          totalTime: stat.totalTime,
          appCount: stat.apps.size
        }))
        .sort((a, b) => b.totalTime - a.totalTime)
    })
  }

  async getHourlyBreakdown(date) {
    return this.db.executeWithRetry(async () => {
      const dateStr = new Date(date).toISOString().split('T')[0]
      const results = await this.db.find(
        'appUsage',
        {
          date: dateStr,
          hour: { $ne: null }
        },
        { sort: { hour: 1 } }
      )

      const hourlyData = {}

      results.forEach((record) => {
        const hour = record.hour
        if (!hourlyData[hour]) {
          hourlyData[hour] = {
            totalTime: 0,
            apps: {},
            categories: {}
          }
        }

        hourlyData[hour].totalTime += record.timeSpent
        hourlyData[hour].apps[record.appName] = record.timeSpent

        if (!hourlyData[hour].categories[record.category]) {
          hourlyData[hour].categories[record.category] = 0
        }
        hourlyData[hour].categories[record.category] += record.timeSpent
      })

      return hourlyData
    })
  }

  async updateAppCategory(appName, date, newCategory) {
    return this.db.executeWithRetry(async () => {
      const dateStr = new Date(date).toISOString().split('T')[0]
      const result = await this.db.update(
        'appUsage',
        { appName: appName, date: dateStr },
        { $set: { category: newCategory } },
        { multi: true }
      )

      return result.numReplaced
    })
  }

  async getAppUsageByCategory(category, startDate, endDate) {
    return this.db.executeWithRetry(async () => {
      let query = { category: category }

      if (startDate && endDate) {
        query.date = {
          $gte: new Date(startDate).toISOString().split('T')[0],
          $lte: new Date(endDate).toISOString().split('T')[0]
        }
      }

      const results = await this.db.find('appUsage', query, { sort: { date: -1, hour: -1 } })
      return results
    })
  }

  async getProductivityTrend(days = 7) {
    return this.db.executeWithRetry(async () => {
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

      const results = await this.db.find('appUsage', {
        date: { $gte: startDateStr, $lte: endDateStr }
      })

      // Group by date and category
      const dateGroups = {}

      results.forEach((record) => {
        if (!dateGroups[record.date]) {
          dateGroups[record.date] = {}
        }

        if (!dateGroups[record.date][record.category]) {
          dateGroups[record.date][record.category] = 0
        }

        dateGroups[record.date][record.category] += record.timeSpent
      })

      // Convert to expected format
      return Object.entries(dateGroups)
        .map(([date, categories]) => ({
          _id: date,
          categories: Object.entries(categories).map(([category, time]) => ({
            category,
            time
          }))
        }))
        .sort((a, b) => a._id.localeCompare(b._id))
    })
  }

  async cleanupOldData(daysToKeep = 90) {
    return this.db.executeWithRetry(async () => {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

      const result = await this.db.remove(
        'appUsage',
        {
          date: { $lt: cutoffDateStr }
        },
        { multi: true }
      )

      console.log(`Cleaned up ${result} old records older than ${daysToKeep} days`)
      return result
    })
  }
}

module.exports = LocalAppUsageService
