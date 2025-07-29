/**
 * Local Focus Session Service
 *
 * This service manages focus sessions and productivity tracking using SQLite
 * as the storage backend. It handles session lifecycle, timing, interruptions,
 * and provides analytics for focus performance.
 *
 * Session Types:
 * - Focus: 25-minute deep work sessions
 * - Short Break: 5-minute rest periods
 * - Long Break: 15-minute extended rest
 *
 * Key Features:
 * - Session state management (active, paused, completed)
 * - Interruption tracking and analysis
 * - Productivity metrics and statistics
 * - Pomodoro technique integration
 * - Session history and trends
 *
 * Data Tracking:
 * - Start/end times and durations
 * - Session goals and actual performance
 * - Interruption events and patterns
 * - User ratings and notes
 *
 * @author FocusBook Team
 * @version 3.0.0
 */

class LocalFocusSessionService {
  constructor(sqliteConnection) {
    this.db = sqliteConnection
    this.currentSession = null
  }

  async startSession(sessionData) {
    try {
      // End any existing active session
      if (this.currentSession) {
        await this.endSession(this.currentSession._id, 'cancelled')
      }

      // Ensure we have a valid start time
      const startTime = sessionData.startTime ? new Date(sessionData.startTime) : new Date()
      
      // Validate the date
      if (isNaN(startTime.getTime())) {
        throw new Error('Invalid start time provided')
      }

      // Map UI session types to database allowed types
      const mapSessionType = (type) => {
        switch (type) {
          case 'pomodoro':
            return 'focus'
          case 'short-break':
          case 'shortBreak':
            return 'shortBreak'
          case 'long-break':
          case 'longBreak':
            return 'longBreak'
          case 'focus':
            return 'focus'
          default:
            return 'focus' // default fallback
        }
      }

      const session = {
        type: mapSessionType(sessionData.type),
        start_time: startTime.toISOString(),
        planned_duration: sessionData.duration,
        status: 'active',
        date: startTime.toISOString().split('T')[0],
        actual_duration: null,
        end_time: null,
        notes: null,
        productivity: null
      }

      this.currentSession = await this.db.insert('focus_sessions', session)
      return this.currentSession
    } catch (error) {
      console.error('Error starting focus session:', error)
      throw error
    }
  }

  async pauseSession(sessionId) {
    try {
      const session = await this.db.findOne('focus_sessions', { _id: sessionId })
      if (!session) {
        throw new Error('Session not found')
      }

      await this.db.update('focus_sessions', { _id: sessionId }, { $set: { status: 'paused' } })

      // Update current session if it's the same
      if (this.currentSession && this.currentSession._id === sessionId) {
        this.currentSession.status = 'paused'
      }

      return { ...session, status: 'paused' }
    } catch (error) {
      console.error('Error pausing focus session:', error)
      throw error
    }
  }

  async resumeSession(sessionId) {
    try {
      const session = await this.db.findOne('focus_sessions', { _id: sessionId })
      if (!session) {
        throw new Error('Session not found')
      }

      await this.db.update('focus_sessions', { _id: sessionId }, { $set: { status: 'active' } })

      // Update current session if it's the same
      if (this.currentSession && this.currentSession._id === sessionId) {
        this.currentSession.status = 'active'
      }

      return { ...session, status: 'active' }
    } catch (error) {
      console.error('Error resuming focus session:', error)
      throw error
    }
  }

  async endSession(sessionId, status = 'completed', actualDuration = null) {
    try {
      const session = await this.db.findOne('focus_sessions', { _id: sessionId })
      if (!session) {
        throw new Error('Session not found')
      }

      const endTime = new Date()
      const finalActualDuration =
        actualDuration !== null
          ? actualDuration
          : endTime.getTime() - new Date(session.start_time).getTime()

      await this.db.update(
        'focus_sessions',
        { _id: sessionId },
        {
          $set: {
            status: status,
            end_time: endTime.toISOString(),
            actual_duration: finalActualDuration
          }
        }
      )

      if (this.currentSession && this.currentSession._id === sessionId) {
        this.currentSession = null
      }

      return {
        ...session,
        status: status,
        endTime: endTime,
        actualDuration: finalActualDuration
      }
    } catch (error) {
      console.error('Error ending focus session:', error)
      throw error
    }
  }

  async addInterruption(sessionId, reason, appName) {
    try {
      const session = await this.db.findOne('focus_sessions', { _id: sessionId })
      if (!session) {
        throw new Error('Session not found')
      }

      // Insert interruption into separate table
      await this.db.insert('focus_session_interruptions', {
        focus_session_id: sessionId,
        timestamp: new Date().toISOString(),
        reason: reason,
        app_name: appName
      })

      return session
    } catch (error) {
      console.error('Error adding interruption:', error)
      throw error
    }
  }

  async getTodaysStats() {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const sessions = await this.db.find('focus_sessions', {
        date: { $gte: today, $lt: tomorrow },
        status: 'completed'
      })

      // Manual aggregation since NeDB doesn't have aggregation pipeline
      const stats = {}

      sessions.forEach((session) => {
        const type = session.type
        if (!stats[type]) {
          stats[type] = {
            _id: type,
            totalSessions: 0,
            totalDuration: 0,
            avgDuration: 0
          }
        }

        stats[type].totalSessions += 1
        stats[type].totalDuration += session.actualDuration || 0
      })

      // Calculate averages
      Object.values(stats).forEach((stat) => {
        stat.avgDuration = stat.totalSessions > 0 ? stat.totalDuration / stat.totalSessions : 0
      })

      return Object.values(stats)
    } catch (error) {
      console.error("Error getting today's stats:", error)
      throw error
    }
  }

  async getSessionsByDateRange(startDate, endDate) {
    try {
      const query = {}
      if (startDate && endDate) {
        query.date = { $gte: new Date(startDate), $lte: new Date(endDate) }
      } else if (startDate) {
        query.date = { $gte: new Date(startDate) }
      } else if (endDate) {
        query.date = { $lte: new Date(endDate) }
      }

      return await this.db.find('focus_sessions', query, { sort: { start_time: -1 } })
    } catch (error) {
      console.error('Error getting sessions by date range:', error)
      throw error
    }
  }

  async getRecentSessions(limit = 10) {
    try {
      return await this.db.find(
        'focus_sessions',
        {},
        {
          sort: { start_time: -1 },
          limit: limit
        }
      )
    } catch (error) {
      console.error('Error getting recent sessions:', error)
      throw error
    }
  }

  getCurrentSession() {
    return this.currentSession
  }

  async getSessionById(sessionId) {
    try {
      return await this.db.findOne('focus_sessions', { _id: sessionId })
    } catch (error) {
      console.error('Error getting session by ID:', error)
      throw error
    }
  }

  async updateSessionRating(sessionId, productivity, notes) {
    try {
      const session = await this.db.findOne('focus_sessions', { _id: sessionId })
      if (!session) {
        throw new Error('Session not found')
      }

      const updateData = { productivity: productivity }
      if (notes) {
        updateData.notes = notes
      }

      await this.db.update('focus_sessions', { _id: sessionId }, { $set: updateData })
      return { ...session, ...updateData }
    } catch (error) {
      console.error('Error updating session rating:', error)
      throw error
    }
  }

  async getWeeklyStats() {
    try {
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

      const sessions = await this.db.find('focus_sessions', {
        date: { $gte: oneWeekAgo },
        status: 'completed'
      })

      // Manual aggregation for weekly stats
      const dailyStats = {}

      sessions.forEach((session) => {
        const dateStr = session.date.toISOString().split('T')[0]
        const type = session.type

        if (!dailyStats[dateStr]) {
          dailyStats[dateStr] = {}
        }

        if (!dailyStats[dateStr][type]) {
          dailyStats[dateStr][type] = {
            _id: { date: dateStr, type: type },
            totalSessions: 0,
            totalDuration: 0
          }
        }

        dailyStats[dateStr][type].totalSessions += 1
        dailyStats[dateStr][type].totalDuration += session.actualDuration || 0
      })

      // Flatten the result
      const result = []
      Object.values(dailyStats).forEach((dayStats) => {
        Object.values(dayStats).forEach((stat) => {
          result.push(stat)
        })
      })

      return result.sort((a, b) => a._id.date.localeCompare(b._id.date))
    } catch (error) {
      console.error('Error getting weekly stats:', error)
      throw error
    }
  }

  async loadCurrentSession() {
    try {
      // Look for any active or paused sessions
      const sessions = await this.db.find(
        'focus_sessions',
        {
          status: { $in: ['active', 'paused'] }
        },
        { sort: { start_time: -1 }, limit: 1 }
      )

      if (sessions.length > 0) {
        this.currentSession = sessions[0]
      }

      return this.currentSession
    } catch (error) {
      console.error('Error loading current session:', error)
      return null
    }
  }
}

module.exports = LocalFocusSessionService
