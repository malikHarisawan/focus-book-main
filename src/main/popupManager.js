/**
 * Popup Manager - Smart Distraction Intervention System
 *
 * This class manages the intelligent popup system that helps users stay focused
 * by intervening when they switch to distracting applications. It uses machine
 * learning-like adaptive algorithms to optimize popup timing and frequency.
 *
 * Core Intelligence Features:
 * - Adaptive timing based on user behavior patterns
 * - Progressive dismissal durations for repeated interruptions
 * - Respect for focus sessions and quiet hours
 * - Consecutive popup limiting to prevent annoyance
 * - User behavior analysis and learning
 *
 * Smart Controls:
 * - Minimum intervals between popups (adaptive)
 * - Early focus session protection (first 5 minutes)
 * - Quiet hours support for non-intrusive periods
 * - App-specific dismissal tracking with expiration
 * - Effectiveness metrics and user satisfaction optimization
 *
 * Analytics Tracking:
 * - Popup show/dismiss/accept rates
 * - User behavior patterns and trends
 * - Effectiveness scoring and optimization
 * - Session interruption correlation
 *
 * @author FocusBook Team
 * @version 2.0.0
 */

class PopupManager {
  constructor() {
    this.popupHistory = []
    this.lastPopupTime = 0
    this.consecutivePopups = 0
    this.dismissedApps = new Map()
    this.userPreferences = {
      minInterval: 30000, // 30 seconds minimum between popups
      maxConsecutive: 3, // Max 3 popups in a row before longer cooldown
      adaptiveDelay: true, // Increase delay if user frequently dismisses
      respectFocusTime: true, // Don't show popups during first 5 minutes of session
      quietHours: { enabled: false, start: 22, end: 8 } // Optional quiet hours
    }
    this.adaptiveMultiplier = 1.0
  }

  shouldShowPopup(appName, currentSession) {
    const now = Date.now()

    // Check minimum interval
    if (now - this.lastPopupTime < this.userPreferences.minInterval * this.adaptiveMultiplier) {
      console.log('Popup blocked: Too soon since last popup')
      return false
    }

    // Check if app was recently dismissed
    const dismissInfo = this.dismissedApps.get(appName)
    if (dismissInfo && now - dismissInfo.timestamp < dismissInfo.duration) {
      console.log(`Popup blocked: App ${appName} was dismissed`)
      return false
    }

    // Respect focus time (don't interrupt early in session)
    if (this.userPreferences.respectFocusTime && currentSession) {
      const sessionAge = now - new Date(currentSession.startTime).getTime()
      if (sessionAge < 5 * 60 * 1000) {
        // First 5 minutes
        console.log('Popup blocked: Respecting early focus time')
        return false
      }
    }

    // Check consecutive popup limit
    if (this.consecutivePopups >= this.userPreferences.maxConsecutive) {
      const timeSinceLastBurst = now - this.getLastPopupBurstTime()
      if (timeSinceLastBurst < 10 * 60 * 1000) {
        // 10 minute cooldown after burst
        console.log('Popup blocked: Too many consecutive popups')
        return false
      } else {
        this.consecutivePopups = 0 // Reset counter after cooldown
      }
    }

    // Check quiet hours
    if (this.userPreferences.quietHours.enabled) {
      const hour = new Date().getHours()
      const { start, end } = this.userPreferences.quietHours

      if (start > end) {
        // Crosses midnight
        if (hour >= start || hour < end) {
          console.log('Popup blocked: Quiet hours active')
          return false
        }
      } else {
        if (hour >= start && hour < end) {
          console.log('Popup blocked: Quiet hours active')
          return false
        }
      }
    }

    return true
  }

  recordPopupShown(appName) {
    const now = Date.now()
    this.lastPopupTime = now
    this.consecutivePopups++

    this.popupHistory.push({
      timestamp: now,
      appName: appName,
      action: 'shown'
    })

    // Keep only last 50 entries
    if (this.popupHistory.length > 50) {
      this.popupHistory = this.popupHistory.slice(-50)
    }

    console.log(`Popup shown for ${appName}. Consecutive: ${this.consecutivePopups}`)
  }

  recordUserAction(action, appName) {
    const now = Date.now()

    this.popupHistory.push({
      timestamp: now,
      appName: appName,
      action: action
    })

    // Adaptive learning based on user behavior
    if (this.userPreferences.adaptiveDelay) {
      this.updateAdaptiveMultiplier(action)
    }

    // Handle dismissals
    if (action === 'dismiss') {
      this.handleAppDismissal(appName)
    } else if (action === 'stay-focused') {
      // Reset consecutive counter on positive action
      this.consecutivePopups = Math.max(0, this.consecutivePopups - 1)
    }

    console.log(
      `User action: ${action} for ${appName}. Adaptive multiplier: ${this.adaptiveMultiplier.toFixed(2)}`
    )
  }

  handleAppDismissal(appName) {
    // Implement progressive dismissal duration
    const existingDismissal = this.dismissedApps.get(appName)
    let duration = 15 * 60 * 1000 // Start with 15 minutes

    if (existingDismissal) {
      // Increase duration for repeated dismissals
      duration = Math.min(duration * 2, 2 * 60 * 60 * 1000) // Max 2 hours
    }

    this.dismissedApps.set(appName, {
      timestamp: Date.now(),
      duration: duration,
      count: (existingDismissal?.count || 0) + 1
    })

    console.log(`App ${appName} dismissed for ${duration / 60000} minutes`)
  }

  updateAdaptiveMultiplier(action) {
    const recentActions = this.popupHistory
      .filter((entry) => Date.now() - entry.timestamp < 30 * 60 * 1000) // Last 30 minutes
      .map((entry) => entry.action)

    const dismissRate =
      recentActions.filter((a) => a === 'dismiss').length / Math.max(recentActions.length, 1)
    const stayFocusedRate =
      recentActions.filter((a) => a === 'stay-focused').length / Math.max(recentActions.length, 1)

    // Increase delay if user frequently dismisses, decrease if they stay focused
    if (dismissRate > 0.7) {
      this.adaptiveMultiplier = Math.min(this.adaptiveMultiplier * 1.2, 3.0)
    } else if (stayFocusedRate > 0.7) {
      this.adaptiveMultiplier = Math.max(this.adaptiveMultiplier * 0.9, 0.5)
    }
  }

  getLastPopupBurstTime() {
    // Find the timestamp of the oldest popup in the current consecutive sequence
    const now = Date.now()
    let burstStart = now

    for (let i = this.popupHistory.length - 1; i >= 0; i--) {
      const entry = this.popupHistory[i]
      if (entry.action === 'shown' && now - entry.timestamp < 10 * 60 * 1000) {
        burstStart = entry.timestamp
      } else {
        break
      }
    }

    return burstStart
  }

  getPopupStats() {
    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000

    const recentHistory = this.popupHistory.filter((entry) => entry.timestamp > oneDayAgo)
    const totalShown = recentHistory.filter((entry) => entry.action === 'shown').length
    const stayFocused = recentHistory.filter((entry) => entry.action === 'stay-focused').length
    const dismissed = recentHistory.filter((entry) => entry.action === 'dismiss').length
    const breaks = recentHistory.filter((entry) => entry.action === 'cooldown').length

    return {
      totalShown,
      stayFocused,
      dismissed,
      breaks,
      effectiveness: totalShown > 0 ? (stayFocused / totalShown) * 100 : 0,
      adaptiveMultiplier: this.adaptiveMultiplier,
      consecutivePopups: this.consecutivePopups,
      activeDismissals: this.dismissedApps.size
    }
  }

  updatePreferences(newPreferences) {
    this.userPreferences = { ...this.userPreferences, ...newPreferences }
    console.log('Popup preferences updated:', this.userPreferences)
  }

  cleanupExpiredDismissals() {
    const now = Date.now()
    for (const [appName, dismissInfo] of this.dismissedApps.entries()) {
      if (now - dismissInfo.timestamp > dismissInfo.duration) {
        this.dismissedApps.delete(appName)
        console.log(`Dismissal expired for ${appName}`)
      }
    }
  }

  reset() {
    this.popupHistory = []
    this.lastPopupTime = 0
    this.consecutivePopups = 0
    this.dismissedApps.clear()
    this.adaptiveMultiplier = 1.0
    console.log('Popup manager reset')
  }
}

module.exports = PopupManager
