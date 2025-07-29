/**
 * Focus Session Service - Main Interface
 *
 * This service acts as the main interface for focus session operations,
 * abstracting the underlying storage implementation and providing a
 * clean API for the main process to interact with focus session data.
 *
 * Architecture:
 * - Delegates operations to LocalFocusSessionService
 * - Provides error handling and logging
 * - Maintains consistency with the hybrid connection pattern
 * - Enables easy swapping of storage backends
 *
 * Usage:
 * - Used by main process IPC handlers
 * - Manages session lifecycle from UI interactions
 * - Provides statistics and analytics to dashboard
 *
 * @author FocusBook Team
 * @version 2.0.0
 */

const { hybridConnection } = require('./hybridConnection')

class FocusSessionService {
  constructor() {
    this.localService = null
  }

  getLocalService() {
    if (!this.localService) {
      this.localService = hybridConnection.getFocusSessionService()
    }
    return this.localService
  }

  async startSession(sessionData) {
    try {
      const service = this.getLocalService()
      return await service.startSession(sessionData)
    } catch (error) {
      console.error('Error starting focus session:', error)
      throw error
    }
  }

  async pauseSession(sessionId) {
    try {
      const service = this.getLocalService()
      return await service.pauseSession(sessionId)
    } catch (error) {
      console.error('Error pausing focus session:', error)
      throw error
    }
  }

  async resumeSession(sessionId) {
    try {
      const service = this.getLocalService()
      return await service.resumeSession(sessionId)
    } catch (error) {
      console.error('Error resuming focus session:', error)
      throw error
    }
  }

  async endSession(sessionId, status = 'completed', actualDuration = null) {
    try {
      const service = this.getLocalService()
      return await service.endSession(sessionId, status, actualDuration)
    } catch (error) {
      console.error('Error ending focus session:', error)
      throw error
    }
  }

  async addInterruption(sessionId, reason, appName) {
    try {
      const service = this.getLocalService()
      return await service.addInterruption(sessionId, reason, appName)
    } catch (error) {
      console.error('Error adding interruption:', error)
      throw error
    }
  }

  async getTodaysStats() {
    try {
      const service = this.getLocalService()
      return await service.getTodaysStats()
    } catch (error) {
      console.error("Error getting today's stats:", error)
      throw error
    }
  }

  async getSessionsByDateRange(startDate, endDate) {
    try {
      const service = this.getLocalService()
      return await service.getSessionsByDateRange(startDate, endDate)
    } catch (error) {
      console.error('Error getting sessions by date range:', error)
      throw error
    }
  }

  async getRecentSessions(limit = 10) {
    try {
      const service = this.getLocalService()
      return await service.getRecentSessions(limit)
    } catch (error) {
      console.error('Error getting recent sessions:', error)
      throw error
    }
  }

  getCurrentSession() {
    try {
      const service = this.getLocalService()
      return service.getCurrentSession()
    } catch (error) {
      console.error('Error getting current session:', error)
      return null
    }
  }

  async getSessionById(sessionId) {
    try {
      const service = this.getLocalService()
      return await service.getSessionById(sessionId)
    } catch (error) {
      console.error('Error getting session by ID:', error)
      throw error
    }
  }

  async updateSessionRating(sessionId, productivity, notes) {
    try {
      const service = this.getLocalService()
      return await service.updateSessionRating(sessionId, productivity, notes)
    } catch (error) {
      console.error('Error updating session rating:', error)
      throw error
    }
  }

  async getWeeklyStats() {
    try {
      const service = this.getLocalService()
      return await service.getWeeklyStats()
    } catch (error) {
      console.error('Error getting weekly stats:', error)
      throw error
    }
  }
}

module.exports = new FocusSessionService()
