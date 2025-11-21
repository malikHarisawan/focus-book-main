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

      const pauseTime = new Date().toISOString()
      await this.db.update('focus_sessions', { _id: sessionId }, { 
        $set: { 
          status: 'paused',
          paused_at: pauseTime
        } 
      })

      // Update current session if it's the same
      if (this.currentSession && this.currentSession._id === sessionId) {
        this.currentSession.status = 'paused'
        this.currentSession.paused_at = pauseTime
      }

      return { ...session, status: 'paused', paused_at: pauseTime }
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

      const resumeTime = new Date()
      let pausedDuration = session.paused_duration || 0
      
      // Calculate additional pause duration if session was paused
      if (session.paused_at) {
        const additionalPause = resumeTime.getTime() - new Date(session.paused_at).getTime()
        pausedDuration += additionalPause
      }

      await this.db.update('focus_sessions', { _id: sessionId }, { 
        $set: { 
          status: 'active',
          paused_duration: pausedDuration,
          paused_at: null
        } 
      })

      // Update current session if it's the same
      if (this.currentSession && this.currentSession._id === sessionId) {
        this.currentSession.status = 'active'
        this.currentSession.paused_duration = pausedDuration
        this.currentSession.paused_at = null
      }

      return { ...session, status: 'active', paused_duration: pausedDuration }
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
        const session = sessions[0]
        
        // Check if session has been running too long (more than planned duration + 1 hour)
        // This handles cases where the app was closed unexpectedly
        const sessionStart = new Date(session.start_time).getTime()
        const now = Date.now()
        const maxDuration = (session.planned_duration || 25 * 60 * 1000) + (60 * 60 * 1000) // planned + 1 hour buffer
        const actualElapsed = now - sessionStart - (session.paused_duration || 0)
        
        if (actualElapsed > maxDuration && session.status === 'active') {
          // Auto-complete sessions that have been running too long
          console.log('Auto-completing stale session that ran too long')
          await this.endSession(session._id, 'completed', session.planned_duration)
          this.currentSession = null
          return null
        }
        
        this.currentSession = session
        
        // For paused sessions, check if they've been paused for more than 24 hours
        if (session.status === 'paused' && session.paused_at) {
          const pausedFor = now - new Date(session.paused_at).getTime()
          const maxPauseTime = 24 * 60 * 60 * 1000 // 24 hours
          
          if (pausedFor > maxPauseTime) {
            console.log('Auto-cancelling session paused for too long')
            await this.endSession(session._id, 'cancelled')
            this.currentSession = null
            return null
          }
        }
      }

      return this.currentSession
    } catch (error) {
      console.error('Error loading current session:', error)
      return null
    }
  }
  
  async initializeService() {
    try {
      // Load any existing current session on startup
      await this.loadCurrentSession()
      console.log('Focus session service initialized', this.currentSession ? 'with active session' : 'without active session')
    } catch (error) {
      console.error('Error initializing focus session service:', error)
    }
  }
}

module.exports = LocalFocusSessionService
