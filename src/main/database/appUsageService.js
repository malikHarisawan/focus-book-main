const { dbConnection } = require('./connection')

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
    try {
      const result = await dbConnection.transaction(async (client) => {
        let appUsageId

        const existingRecord = await client.query(
          'SELECT id, time_spent FROM app_usage WHERE date = $1 AND hour = $2 AND app_name = $3',
          [date, hour, appName]
        )

        if (existingRecord.rows.length > 0) {
          const currentTimeSpent = existingRecord.rows[0].time_spent
          const newTimeSpent = currentTimeSpent + timeSpent

          await client.query(
            'UPDATE app_usage SET time_spent = $1, category = $2, description = $3, domain = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5',
            [newTimeSpent, category, description, domain, existingRecord.rows[0].id]
          )

          appUsageId = existingRecord.rows[0].id
        } else {
          const insertResult = await client.query(
            'INSERT INTO app_usage (date, hour, app_name, time_spent, category, description, domain) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [date, hour, appName, timeSpent, category, description, domain]
          )

          appUsageId = insertResult.rows[0].id
        }

        if (timestamps && timestamps.length > 0) {
          for (const timestamp of timestamps) {
            await client.query(
              'INSERT INTO timestamps (app_usage_id, start_time, duration) VALUES ($1, $2, $3)',
              [appUsageId, timestamp.start, timestamp.duration]
            )
          }
        }

        return appUsageId
      })

      return result
    } catch (error) {
      console.error('Error saving app usage:', error)
      throw error
    }
  }

  async getAppUsageData(startDate = null, endDate = null) {
    try {
      let query = `
        SELECT 
          au.date,
          au.hour,
          au.app_name,
          au.time_spent,
          au.category,
          au.description,
          au.domain,
          au.created_at,
          au.updated_at,
          json_agg(
            json_build_object(
              'start', t.start_time,
              'duration', t.duration
            ) ORDER BY t.start_time
          ) FILTER (WHERE t.id IS NOT NULL) as timestamps
        FROM app_usage au
        LEFT JOIN timestamps t ON au.id = t.app_usage_id
      `

      const params = []

      if (startDate && endDate) {
        query += ' WHERE au.date BETWEEN $1 AND $2'
        params.push(startDate, endDate)
      } else if (startDate) {
        query += ' WHERE au.date >= $1'
        params.push(startDate)
      } else if (endDate) {
        query += ' WHERE au.date <= $1'
        params.push(endDate)
      }

      query += ' GROUP BY au.id ORDER BY au.date DESC, au.hour DESC'

      const result = await dbConnection.query(query, params)

      const formattedData = {}

      result.rows.forEach((row) => {
        const dateStr = row.date.toISOString().split('T')[0]

        if (!formattedData[dateStr]) {
          formattedData[dateStr] = { apps: {} }
        }

        if (row.hour !== null) {
          const hourKey = row.hour.toString().padStart(2, '0') + ':00'
          if (!formattedData[dateStr][hourKey]) {
            formattedData[dateStr][hourKey] = {}
          }

          formattedData[dateStr][hourKey][row.app_name] = {
            time: row.time_spent,
            category: row.category,
            description: row.description,
            domain: row.domain,
            timestamps: row.timestamps || []
          }
        } else {
          formattedData[dateStr].apps[row.app_name] = {
            time: row.time_spent,
            category: row.category,
            description: row.description,
            domain: row.domain,
            timestamps: row.timestamps || []
          }
        }
      })

      return formattedData
    } catch (error) {
      console.error('Error getting app usage data:', error)
      throw error
    }
  }

  async getAppUsageForDate(date) {
    try {
      const result = await dbConnection.query(
        `SELECT 
          au.hour,
          au.app_name,
          au.time_spent,
          au.category,
          au.description,
          au.domain,
          json_agg(
            json_build_object(
              'start', t.start_time,
              'duration', t.duration
            ) ORDER BY t.start_time
          ) FILTER (WHERE t.id IS NOT NULL) as timestamps
        FROM app_usage au
        LEFT JOIN timestamps t ON au.id = t.app_usage_id
        WHERE au.date = $1
        GROUP BY au.id
        ORDER BY au.hour DESC`,
        [date]
      )

      const dateData = { apps: {} }

      result.rows.forEach((row) => {
        if (row.hour !== null) {
          const hourKey = row.hour.toString().padStart(2, '0') + ':00'
          if (!dateData[hourKey]) {
            dateData[hourKey] = {}
          }

          dateData[hourKey][row.app_name] = {
            time: row.time_spent,
            category: row.category,
            description: row.description,
            domain: row.domain,
            timestamps: row.timestamps || []
          }
        } else {
          dateData.apps[row.app_name] = {
            time: row.time_spent,
            category: row.category,
            description: row.description,
            domain: row.domain,
            timestamps: row.timestamps || []
          }
        }
      })

      return dateData
    } catch (error) {
      console.error('Error getting app usage for date:', error)
      throw error
    }
  }

  async bulkUpdateAppUsageData(appUsageData) {
    try {
      await dbConnection.transaction(async (client) => {
        for (const [dateStr, dayData] of Object.entries(appUsageData)) {
          const date = new Date(dateStr)

          if (dayData.apps) {
            for (const [appName, appData] of Object.entries(dayData.apps)) {
              await this.saveAppUsageInTransaction(
                client,
                date,
                null,
                appName,
                appData.time,
                appData.category,
                appData.description,
                appData.domain,
                appData.timestamps
              )
            }
          }

          for (const [key, value] of Object.entries(dayData)) {
            if (key !== 'apps' && key.match(/^\d{2}:\d{2}$/)) {
              const hour = parseInt(key.split(':')[0])

              for (const [appName, appData] of Object.entries(value)) {
                await this.saveAppUsageInTransaction(
                  client,
                  date,
                  hour,
                  appName,
                  appData.time,
                  appData.category,
                  appData.description,
                  appData.domain,
                  appData.timestamps
                )
              }
            }
          }
        }
      })

      return true
    } catch (error) {
      console.error('Error bulk updating app usage data:', error)
      throw error
    }
  }

  async saveAppUsageInTransaction(
    client,
    date,
    hour,
    appName,
    timeSpent,
    category,
    description = null,
    domain = null,
    timestamps = []
  ) {
    try {
      let appUsageId

      const existingRecord = await client.query(
        'SELECT id, time_spent FROM app_usage WHERE date = $1 AND ($2::INTEGER IS NULL AND hour IS NULL OR hour = $2) AND app_name = $3',
        [date, hour, appName]
      )

      if (existingRecord.rows.length > 0) {
        const currentTimeSpent = existingRecord.rows[0].time_spent
        const newTimeSpent = currentTimeSpent + timeSpent

        await client.query(
          'UPDATE app_usage SET time_spent = $1, category = $2, description = $3, domain = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5',
          [newTimeSpent, category, description, domain, existingRecord.rows[0].id]
        )

        appUsageId = existingRecord.rows[0].id

        await client.query('DELETE FROM timestamps WHERE app_usage_id = $1', [appUsageId])
      } else {
        const insertResult = await client.query(
          'INSERT INTO app_usage (date, hour, app_name, time_spent, category, description, domain) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
          [date, hour, appName, timeSpent, category, description, domain]
        )

        appUsageId = insertResult.rows[0].id
      }

      if (timestamps && timestamps.length > 0) {
        for (const timestamp of timestamps) {
          await client.query(
            'INSERT INTO timestamps (app_usage_id, start_time, duration) VALUES ($1, $2, $3)',
            [appUsageId, new Date(timestamp.start), timestamp.duration]
          )
        }
      }

      return appUsageId
    } catch (error) {
      console.error('Error saving app usage in transaction:', error)
      throw error
    }
  }

  async deleteAppUsageData(date, appName = null, hour = null) {
    try {
      let query = 'DELETE FROM app_usage WHERE date = $1'
      const params = [date]

      if (appName) {
        query += ' AND app_name = $2'
        params.push(appName)

        if (hour !== null) {
          query += ' AND hour = $3'
          params.push(hour)
        }
      }

      const result = await dbConnection.query(query, params)
      return result.rowCount
    } catch (error) {
      console.error('Error deleting app usage data:', error)
      throw error
    }
  }

  async getAppUsageStats(startDate, endDate) {
    try {
      const result = await dbConnection.query(
        `SELECT 
          category,
          SUM(time_spent) as total_time,
          COUNT(DISTINCT app_name) as app_count,
          COUNT(*) as session_count
        FROM app_usage 
        WHERE date BETWEEN $1 AND $2
        GROUP BY category
        ORDER BY total_time DESC`,
        [startDate, endDate]
      )

      return result.rows
    } catch (error) {
      console.error('Error getting app usage stats:', error)
      throw error
    }
  }

  async getTopApps(startDate, endDate, limit = 10) {
    try {
      const result = await dbConnection.query(
        `SELECT 
          app_name,
          category,
          SUM(time_spent) as total_time,
          COUNT(*) as session_count
        FROM app_usage 
        WHERE date BETWEEN $1 AND $2
        GROUP BY app_name, category
        ORDER BY total_time DESC
        LIMIT $3`,
        [startDate, endDate, limit]
      )

      return result.rows
    } catch (error) {
      console.error('Error getting top apps:', error)
      throw error
    }
  }
}

module.exports = new AppUsageService()
