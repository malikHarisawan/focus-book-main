/**
 * Local Focus Session Service
 * 
 * This service manages focus sessions and productivity tracking using NeDB
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
 * @version 2.0.0
 */

class LocalFocusSessionService {
  constructor(nedbConnection) {
    this.db = nedbConnection
    this.currentSession = null
  }

  async startSession(sessionData) {
    try {
      // End any existing active session
      if (this.currentSession) {
        await this.endSession(this.currentSession._id, 'cancelled')
      }

      const session = {
        type: sessionData.type,
        startTime: new Date(sessionData.startTime),
        plannedDuration: sessionData.duration,
        status: 'active',
        date: new Date(sessionData.startTime),
        interruptions: [],
        actualDuration: null,
        endTime: null,
        notes: null,
        productivity: null
      }

      this.currentSession = await this.db.insert('focusSessions', session)
      return this.currentSession
    } catch (error) {
      console.error('Error starting focus session:', error)
      throw error
    }
  }

  async pauseSession(sessionId) {
    try {
      const session = await this.db.findOne('focusSessions', { _id: sessionId })
      if (!session) {
        throw new Error('Session not found')
      }

      await this.db.update('focusSessions', { _id: sessionId }, { $set: { status: 'paused' } })

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
      const session = await this.db.findOne('focusSessions', { _id: sessionId })
      if (!session) {
        throw new Error('Session not found')
      }

      await this.db.update('focusSessions', { _id: sessionId }, { $set: { status: 'active' } })

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
      const session = await this.db.findOne('focusSessions', { _id: sessionId })
      if (!session) {
        throw new Error('Session not found')
      }

      const endTime = new Date()
      const finalActualDuration =
        actualDuration !== null
          ? actualDuration
          : endTime.getTime() - new Date(session.startTime).getTime()

      await this.db.update(
        'focusSessions',
        { _id: sessionId },
        {
          $set: {
            status: status,
            endTime: endTime,
            actualDuration: finalActualDuration
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
      const session = await this.db.findOne('focusSessions', { _id: sessionId })
      if (!session) {
        throw new Error('Session not found')
      }

      const interruption = {
        timestamp: new Date(),
        reason: reason,
        appName: appName
      }

      const interruptions = session.interruptions || []
      interruptions.push(interruption)

      await this.db.update(
        'focusSessions',
        { _id: sessionId },
        {
          $set: { interruptions: interruptions }
        }
      )

      return { ...session, interruptions: interruptions }
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

      const sessions = await this.db.find('focusSessions', {
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

      return await this.db.find('focusSessions', query, { sort: { startTime: -1 } })
    } catch (error) {
      console.error('Error getting sessions by date range:', error)
      throw error
    }
  }

  async getRecentSessions(limit = 10) {
    try {
      return await this.db.find(
        'focusSessions',
        {},
        {
          sort: { startTime: -1 },
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
      return await this.db.findOne('focusSessions', { _id: sessionId })
    } catch (error) {
      console.error('Error getting session by ID:', error)
      throw error
    }
  }

  async updateSessionRating(sessionId, productivity, notes) {
    try {
      const session = await this.db.findOne('focusSessions', { _id: sessionId })
      if (!session) {
        throw new Error('Session not found')
      }

      const updateData = { productivity: productivity }
      if (notes) {
        updateData.notes = notes
      }

      await this.db.update('focusSessions', { _id: sessionId }, { $set: updateData })
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

      const sessions = await this.db.find('focusSessions', {
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
        'focusSessions',
        {
          status: { $in: ['active', 'paused'] }
        },
        { sort: { startTime: -1 }, limit: 1 }
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
