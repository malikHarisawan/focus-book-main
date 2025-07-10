const { dbConnection } = require('./connection')
const { AppUsage } = require('./models')

class AppUsageService {
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
    return dbConnection.executeWithRetry(async () => {
      const query = {
        date: new Date(date),
        appName: appName
      }

      if (hour !== null) {
        query.hour = hour
      }

      const existingRecord = await AppUsage.findOne(query)

      if (existingRecord) {
        // Update existing record - ADD time instead of overwriting
        existingRecord.timeSpent += timeSpent
        existingRecord.category = category
        existingRecord.description = description
        existingRecord.domain = domain
        existingRecord.timestamps.push(...timestamps)

        await existingRecord.save()
        return existingRecord._id
      } else {
        // Insert new record
        const newRecord = new AppUsage({
          date: new Date(date),
          hour: hour,
          appName: appName,
          timeSpent: timeSpent,
          category: category,
          description: description,
          domain: domain,
          timestamps: timestamps || []
        })

        const savedRecord = await newRecord.save()
        return savedRecord._id
      }
    })
  }

  async getAppUsageData(startDate = null, endDate = null) {
    return dbConnection.executeWithRetry(async () => {
      const results = await AppUsage.findByDateRange(startDate, endDate)

      // Transform Mongoose data to match expected format
      const formattedData = {}

      results.forEach((record) => {
        // Manually format date and hour since .lean() removes virtual fields
        const dateStr = record.date.toISOString().split('T')[0]
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
    return dbConnection.executeWithRetry(async () => {
      const results = await AppUsage.find({ date: new Date(date) })
        .sort({ hour: -1 })
        .lean()

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
    return dbConnection.executeWithRetry(async () => {
      const bulkOps = []

      for (const [dateStr, dayData] of Object.entries(appUsageData)) {
        const date = new Date(dateStr)

        // Process daily apps data
        if (dayData.apps) {
          for (const [appName, appData] of Object.entries(dayData.apps)) {
            const filter = {
              date: date,
              appName: appName,
              hour: { $exists: false }
            }

            const update = {
              $set: {
                timeSpent: appData.time,
                category: appData.category,
                description: appData.description,
                domain: appData.domain,
                timestamps: appData.timestamps || []
              }
            }

            const options = { upsert: true }

            bulkOps.push({
              updateOne: {
                filter: filter,
                update: update,
                upsert: options.upsert
              }
            })
          }
        }

        // Process hourly data
        for (const [key, value] of Object.entries(dayData)) {
          if (key !== 'apps' && key.match(/^\d{2}:\d{2}$/)) {
            const hour = parseInt(key.split(':')[0])

            for (const [appName, appData] of Object.entries(value)) {
              const filter = {
                date: date,
                hour: hour,
                appName: appName
              }

              const update = {
                $set: {
                  timeSpent: appData.time,
                  category: appData.category,
                  description: appData.description,
                  domain: appData.domain,
                  timestamps: appData.timestamps || []
                }
              }

              bulkOps.push({
                updateOne: {
                  filter: filter,
                  update: update,
                  upsert: true
                }
              })
            }
          }
        }
      }

      if (bulkOps.length > 0) {
        const result = await AppUsage.bulkWrite(bulkOps, { ordered: false })
        console.log(
          `Bulk update completed: ${result.modifiedCount} updated, ${result.upsertedCount} inserted`
        )
        return true
      }

      return true
    })
  }

  async deleteAppUsageData(date, appName = null, hour = null) {
    return dbConnection.executeWithRetry(async () => {
      let query = { date: new Date(date) }

      if (appName) {
        query.appName = appName

        if (hour !== null) {
          query.hour = hour
        }
      }

      const result = await AppUsage.deleteMany(query)
      return result.deletedCount
    })
  }

  async getAppUsageStats(startDate, endDate) {
    return dbConnection.executeWithRetry(async () => {
      const pipeline = [
        {
          $match: {
            date: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        },
        {
          $group: {
            _id: '$category',
            totalTime: { $sum: '$timeSpent' },
            appCount: { $addToSet: '$appName' },
            sessionCount: { $sum: 1 }
          }
        },
        {
          $project: {
            category: '$_id',
            total_time: '$totalTime',
            app_count: { $size: '$appCount' },
            session_count: '$sessionCount',
            _id: 0
          }
        },
        {
          $sort: { total_time: -1 }
        }
      ]

      const results = await AppUsage.aggregate(pipeline)
      return results
    })
  }

  async getTopApps(startDate, endDate, limit = 10) {
    return dbConnection.executeWithRetry(async () => {
      const pipeline = [
        {
          $match: {
            date: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        },
        {
          $group: {
            _id: {
              appName: '$appName',
              category: '$category'
            },
            totalTime: { $sum: '$timeSpent' },
            sessionCount: { $sum: 1 }
          }
        },
        {
          $project: {
            app_name: '$_id.appName',
            category: '$_id.category',
            total_time: '$totalTime',
            session_count: '$sessionCount',
            _id: 0
          }
        },
        {
          $sort: { total_time: -1 }
        },
        {
          $limit: limit
        }
      ]

      const results = await AppUsage.aggregate(pipeline)
      return results
    })
  }

  async getDailyStats(date) {
    return dbConnection.executeWithRetry(async () => {
      const pipeline = [
        {
          $match: {
            date: new Date(date)
          }
        },
        {
          $group: {
            _id: '$category',
            totalTime: { $sum: '$timeSpent' },
            apps: { $addToSet: '$appName' }
          }
        },
        {
          $project: {
            category: '$_id',
            totalTime: 1,
            appCount: { $size: '$apps' },
            _id: 0
          }
        },
        {
          $sort: { totalTime: -1 }
        }
      ]

      const results = await AppUsage.aggregate(pipeline)
      return results
    })
  }

  async getHourlyBreakdown(date) {
    return dbConnection.executeWithRetry(async () => {
      const results = await AppUsage.find({
        date: new Date(date),
        hour: { $exists: true, $ne: null }
      })
        .sort({ hour: 1 })
        .lean()

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

  // New Mongoose-specific methods for better functionality
  async updateAppCategory(appName, date, newCategory) {
    return dbConnection.executeWithRetry(async () => {
      const result = await AppUsage.updateMany(
        {
          appName: appName,
          date: new Date(date)
        },
        {
          $set: { category: newCategory }
        }
      )

      return result.modifiedCount
    })
  }

  async getAppUsageByCategory(category, startDate, endDate) {
    return dbConnection.executeWithRetry(async () => {
      const query = { category: category }

      if (startDate && endDate) {
        query.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }

      const results = await AppUsage.find(query).sort({ date: -1, hour: -1 }).lean()

      return results
    })
  }

  async getProductivityTrend(days = 7) {
    return dbConnection.executeWithRetry(async () => {
      const endDate = new Date()
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

      const pipeline = [
        {
          $match: {
            date: {
              $gte: startDate,
              $lte: endDate
            }
          }
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
              category: '$category'
            },
            totalTime: { $sum: '$timeSpent' }
          }
        },
        {
          $group: {
            _id: '$_id.date',
            categories: {
              $push: {
                category: '$_id.category',
                time: '$totalTime'
              }
            }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]

      const results = await AppUsage.aggregate(pipeline)
      return results
    })
  }

  async cleanupOldData(daysToKeep = 90) {
    return dbConnection.executeWithRetry(async () => {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

      const result = await AppUsage.deleteMany({
        date: { $lt: cutoffDate }
      })

      console.log(`Cleaned up ${result.deletedCount} old records older than ${daysToKeep} days`)
      return result.deletedCount
    })
  }
}

module.exports = new AppUsageService()
