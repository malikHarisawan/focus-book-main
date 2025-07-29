/**
 * Local App Usage Service
 *
 * This service handles all application usage tracking and analytics using SQLite
 * as the storage backend. It provides methods for recording app usage data,
 * retrieving statistics, and managing productivity metrics.
 *
 * Key Responsibilities:
 * - Recording application usage by time periods
 * - Categorizing applications as productive/neutral/distracting
 * - Generating usage statistics and reports
 * - Managing timestamps and duration tracking
 *
 * Data Structure:
 * - Stores usage data by date and hour granularity
 * - Tracks app names, categories, domains, and time spent
 * - Maintains timestamps for detailed session tracking
 *
 * @author FocusBook Team
 * @version 3.0.0
 */

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
        date: new Date(date).toISOString().split('T')[0], // Store as ISO date string
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

  async getFocusQualityData(date, startHour = 9, endHour = 17) {
    return this.db.executeWithRetry(async () => {
      const dateStr = new Date(date).toISOString().split('T')[0]
      
      // Get all app usage records for the date with timestamps
      const appUsageRecords = await this.db.find('appUsage', {
        date: dateStr,
        hour: { $gte: startHour, $lte: endHour }
      }, { sort: { hour: 1 } })

      if (!appUsageRecords || appUsageRecords.length === 0) {
        return []
      }

      // Process each hour to calculate focus quality
      const focusQualityData = []
      
      for (let hour = startHour; hour <= endHour; hour++) {
        const hourRecords = appUsageRecords.filter(record => record.hour === hour)
        
        if (hourRecords.length === 0) {
          continue
        }

        // Create 5-minute segments for this hour
        for (let segment = 0; segment < 12; segment++) { // 12 segments of 5 minutes each
          const segmentStart = hour + (segment * 5) / 60
          const segmentEnd = hour + ((segment + 1) * 5) / 60
          
          const segmentData = this.calculateSegmentFocusQuality(
            hourRecords, 
            segmentStart, 
            segmentEnd, 
            dateStr, 
            hour, 
            segment
          )
          
          if (segmentData) {
            focusQualityData.push(segmentData)
          }
        }
      }

      return focusQualityData
    })
  }

  calculateSegmentFocusQuality(hourRecords, segmentStart, segmentEnd, date, hour, segment) {
    // Get all apps active during this segment with their timestamps
    const activeApps = []
    let totalSwitches = 0
    let productiveToDistractedSwitches = 0
    let continuousSessions = []
    
    hourRecords.forEach(record => {
      if (record.timestamps && record.timestamps.length > 0) {
        // Filter timestamps that fall within this 5-minute segment
        const segmentTimestamps = record.timestamps.filter(ts => {
          const tsTime = new Date(ts.start).getHours() + new Date(ts.start).getMinutes() / 60
          return tsTime >= segmentStart && tsTime < segmentEnd
        })

        if (segmentTimestamps.length > 0) {
          const totalDuration = segmentTimestamps.reduce((sum, ts) => sum + (ts.duration || 0), 0)
          
          activeApps.push({
            name: record.appName,
            category: record.category,
            duration: totalDuration,
            timestamps: segmentTimestamps,
            productivity: this.getCategoryProductivity(record.category)
          })
        }
      } else if (record.timeSpent > 0) {
        // Fallback for records without detailed timestamps
        activeApps.push({
          name: record.appName,
          category: record.category,
          duration: record.timeSpent,
          timestamps: [],
          productivity: this.getCategoryProductivity(record.category)
        })
      }
    })

    if (activeApps.length === 0) {
      return null
    }

    // Calculate app switching patterns
    const switches = this.calculateAppSwitches(activeApps)
    totalSwitches = switches.total
    productiveToDistractedSwitches = switches.productiveToDistracted

    // Calculate continuous sessions
    continuousSessions = this.findContinuousSessions(activeApps)

    // Calculate focus quality score (0-100)
    const focusScore = this.calculateFocusScore({
      totalSwitches,
      productiveToDistractedSwitches,
      continuousSessions,
      activeApps,
      segmentDuration: 5 // 5 minutes
    })

    return {
      timeSegment: `${hour.toString().padStart(2, '0')}:${(segment * 5).toString().padStart(2, '0')}-${hour.toString().padStart(2, '0')}:${((segment + 1) * 5).toString().padStart(2, '0')}`,
      startTime: segmentStart,
      endTime: segmentEnd,
      apps: activeApps.map(app => ({
        name: app.name,
        category: app.category,
        duration: app.duration,
        productivity: app.productivity
      })),
      switches: totalSwitches,
      productiveToDistractedSwitches,
      continuousSessions: continuousSessions.length,
      longestSession: Math.max(...continuousSessions.map(s => s.duration), 0),
      focusQuality: focusScore,
      qualityLevel: this.getFocusQualityLevel(focusScore),
      qualityFactors: {
        switchPenalty: totalSwitches * -5 + productiveToDistractedSwitches * -10,
        durationBonus: this.calculateDurationBonus(continuousSessions),
        categoryMix: this.analyzeCategoryMix(activeApps)
      }
    }
  }

  calculateAppSwitches(activeApps) {
    if (activeApps.length <= 1) {
      return { total: 0, productiveToDistracted: 0 }
    }

    // Sort apps by their first timestamp to determine switching order
    const sortedApps = activeApps
      .filter(app => app.timestamps && app.timestamps.length > 0)
      .sort((a, b) => {
        const aTime = new Date(a.timestamps[0].start).getTime()
        const bTime = new Date(b.timestamps[0].start).getTime()
        return aTime - bTime
      })

    let totalSwitches = Math.max(0, sortedApps.length - 1)
    let productiveToDistracted = 0

    // Count productive to distracted switches
    for (let i = 0; i < sortedApps.length - 1; i++) {
      const currentApp = sortedApps[i]
      const nextApp = sortedApps[i + 1]
      
      if (currentApp.productivity === 'productive' && nextApp.productivity === 'distracted') {
        productiveToDistracted++
      }
    }

    return { total: totalSwitches, productiveToDistracted }
  }

  findContinuousSessions(activeApps) {
    const sessions = []
    
    activeApps.forEach(app => {
      if (app.duration >= 120000) { // At least 2 minutes
        sessions.push({
          app: app.name,
          duration: app.duration,
          category: app.category,
          productivity: app.productivity
        })
      }
    })

    return sessions
  }

  calculateFocusScore({ totalSwitches, productiveToDistractedSwitches, continuousSessions, activeApps, segmentDuration }) {
    let score = 100 // Base score

    // Switch penalties
    score -= totalSwitches * 5 // -5 for each switch
    score -= productiveToDistractedSwitches * 10 // Additional -10 for productive->distracted

    // Duration bonuses
    continuousSessions.forEach(session => {
      if (session.duration >= 600000) { // 10+ minutes
        score += 10
      } else if (session.duration >= 300000) { // 5+ minutes
        score += 5
      }
    })

    // Productive app bonus
    const productiveTime = activeApps
      .filter(app => app.productivity === 'productive')
      .reduce((sum, app) => sum + app.duration, 0)
    
    const productiveRatio = productiveTime / (segmentDuration * 60 * 1000)
    if (productiveRatio > 0.8) {
      score += 15 // High productive time bonus
    } else if (productiveRatio > 0.5) {
      score += 5
    }

    // Ensure score is within bounds
    return Math.max(0, Math.min(100, Math.round(score)))
  }

  calculateDurationBonus(continuousSessions) {
    return continuousSessions.reduce((bonus, session) => {
      if (session.duration >= 600000) return bonus + 10
      if (session.duration >= 300000) return bonus + 5
      return bonus
    }, 0)
  }

  analyzeCategoryMix(activeApps) {
    const categories = [...new Set(activeApps.map(app => app.productivity))]
    
    if (categories.length === 1) {
      return categories[0] === 'productive' ? 'focused' : categories[0] === 'distracted' ? 'distracted' : 'neutral'
    } else if (categories.includes('productive') && categories.includes('distracted')) {
      return 'mixed'
    } else {
      return 'varied'
    }
  }

  getCategoryProductivity(category) {
    const productiveCategories = ['Code', 'Documenting', 'Learning']
    const distractedCategories = ['Entertainment', 'Messaging', 'Communication', 'Browsing']
    
    if (productiveCategories.includes(category)) return 'productive'
    if (distractedCategories.includes(category)) return 'distracted'
    return 'neutral'
  }

  getFocusQualityLevel(score) {
    if (score >= 80) return 'high'
    if (score >= 50) return 'medium'
    return 'low'
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
