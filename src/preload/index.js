const { contextBridge, ipcRenderer } = require('electron')
const activeWindows = require('electron-active-window')
const { spawn } = require('child_process')
import APP_CATEGORIES from './categories'
const { exec } = require('child_process')
const util = require('util')
const execPromise = util.promisify(exec)
const path = require('path')
const fs = require('fs')
const PythonErrorRecovery = require('../main/pythonErrorRecovery')
let appUsageData = {}
let lastActiveApp = null
let lastUpdateTime = Date.now()
let Distracted_List = ['Entertainment']
let customCategoryMappings = {}
let pythonErrorRecovery = new PythonErrorRecovery()
let exclusionList = { apps: [], domains: [] }


// Initialize tracking data
;(async function initializeTracking() {
  try {
    const currentWindow = await getActiveWindow()
    if (currentWindow && currentWindow.windowClass) {
      lastActiveApp = currentWindow
      lastUpdateTime = Date.now()
      console.log('Initialized tracking with app:', currentWindow.windowClass)
    }

    // Check if there's already an active focus session on startup
    const currentSession = await getCurrentSessionStatus()
    if (currentSession && (currentSession.status === 'active' || currentSession.status === 'paused')) {
      isFocusSessionActive = true
      console.log('Found existing active/paused focus session on startup:', currentSession._id)
    }
  } catch (e) {
    console.error('Failed to initialize tracking:', e)
  }
})()

loadCategories()
  .then((categories) => {
    if (categories && Array.isArray(categories)) {
      Distracted_List = categories[1]
    }
    console.log('Distracted List updated:', Distracted_List)
  })
  .catch((e) => console.log('Error loading categories:', e))

let active_url = null
let active_domain = null
let isFocusSessionActive = false
let dismissedApps = {}
let isCoolDown = false
let startDismisstime = 0
let focusSessionStartTime = 0
let totalFocusTime = 0

// Productivity state tracking variables
let isCurrentlyProductive = false
let productivityStreakStart = null
let productivityHistory = []
let lastProductivityCheck = Date.now()
let unproductiveStreakStart = null

// Productivity configuration
const PRODUCTIVITY_CONFIG = {
  MIN_PRODUCTIVE_DURATION: 30 * 1000, // 30 seconds of productive activity before session start (reduced for testing)
  MAX_UNPRODUCTIVE_INTERRUPTION: 2 * 60 * 1000, // 2 minutes of unproductive activity before session pause
  PRODUCTIVITY_CHECK_INTERVAL: 15000, // 15 seconds (reduced from 30 seconds)
  HISTORY_WINDOW: 10 * 60 * 1000, // 10 minutes of history to maintain
}
loadData()

// Cache for Chrome tab info to avoid repeated slow Python calls
const chromeTabCache = new Map()
const CHROME_TAB_CACHE_TTL = 15000 // 15 seconds cache (increased to reduce intrusive clipboard method frequency)
const CHROME_TAB_CACHE_TTL_SUCCESS = 30000 // 30 seconds for successful URL extractions

// Cleanup old cache entries every 30 seconds to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of chromeTabCache.entries()) {
    const maxAge = value.hasUrl ? CHROME_TAB_CACHE_TTL_SUCCESS : CHROME_TAB_CACHE_TTL
    if (now - value.timestamp > maxAge * 2) {
      chromeTabCache.delete(key)
    }
  }
}, 30000)

async function getActiveChromeTab(pid) {
  if (!pid) {
    console.warn('Invalid PID: Cannot fetch Chrome tab info')
    return null
  }

  // Check cache first with dynamic TTL based on success
  const cacheKey = `${pid}`
  const cached = chromeTabCache.get(cacheKey)
  if (cached) {
    const ttl = cached.hasUrl ? CHROME_TAB_CACHE_TTL_SUCCESS : CHROME_TAB_CACHE_TTL
    if ((Date.now() - cached.timestamp) < ttl) {
      console.log(`Using cached Chrome tab info for PID ${pid} (TTL: ${ttl/1000}s, has URL: ${cached.hasUrl})`)
      return cached.data
    }
  }

  // In production, scripts are in extraResources; in dev, they're in the project root
  const isDev = process.env.NODE_ENV === 'development' || !process.resourcesPath
  const getURLScriptPath = isDev
    ? path.join(__dirname, '../../scripts/get_active_url.py')
    : path.join(process.resourcesPath, 'scripts/get_active_url.py')

  console.log(`Script path (isDev=${isDev}): ${getURLScriptPath}`)
  const fallbackValue = { url: 'Browser Tab', title: 'Browser Tab' }

  try {
    const output = await pythonErrorRecovery.executePythonScript(
      getURLScriptPath,
      [pid.toString()],
      {
        timeout: 12000, // Reduced from 15s to 12s with optimized Python script
        fallbackValue: fallbackValue,
        retryCount: 1  // Reduced from 2 to 1 since we now have better fallbacks in Python
      }
    )

    if (output === fallbackValue) {
      // Cache fallback too to avoid repeated failures (shorter TTL)
      chromeTabCache.set(cacheKey, { data: fallbackValue, timestamp: Date.now(), hasUrl: false })
      return fallbackValue
    }

    try {
      const result = JSON.parse(output)
      // Cache successful result with longer TTL if we got a real URL
      const hasUrl = result.url && result.url !== null && result.url !== 'Browser Tab'
      chromeTabCache.set(cacheKey, { data: result, timestamp: Date.now(), hasUrl })
      console.log(`Cached Chrome tab info: hasUrl=${hasUrl}, domain=${result.domain}`)
      return result
    } catch (parseError) {
      console.warn('Error parsing Python script output:', parseError.message)
      chromeTabCache.set(cacheKey, { data: fallbackValue, timestamp: Date.now(), hasUrl: false })
      return fallbackValue
    }
  } catch (error) {
    console.warn('Python script execution failed:', error.message)
    chromeTabCache.set(cacheKey, { data: fallbackValue, timestamp: Date.now(), hasUrl: false })
    return fallbackValue
  }
}

async function getAppDescription(executablePath) {
  try {
    const escapedPath = executablePath.replace(/'/g, "''").replace(/"/g, '`"')

    const powershellCommand = `(Get-ItemProperty -Path '${escapedPath}' -ErrorAction SilentlyContinue).VersionInfo.FileDescription`
    const { stdout } = await execPromise(`powershell -command "${powershellCommand}"`)
    return stdout.trim() || executablePath.split('\\').pop()
  } catch (error) {
    console.error('Error getting app description:', error)
    return executablePath ? executablePath.split('\\').pop() : 'Unknown application'
  }
}

async function getProcessDetails(pid) {
  try {
    const { stdout: wmiOutput } = await execPromise(
      `wmic process where ProcessId=${pid} get ExecutablePath /format:list`
    )
    const execPathMatch = wmiOutput.match(/ExecutablePath=(.+)/)
    const executablePath = execPathMatch ? execPathMatch[1].trim() : null

    if (!executablePath) {
      return { description: 'Unknown application' }
    }

    const description = await getAppDescription(executablePath)

    return {
      executablePath,
      description
    }
  } catch (error) {
    console.error('Error getting process details:', error)
    return { description: 'Unknown application' }
  }
}

async function getCurrentState(threshold) {
  try {
    const state = await ipcRenderer.invoke('idle-state', threshold)
    console.log(`System state: ${state} (threshold: ${threshold}s)`)
    return state
  } catch (error) {
    console.error('Error getting system state:', error)
    return 'unknown'
  }
}
let previousWindowClass = null
let previousWindowName = null
let hasAppSwitched = false

// Add productivity streak detection functions
function updateProductivityState(isFocused) {
  const currentTime = Date.now()
  
  // Update productivity history
  productivityHistory.push({
    timestamp: currentTime,
    isProductive: isFocused
  })
  
  // Clean old history entries
  productivityHistory = productivityHistory.filter(
    entry => currentTime - entry.timestamp <= PRODUCTIVITY_CONFIG.HISTORY_WINDOW
  )
  
  // Update current productivity state
  if (isFocused && !isCurrentlyProductive) {
    // Starting productive streak
    isCurrentlyProductive = true
    productivityStreakStart = currentTime
    unproductiveStreakStart = null
    console.log('Starting productive streak')
  } else if (!isFocused && isCurrentlyProductive) {
    // Starting unproductive streak
    isCurrentlyProductive = false
    unproductiveStreakStart = currentTime
    productivityStreakStart = null
    console.log('Starting unproductive streak')
  }
  
  lastProductivityCheck = currentTime
}

function getProductiveStreakDuration() {
  if (!isCurrentlyProductive || !productivityStreakStart) {
    return 0
  }
  return Date.now() - productivityStreakStart
}

function getUnproductiveStreakDuration() {
  if (isCurrentlyProductive || !unproductiveStreakStart) {
    return 0
  }
  return Date.now() - unproductiveStreakStart
}

function shouldStartFocusSession() {
  if (!isCurrentlyProductive) {
    return false
  }
  
  const streakDuration = getProductiveStreakDuration()
  return streakDuration >= PRODUCTIVITY_CONFIG.MIN_PRODUCTIVE_DURATION
}

function shouldPauseFocusSession() {
  if (isCurrentlyProductive) {
    return false
  }
  
  const unproductiveStreak = getUnproductiveStreakDuration()
  return unproductiveStreak >= PRODUCTIVITY_CONFIG.MAX_UNPRODUCTIVE_INTERRUPTION
}

async function getCurrentSessionStatus() {
  try {
    const currentSession = await ipcRenderer.invoke('get-current-focus-session')
    return currentSession && !currentSession.error ? currentSession : null
  } catch (error) {
    console.error('Error getting current session status:', error)
    return null
  }
}

async function updateAppUsage() {
  try {
    const state = await getCurrentState(60) // Reduced from 120 seconds to 60 seconds
    if (state == 'idle' || state == 'locked' || state == 'unknown') {
      // Reset tracking variables when system is idle/locked/unknown to prevent false data recording
      console.log(`System is ${state}, resetting tracking variables`)
      lastActiveApp = null
      lastUpdateTime = Date.now()
      // Reset productivity state on idle
      isCurrentlyProductive = false
      productivityStreakStart = null
      unproductiveStreakStart = null
      return
    }
    console.log('State ===>> ', state)
    const currentWindow = await getActiveWindow()
    if (!isValidWindow(currentWindow)) {
      return
    }
    const currentAppClass = currentWindow.windowClass
    const currentAppName = currentWindow.windowName

    // Get current URL for browser detection
    let current_url = null
    let current_domain = null
    if (currentAppClass === 'chrome.exe' || currentAppClass === 'brave.exe') {
      const pid = await getChromePid(currentWindow)
      if (pid) {
        const chromeTabInfo = await getActiveChromeTab(pid)
        console.log('Chrome tab info received:', chromeTabInfo)

        // Check if this is a fallback response (Python script failed)
        if (chromeTabInfo.url === 'Browser Tab' && chromeTabInfo.title === 'Browser Tab') {
          console.log('Python script fallback detected - clearing active URL')
          current_url = null
          current_domain = null
        } else {
          current_url = String(chromeTabInfo.active_app)
          current_domain = chromeTabInfo.domain || chromeTabInfo.active_app
          if (current_url === 'undefined' || current_url === 'null' || !current_url) {
            current_url = null
          }
          if (current_domain === 'undefined' || current_domain === 'null' || !current_domain) {
            current_domain = null
          }
          console.log('Extracted domain:', current_domain, 'URL:', current_url)
        }
      }
    }

    // Check if app has changed - either different application or different browser tab
    hasAppSwitched =
      (lastActiveApp && currentAppClass !== lastActiveApp.windowClass) ||
      ((currentAppClass === 'chrome.exe' || currentAppClass === 'brave.exe') &&
        lastActiveApp &&
        lastActiveApp.windowClass === currentAppClass &&
        (currentAppName !== lastActiveApp.windowName || current_url !== active_url))

    // Update active_url and active_domain for current tracking - always update, even if null
    if (currentAppClass === 'chrome.exe' || currentAppClass === 'brave.exe') {
      active_url = current_url
      active_domain = current_domain
      console.log('Updated active_url to:', active_url, 'domain:', active_domain)
    }

    if (hasAppSwitched) {
      console.log(
        `App switched: From ${lastActiveApp ? lastActiveApp.windowClass : 'unknown'} to ${currentAppClass}`
      )
    }

    let appIdentifier =
      currentWindow.windowClass == 'chrome.exe' || currentWindow.windowClass === 'brave.exe'
        ? getCategory(active_url || currentWindow.windowName || currentWindow.windowClass)
        : getCategory(currentWindow.windowClass)

    console.log('appIdentifier ==>> ', appIdentifier)
    const isFocused = !Distracted_List.includes(appIdentifier)
    let isDismissed = handleDismiss(appIdentifier)

    // Update productivity state tracking
    updateProductivityState(isFocused)

    // Handle focus session logic with productivity validation
    if (isFocused && shouldStartFocusSession() && !isFocusSessionActive) {
      console.log(`Starting focus session after ${getProductiveStreakDuration() / 1000}s of productive activity`)
      startFocusSession(isFocused)
    }

    // Handle session state during active sessions
    if (isFocusSessionActive) {
      if (isFocused) {
        // User returned to productive activity - check if session is paused
        const currentSession = await getCurrentSessionStatus()
        if (currentSession && currentSession.status === 'paused') {
          console.log('Resuming paused focus session - user returned to productive activity')
          resumeFocusSession()
        }
      } else {
        // User switched to unproductive activity
        console.log('isFocusSessionActive', isFocusSessionActive)
        handlePopup(appIdentifier, currentWindow, isDismissed)
        
        // Check if we should pause the session due to extended unproductive activity
        if (shouldPauseFocusSession()) {
          console.log(`Pausing focus session after ${getUnproductiveStreakDuration() / 1000}s of unproductive activity`)
          pauseFocusSession()
        } else {
          // For brief interruptions, add interruption tracking but don't end session
          const currentSession = await getCurrentSessionStatus()
          if (currentSession && currentSession._id) {
            await ipcRenderer.invoke('add-focus-session-interruption', currentSession._id, 'brief_interruption', appIdentifier)
          }
        }
      }
    }
    
    previousWindowClass = currentAppClass
    previousWindowName = currentAppName

    updateUsageData(currentWindow, hasAppSwitched)
  } catch (error) {
    console.error('Error updating app usage:', error)
  }
}
async function startFocusSession(isFocused) {
  console.log('Focus started - starting actual focus session with productivity validation')

  if (!isFocusSessionActive) {
    try {
      // Validate productivity state before starting session
      if (!shouldStartFocusSession()) {
        console.log('Session start blocked: insufficient productive activity duration')
        return
      }

      // Start an actual focus session via IPC
      const sessionData = {
        type: 'focus',
        duration: 25 * 60 * 1000, // 25 minutes in milliseconds
        isAutoStarted: true,
        productivityStreakDuration: getProductiveStreakDuration()
      }

      const session = await ipcRenderer.invoke('start-focus-session', sessionData)

      if (session && !session.error) {
        isFocusSessionActive = true
        focusSessionStartTime = Date.now()
        console.log('Auto-started focus session:', session._id, 'after productive streak of', getProductiveStreakDuration() / 1000, 'seconds')

        // Send UI update
        ipcRenderer.send('start-focus', isFocused)
      } else {
        console.error('Failed to start focus session:', session?.error)
      }
    } catch (error) {
      console.error('Error starting auto focus session:', error)
    }
  }
}
async function pauseFocusSession() {
  if (isFocusSessionActive) {
    try {
      // Pause the current focus session in the database
      const currentSession = await ipcRenderer.invoke('get-current-focus-session')

      if (currentSession && !currentSession.error) {
        await ipcRenderer.invoke('pause-focus-session', currentSession._id)
        console.log('Auto-paused focus session due to unproductive activity:', currentSession._id)
        
        // Add interruption tracking
        await ipcRenderer.invoke('add-focus-session-interruption', currentSession._id, 'unproductive_activity', 'Extended unproductive app usage')
      }

      // Don't set isFocusSessionActive to false - session is paused, not ended
      ipcRenderer.send('pause-focus')
    } catch (error) {
      console.error('Error pausing auto focus session:', error)
    }
  }
}

async function resumeFocusSession() {
  if (isFocusSessionActive) {
    try {
      // Resume the current focus session in the database
      const currentSession = await ipcRenderer.invoke('get-current-focus-session')

      if (currentSession && !currentSession.error && currentSession.status === 'paused') {
        await ipcRenderer.invoke('resume-focus-session', currentSession._id)
        console.log('Auto-resumed focus session after returning to productive activity:', currentSession._id)
      }

      ipcRenderer.send('resume-focus')
    } catch (error) {
      console.error('Error resuming auto focus session:', error)
    }
  }
}

async function endFocusSession(isFocused) {
  if (isFocusSessionActive) {
    try {
      // End the current focus session in the database
      const currentSession = await ipcRenderer.invoke('get-current-focus-session')

      if (currentSession && !currentSession.error) {
        await ipcRenderer.invoke('stop-focus-session', currentSession._id)
        console.log('Auto-ended focus session:', currentSession._id)
      }

      isFocusSessionActive = false
      ipcRenderer.send('end-focus', isFocused)

      const focusTime = Date.now() - focusSessionStartTime
      totalFocusTime += focusTime
    } catch (error) {
      console.error('Error ending auto focus session:', error)
      isFocusSessionActive = false
      ipcRenderer.send('end-focus', isFocused)
    }
  }
}

async function getActiveWindow() {
  try {
    return await activeWindows().getActiveWindow()
  } catch (error) {
    console.error('Error getting active window', error)
    return null
  }
}

function isValidWindow(currentWindow) {
  if (!currentWindow || !currentWindow.windowClass) {
    return false
  }

  let isidle = getCategory(currentWindow.windowClass)

  if (isidle === 'Idle') {
    return false
  }
  return true
}

async function updateUsageData(currentWindow, hasAppSwitched) {
  const currentTime = Date.now()
  if (lastActiveApp && lastActiveApp.windowClass) {
    const timeSpent = currentTime - lastUpdateTime

    // Check if the app or domain is in the exclusion list
    const appClass = lastActiveApp.windowClass
    const isAppExcluded = exclusionList.apps.some(excludedApp =>
      appClass.toLowerCase().includes(excludedApp.toLowerCase())
    )

    // Check if it's a browser and if the domain is excluded
    let isDomainExcluded = false
    if ((appClass === 'chrome.exe' || appClass === 'brave.exe') && active_domain) {
      isDomainExcluded = exclusionList.domains.some(excludedDomain =>
        active_domain.toLowerCase().includes(excludedDomain.toLowerCase()) ||
        (active_url && active_url.toLowerCase().includes(excludedDomain.toLowerCase()))
      )
    }

    if (isAppExcluded || isDomainExcluded) {
      console.log(`⛔ Skipping tracking for excluded ${isAppExcluded ? 'app' : 'domain'}: ${isAppExcluded ? appClass : active_domain}`)
      lastActiveApp = currentWindow
      lastUpdateTime = currentTime
      return
    }

    // Skip recording if the time gap is too large (likely a wake from sleep/idle)
    const maxAllowedGap = 15 * 60 * 1000 // 15 minutes
    if (timeSpent > maxAllowedGap) {
      console.warn(
        `⚠️ Skipping recording due to large time gap: ${Math.round(timeSpent / 60000)}min for ${lastActiveApp.windowClass} - likely system was sleeping/idle`
      )
      return
    }

    // Prevent recording excessive time gaps (likely due to missed idle states)
    // Maximum recordable time is 10 minutes per interval
    const maxRecordableTime = 10 * 60 * 1000 // 10 minutes
    const actualTimeSpent = Math.min(timeSpent, maxRecordableTime)

    if (actualTimeSpent > 1000 * 10) {
      if (timeSpent > maxRecordableTime) {
        console.warn(
          `⚠️ Large time gap detected: ${timeSpent}ms (${Math.round(timeSpent / 60000)}min) - capped to ${actualTimeSpent}ms (${Math.round(actualTimeSpent / 60000)}min) for ${lastActiveApp.windowClass}`
        )
      } else {
        console.log(`Recording ${actualTimeSpent}ms for ${lastActiveApp.windowClass}`)
      }

      // Use actualTimeSpent instead of timeSpent for recording
      const recordTime = actualTimeSpent
      const formattedDate = getFormattedDate()
      const formattedHour = getFormattedHour()

      if (!appUsageData.hasOwnProperty(formattedDate)) {
        appUsageData[formattedDate] = { apps: {} }
      }
      if (!appUsageData[formattedDate].hasOwnProperty(formattedHour)) {
        appUsageData[formattedDate][formattedHour] = {}
      }

      const appClass = lastActiveApp.windowClass
      const appDescription = await getProcessDetails(lastActiveApp.windowPid)
      //  const appDescription = processInfo ? processInfo.description : appClass;

      if (appClass == 'chrome.exe' || appClass == 'brave.exe') {
        // active_url is already set in the main detection logic above
        updateChromeTime(
          formattedDate,
          lastActiveApp.windowName,
          appDescription.description,
          active_url,
          recordTime,
          formattedHour,
          hasAppSwitched
        )
      } else {
        updateAppTime(
          formattedDate,
          appClass,
          appDescription.description,
          recordTime,
          formattedHour,
          hasAppSwitched
        )
      }
    }
  }

  lastActiveApp = currentWindow
  lastUpdateTime = currentTime
}

function updateAppTime(
  formattedDate,
  appClass,
  description,
  timeSpent,
  formattedHour,
  hasAppSwitched
) {
  if (!appUsageData[formattedDate].apps.hasOwnProperty(appClass)) {
    appUsageData[formattedDate].apps[appClass] = {
      time: 0,
      category: getCategory(description || appClass),
      description: description,
      timestamps: []
    }
  }

  appUsageData[formattedDate].apps[appClass].time += timeSpent
  appUsageData[formattedDate].apps[appClass].category = getCategory(description || appClass)

  // Only add timestamps when app is switched or on first entry
  if (hasAppSwitched || appUsageData[formattedDate].apps[appClass].timestamps.length === 0) {
    appUsageData[formattedDate].apps[appClass].timestamps.push({
      start: new Date().toString(),
      duration: timeSpent
    })
  } else {
    // Update the duration of the last timestamp entry instead of adding a new one
    const lastIndex = appUsageData[formattedDate].apps[appClass].timestamps.length - 1
    if (lastIndex >= 0) {
      // Check if the last timestamp is recent (within last 5 seconds)
      const lastTimestamp = appUsageData[formattedDate].apps[appClass].timestamps[lastIndex]
      const lastStart = new Date(lastTimestamp.start)
      const now = new Date()
      const timeDiff = now - lastStart
      
      // If last timestamp is recent, update it
      if (timeDiff < 5000) {
        lastTimestamp.duration += timeSpent
      } else {
        // Otherwise, add a new timestamp
        appUsageData[formattedDate].apps[appClass].timestamps.push({
          start: new Date().toString(),
          duration: timeSpent
        })
      }
    }
  }

  if (!appUsageData[formattedDate][formattedHour].hasOwnProperty(appClass)) {
    appUsageData[formattedDate][formattedHour][appClass] = {
      time: 0,
      category: getCategory(description || appClass),
      description: description,
      timestamps: []
    }
  }

  appUsageData[formattedDate][formattedHour][appClass].time += timeSpent
  appUsageData[formattedDate][formattedHour][appClass].category = getCategory(
    description || appClass
  )

  const timestamps = appUsageData[formattedDate][formattedHour][appClass].timestamps

  if (timestamps.length === 0) {
    // First entry for this app in this hour
    timestamps.push({
      start: new Date().toString(),
      duration: timeSpent
    })
  } else {
    // Check if the last timestamp is recent (within last 5 seconds)
    const lastTimestamp = timestamps[timestamps.length - 1]
    const lastStart = new Date(lastTimestamp.start)
    const now = new Date()
    const timeDiff = now - lastStart

    // If last timestamp is recent and we're on the same app, update it
    // Otherwise, create a new timestamp (genuine app switch)
    if (timeDiff < 5000 && !hasAppSwitched) {
      // 5 seconds threshold (reduced from 10 seconds)
      lastTimestamp.duration += timeSpent
    } else {
      timestamps.push({
        start: new Date().toString(),
        duration: timeSpent
      })
    }
  }
  if (appUsageData[formattedDate][formattedHour][appClass].time > 3600000) {
    console.warn(
      `Hour ${formattedHour} for ${appClass} exceeds 1 hour: ${appUsageData[formattedDate][formattedHour][appClass].time}ms`
    )
  }
}

function updateChromeTime(
  formattedDate,
  windowName,
  description,
  active_url,
  timeSpent,
  formattedHour,
  hasAppSwitched
) {
  // Use active_url as the key for better app identification, fallback to windowName
  // If active_url is null and windowName contains site info, try to extract it
  let appKey = active_url || windowName

  // If we don't have active_url but windowName might contain useful info, try to extract site name
  if (!active_url && windowName && windowName !== 'Google Chrome' && windowName !== 'Brave') {
    // Try to extract site name from window title (e.g. "Facebook - Google Chrome" -> "Facebook")
    const siteMatch = windowName.match(/^(.+?)\s*-\s*(Google Chrome|Brave)$/i)
    if (siteMatch) {
      appKey = siteMatch[1].trim()
    }
  }

  console.log(`UpdateChromeTime: appKey="${appKey}", active_url="${active_url}", windowName="${windowName}"`)

  if (!appUsageData[formattedDate].apps.hasOwnProperty(appKey)) {
    appUsageData[formattedDate].apps[appKey] = {
      time: 0,
      category: getCategory(active_url || appKey || description || windowName),
      domain: active_domain || active_url,
      description: description,
      timestamps: []
    }
    console.log(`Created new app entry for: ${appKey}, domain: ${active_domain || active_url}`)
  }

  appUsageData[formattedDate].apps[appKey].time += timeSpent
  appUsageData[formattedDate].apps[appKey].category = getCategory(
    active_url || appKey || description || windowName
  )

  console.log(`Updated time for ${appKey}: ${appUsageData[formattedDate].apps[appKey].time}ms`)

  // Only add timestamps when app/tab is switched or on first entry
  if (hasAppSwitched || appUsageData[formattedDate].apps[appKey].timestamps.length === 0) {
    appUsageData[formattedDate].apps[appKey].timestamps.push({
      start: new Date().toString(),
      duration: timeSpent
    })
  } else {
    // Update the duration of the last timestamp entry instead of adding a new one
    const lastIndex = appUsageData[formattedDate].apps[appKey].timestamps.length - 1
    if (lastIndex >= 0) {
      // Check if the last timestamp is recent (within last 5 seconds)
      const lastTimestamp = appUsageData[formattedDate].apps[appKey].timestamps[lastIndex]
      const lastStart = new Date(lastTimestamp.start)
      const now = new Date()
      const timeDiff = now - lastStart

      // If last timestamp is recent, update it
      if (timeDiff < 5000) {
        lastTimestamp.duration += timeSpent
      } else {
        // Otherwise, add a new timestamp
        appUsageData[formattedDate].apps[appKey].timestamps.push({
          start: new Date().toString(),
          duration: timeSpent
        })
      }
    }
  }

  if (!appUsageData[formattedDate][formattedHour].hasOwnProperty(appKey)) {
    appUsageData[formattedDate][formattedHour][appKey] = {
      time: 0,
      category: getCategory(active_url || description || windowName),
      domain: active_domain || active_url,
      description: description,
      timestamps: []
    }
  }

  appUsageData[formattedDate][formattedHour][appKey].time += timeSpent
  appUsageData[formattedDate][formattedHour][appKey].category = getCategory(
    active_url || description || windowName
  )

  const timestamps = appUsageData[formattedDate][formattedHour][appKey].timestamps

  if (timestamps.length === 0) {
    // First entry for this app in this hour
    timestamps.push({
      start: new Date().toString(),
      duration: timeSpent
    })
  } else {
    // Check if the last timestamp is recent (within last 5 seconds)
    const lastTimestamp = timestamps[timestamps.length - 1]
    const lastStart = new Date(lastTimestamp.start)
    const now = new Date()
    const timeDiff = now - lastStart

    // If last timestamp is recent and we're on the same app, update it
    // Otherwise, create a new timestamp (genuine app switch)
    if (timeDiff < 5000 && !hasAppSwitched) {
      // 5 seconds threshold (reduced from 10 seconds)
      lastTimestamp.duration += timeSpent
    } else {
      timestamps.push({
        start: new Date().toString(),
        duration: timeSpent
      })
    }
  }
}

function getFormattedDate() {
  const currentDate = new Date()
  const year = currentDate.getFullYear()
  const month = String(currentDate.getMonth() + 1).padStart(2, '0')
  const day = String(currentDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
function getFormattedHour() {
  const currentDate = new Date()
  const hour = String(currentDate.getHours()).padStart(2, '0')
  return `${hour}:00`
}
function handleDismiss(currentAppIdentifier) {
  const currentTime = Date.now()

  if (dismissedApps[currentAppIdentifier]) {
    if (startDismisstime) {
      const totaldismissTime = currentTime - startDismisstime
      if (totaldismissTime > 60000 * 5) {
        dismissedApps = {}
        startDismisstime = 0
      }
    }
    return true
  }

  return false
}

async function handlePopup(appIdentifier, currentWindow, isDismissed) {
  if (!isCoolDown) {
    console.log('popup handling')
    if (!isDismissed) sendPopupMessage(currentWindow)
  }
}

async function sendPopupMessage(currentWindow) {
  // Validate currentWindow before proceeding
  if (!currentWindow || !currentWindow.windowClass) {
    console.log('Popup blocked: Invalid or undefined window information')
    return
  }

  if (currentWindow.windowClass === 'chrome.exe' || currentWindow.windowClass === 'brave.exe') {
    const pid = await getChromePid(currentWindow)
    if (pid) {
      const chromeTabInfo = await getActiveChromeTab(pid)
      active_url = String(chromeTabInfo.active_app)
      active_domain = chromeTabInfo.domain || chromeTabInfo.active_app
    }
    
    // Validate active_url before sending
    if (!active_url || active_url === 'undefined' || active_url === 'null' || active_url.trim() === '') {
      console.log('Popup blocked: Invalid or undefined browser tab information')
      return
    }
    
    ipcRenderer.send('show-popup-message', active_url, pid)
  } else {
    // Validate windowClass before sending
    const appName = currentWindow.windowClass
    if (!appName || appName === 'undefined' || appName === 'null' || appName.trim() === '') {
      console.log('Popup blocked: Invalid or undefined application name:', appName)
      return
    }
    
    ipcRenderer.send('show-popup-message', appName, currentWindow.windowPid)
  }
}

async function getChromePid(currentwindow) {
  try {
    return currentwindow.windowPid
  } catch (error) {
    console.error('Error fetching Chrome PID:', error)
  }
  return null
}

loadCustomCategoryMappings().then((mappings) => {
  customCategoryMappings = mappings
  console.log('Loaded custom category mappings:', mappings)
})

loadExclusionList().then((list) => {
  exclusionList = list
  console.log('Loaded exclusion list:', list)
})

function getCategory(app) {
  const title = app.toLowerCase()

  // First check if we have a custom mapping for this app
  if (customCategoryMappings[app]) {
    console.log('Category ', customCategoryMappings[app])
    return customCategoryMappings[app]
  }

  // Then follow your existing logic
  for (const [category, details] of Object.entries(APP_CATEGORIES)) {
    for (const app of details.apps) {
      if (title.includes(app.toLowerCase())) {
        return category
      }
    }
  }

  for (const [category, details] of Object.entries(APP_CATEGORIES)) {
    for (const keyword of details.keywords) {
      if (title.includes(keyword.toLowerCase())) {
        return category
      }
    }
  }

  return 'Miscellaneous'
}

function getCategoryColor(cat) {
  if (APP_CATEGORIES.hasOwnProperty(cat)) {
    return APP_CATEGORIES[cat].color
  }

  return '#7a7a7a'
}

function getCategoryAppsData(date, detailedView = false) {
  const apps_data = {}
  if (appUsageData[date] && appUsageData[date].apps) {
    for (const [app, appData] of Object.entries(appUsageData[date].apps)) {
      const { category, time, domain } = appData
      const color = getCategoryColor(category)
      if (!apps_data[category]) {
        apps_data[category] = []
      }

      apps_data[category].push({ app, time, color, domain })
    }
    const appData = mergeTimeByDomain(apps_data, detailedView)
    return appData
  } else {
    return null
  }
}

function extractDomainName(domain, appName) {
  const capitalize = (str) => (str ? str.charAt(0).toUpperCase() + str.slice(1) : '')
  
  // Prefer a domain/host if available and normalize it generically
  if (domain && domain !== 'undefined' && domain !== 'null') {
    try {
      // Remove protocol, www prefix, query and path, then lowercase
      let clean = String(domain)
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
        .split('?')[0]
        .toLowerCase()

      // Split parts and discard empties
      const parts = clean.split('.').filter(Boolean)
      if (parts.length === 0) return domain

      // Generic subdomain handling: prefer the registrable part (second-level)
      // This works for most TLDs; if there are 3+ parts, drop the left-most if it's generic
      const genericSubs = new Set(['www', 'app', 'web', 'api', 'cdn', 'm', 'mobile'])
      if (parts.length >= 3 && genericSubs.has(parts[0])) {
        // e.g., www.youtube.com -> YouTube
        return capitalize(parts[parts.length - 2])
      }

      // If there are 3+ parts and the first subdomain looks meaningful (e.g., mail.google.com),
      // use the main registrable domain as service name to keep grouping stable (Google, Microsoft, Reddit, etc.)
      if (parts.length >= 3) {
        return capitalize(parts[parts.length - 2])
      }

      // Otherwise for domain.tld -> domain
      return capitalize(parts[0])
    } catch (e) {
      console.log('Error parsing domain:', domain, e)
    }
  }

  // Fallback: Extract service name from window title
  // Examples: "Video - YouTube", "Email - Gmail", "Page - Service - Browser"
  if (appName) {
    let name = String(appName).trim()
    
    // 1) Remove leading counters like "(198) "
    name = name.replace(/^\(\d+\)\s*/, '')

    // 2) Drop browser suffixes
    name = name
      .replace(/ - Google Chrome$/i, '')
      .replace(/ - Brave$/i, '')
      .replace(/ - Microsoft Edge$/i, '')
      .replace(/ - Edge$/i, '')
      .replace(/ - Firefox$/i, '')
      .replace(/ - Safari$/i, '')
      .trim()

    // 3) Extract last segment from " - " separated title (this is usually the service name)
    // Example: "Everything You Need to Know - Gmail" -> "Gmail"
    if (name.includes(' - ')) {
      const parts = name.split(' - ').map(s => s.trim()).filter(Boolean)
      if (parts.length > 0) {
        // Get the last segment as it's typically the service name
        name = parts[parts.length - 1]
      }
    }

    // 4) If it looks like a process name (e.g., Code.exe), strip extension
    const exe = name.match(/^([A-Za-z0-9 _-]+)\.exe$/i)
    if (exe) {
      name = exe[1]
    }

    // 5) Clean up special cases where title might still be too long
    // Limit overly long titles for display, but keep grouping stable
    if (name.length > 40) {
      name = name.slice(0, 40) + '...'
    }
    
    if (name) return capitalize(name)
  }

  return domain || appName || 'Unknown'
}

function mergeTimeByDomain(data, detailedView = false) {
  const result = {}

  for (const category in data) {
    const entries = data[category]
    const domainMap = new Map()

    entries.forEach((entry) => {
      let key

      if (detailedView) {
        // In detailed view, show individual tab titles/app names
        key = entry.app
      } else {
        // In summary view, group by domain/service
        key = extractDomainName(entry.domain, entry.app)
      }

      if (domainMap.has(key)) {
        const existing = domainMap.get(key)
        existing.time += entry.time
        // Keep the domain info for summary view
        if (!detailedView) {
          existing.app = key
        }
      } else {
        const newEntry = { ...entry }
        if (!detailedView) {
          newEntry.app = key
        }
        domainMap.set(key, newEntry)
      }
    })

    result[category] = Array.from(domainMap.values())
  }

  return result
}

// Debouncing variables
let updateAppUsageTimeout = null
let lastUpdateAppUsageCall = 0
const DEBOUNCE_DELAY = 2000 // 2 seconds debounce

// Debounced version of updateAppUsage
function debouncedUpdateAppUsage() {
  const now = Date.now()
  const timeSinceLastCall = now - lastUpdateAppUsageCall
  
  
  // Clear existing timeout
  if (updateAppUsageTimeout) {
    clearTimeout(updateAppUsageTimeout)
  }
  
  // If enough time has passed, execute immediately
  if (timeSinceLastCall > DEBOUNCE_DELAY) {
    updateAppUsage()
    lastUpdateAppUsageCall = now
  } else {
    // Otherwise, schedule for later
    updateAppUsageTimeout = setTimeout(() => {
      updateAppUsage()
      lastUpdateAppUsageCall = Date.now()
    }, DEBOUNCE_DELAY - timeSinceLastCall)
  }
}

// More frequent window checking for better accuracy
setInterval(async () => {
  try {
    const currentWindow = await getActiveWindow()
    if (currentWindow && lastActiveApp) {
      // Check if app has changed - either different application or different browser tab
      const currentAppClass = currentWindow.windowClass
      const currentAppName = currentWindow.windowName
      
      const hasAppSwitched =
        (lastActiveApp && currentAppClass !== lastActiveApp.windowClass) ||
        ((currentAppClass === 'chrome.exe' || currentAppClass === 'brave.exe') &&
          lastActiveApp &&
          lastActiveApp.windowClass === currentAppClass &&
          currentAppName !== lastActiveApp.windowName)
      
      // If app switched, update immediately
      if (hasAppSwitched) {
        console.log(`App switched detected: ${lastActiveApp.windowClass} -> ${currentAppClass}`)
        debouncedUpdateAppUsage()
      }
    }
  } catch (error) {
    console.error('Error in fast window check:', error)
  }
}, 5000) // Check every 5 seconds for window changes

setInterval(debouncedUpdateAppUsage, 15000) // Regular updates every 15 seconds
setInterval(() => {
  saveData().catch((err) => console.error('Error in saveData interval:', err))
}, 60000)

// Periodic focus session status sync - check every 10 seconds
setInterval(async () => {
  try {
    const currentSession = await getCurrentSessionStatus()
    const shouldBeActive = currentSession && (currentSession.status === 'active' || currentSession.status === 'paused')
    
    if (shouldBeActive && !isFocusSessionActive) {
      isFocusSessionActive = true
      console.log('Focus session detected - enabling popup system:', currentSession._id)
    } else if (!shouldBeActive && isFocusSessionActive) {
      isFocusSessionActive = false
      console.log('Focus session ended - disabling popup system')
    }
  } catch (error) {
    console.error('Error syncing focus session status:', error)
  }
}, 10000)

async function loadCategories() {
  const data = await ipcRenderer.invoke('load-categories')
  console.log('ipcRenderer ', data)
  return data
}

async function loadData() {
  try {
    appUsageData = await ipcRenderer.invoke('load-data')
    return appUsageData
  } catch (error) {
    console.error('Error loading data via IPC:', error)
    return {}
  }
}

async function saveData() {
  try {
    await ipcRenderer.invoke('save-data', appUsageData)
    console.log('saved data')
  } catch (error) {
    console.error('Error saving data via IPC:', error)
  }
}
async function getAppUsageStats(date) {
  if (Object.keys(appUsageData).length === 0) {
    await loadData()
  }

  if (date && appUsageData[date]) {
    return {
      [date]: appUsageData[date]
    }
  }

  return appUsageData
}

function getAppUsageRange(startDate, endDate) {
  const filteredData = {}

  const start = new Date(startDate)
  const end = new Date(endDate)

  for (const [date, data] of Object.entries(appUsageData)) {
    const currentDate = new Date(date)
    if (currentDate >= start && currentDate <= end) {
      filteredData[date] = data
    }
  }

  return filteredData
}
contextBridge.exposeInMainWorld('electronAPI', {
  sendToMain: (channel, data) => {
    const validChannels = ['stay-focused', 'cooldown', 'dismiss']
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  // Focus Session API
  startFocusSession: (sessionData) => ipcRenderer.invoke('start-focus-session', sessionData),
  stopFocusSession: (sessionId) => ipcRenderer.invoke('stop-focus-session', sessionId),
  pauseFocusSession: (sessionId) => ipcRenderer.invoke('pause-focus-session', sessionId),
  resumeFocusSession: (sessionId) => ipcRenderer.invoke('resume-focus-session', sessionId),
  cancelFocusSession: (sessionId) => ipcRenderer.invoke('cancel-focus-session', sessionId),
  getCurrentFocusSession: () => ipcRenderer.invoke('get-current-focus-session'),
  getFocusSessionStats: () => ipcRenderer.invoke('get-focus-session-stats'),
  getFocusSessionsByDate: (startDate, endDate) =>
    ipcRenderer.invoke('get-focus-sessions-by-date', startDate, endDate),
  addFocusSessionInterruption: (sessionId, reason, appName) =>
    ipcRenderer.invoke('add-focus-session-interruption', sessionId, reason, appName),
  rateFocusSession: (sessionId, productivity, notes) =>
    ipcRenderer.invoke('rate-focus-session', sessionId, productivity, notes),
  showNotification: (options) => ipcRenderer.invoke('show-notification', options),
  // Popup analytics and controls
  getPopupStats: () => ipcRenderer.invoke('get-popup-stats'),
  updatePopupPreferences: (preferences) =>
    ipcRenderer.invoke('update-popup-preferences', preferences),
  cleanupPopupDismissals: () => ipcRenderer.invoke('cleanup-popup-dismissals'),
  // Data Aggregation API
  getAggregatedDataByDate: (date) => ipcRenderer.invoke('get-aggregated-data-by-date', date),
  getAllAggregatedData: () => ipcRenderer.invoke('get-all-aggregated-data'),
  getFormattedUsageData: (startDate, endDate) => ipcRenderer.invoke('get-formatted-usage-data', startDate, endDate),
  getProductivitySummary: (date) => ipcRenderer.invoke('get-productivity-summary', date),
  cleanupDatabase: () => ipcRenderer.invoke('cleanup-database'),
  // AI Service API
  aiChat: (message) => ipcRenderer.invoke('ai-chat', message),
  getAiServiceStatus: () => ipcRenderer.invoke('ai-service-status'),
  restartAiService: () => ipcRenderer.invoke('ai-service-restart'),
  resetAiMemory: () => ipcRenderer.invoke('ai-service-reset-memory'),
  // Python Error Recovery API
  getPythonStatus: () => ipcRenderer.invoke('get-python-status'),
  resetPythonRecovery: () => ipcRenderer.invoke('reset-python-recovery'),
  // Auto-startup API
  getAutoLaunchStatus: () => ipcRenderer.invoke('get-auto-launch-status'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-auto-launch', enabled),
  // Exclusion List API
  getExclusionList: () => ipcRenderer.invoke('get-exclusion-list'),
  addToExclusionList: (identifier, type) => ipcRenderer.invoke('add-to-exclusion-list', identifier, type),
  removeFromExclusionList: (identifier, type) => ipcRenderer.invoke('remove-from-exclusion-list', identifier, type),
  isExcluded: (identifier, type) => ipcRenderer.invoke('is-excluded', identifier, type),
  clearExclusionList: () => ipcRenderer.invoke('clear-exclusion-list'),
})

contextBridge.exposeInMainWorld('activeWindow', {
  getAppUsageStats: (date) => getAppUsageStats(date),
  getDistractedCat: () => loadDistractedCat(),
  getAppUsageRange: (startDate, endDate) => getAppUsageRange(startDate, endDate),
  getFormattedStats: (date) => getFormattedStats(date),
  getCategoryAppsData: (date, detailedView) => getCategoryAppsData(date, detailedView),
  getCategoryColor: (cat) => getCategoryColor(cat),
  getFocusQualityData: (date, startHour, endHour) => ipcRenderer.invoke('get-focus-quality-data', date, startHour, endHour),
  send: (channel, ...data) => ipcRenderer.send(channel, ...data),
  updateFocusUI: (callback) => {
    ipcRenderer.on('start-focus', (event, isFocused, timeDisplay) => {
      callback('start', isFocused, timeDisplay)
    })
    ipcRenderer.on('end-focus', (event, isFocused) => {
      callback('end', isFocused)
    })
    ipcRenderer.on('pause-focus', (event) => {
      callback('pause')
    })
    ipcRenderer.on('resume-focus', (event) => {
      callback('resume')
    })
  },
  onCategoryUpdated: (callback) => {
    ipcRenderer.on('app-category-updated', (event, data) => {
      callback(data)
    })
  },
  loadCategories: () => loadCategories(),
  refreshData: () => loadData(),
  updateAppCategory: (appIdentifier, category, selectedDate, appToUpdate) =>
    updateAppCategory(appIdentifier, category, selectedDate, appToUpdate)
})

function getFormattedStats(date) {
  const stats = {}
  if (appUsageData[date] && appUsageData[date].apps) {
    for (const [, appData] of Object.entries(appUsageData[date].apps)) {
      if (!stats.hasOwnProperty(appData.category)) {
        stats[appData.category] = 0
      }
      stats[appData.category] += appData.time
    }
    return stats
  } else {
    return null
  }
}

function handlecooldown() {
  isCoolDown = true
  setTimeout(() => {
    isCoolDown = false
  }, 60000 * 5)
}
ipcRenderer.on('cooldown', () => {
  handlecooldown()
})

ipcRenderer.on('dismiss', (event, appName) => {
  if (appName) {
    startDismisstime = Date.now()
    let appCat = getCategory(appName)

    if (Distracted_List.includes(appCat)) {
      dismissedApps[appCat] = true
      console.log('dismissedapps', dismissedApps)
    }
  }
})

async function updateAppCategory(appIdentifier, category, selectedDate, appKey) {
  try {
    const customCategoriesMap = await loadCustomCategoryMappings()

    customCategoriesMap[appIdentifier] = category

    if (appUsageData[selectedDate]) {
      if (appUsageData[selectedDate].apps && appUsageData[selectedDate].apps[appKey]) {
        appUsageData[selectedDate].apps[appKey].category = category
      }

      for (const [key, value] of Object.entries(appUsageData[selectedDate])) {
        if (key === 'apps') continue

        if (value[appKey]) {
          value[appKey].category = category
        }
      }

      await saveData()
      console.log('appUsageData[selectedDate]', appUsageData[selectedDate])
    }
    await saveCustomCategoryMappings(customCategoriesMap)
    
    // Notify main process to broadcast category update to all windows
    ipcRenderer.send('app-category-updated', { appIdentifier, category, selectedDate })
    
    return true
  } catch (error) {
    console.error('Error updating app category:', error)
    return false
  }
}

// Helper functions for loading/saving custom category mappings
async function loadCustomCategoryMappings() {
  try {
    const mappings = await ipcRenderer.invoke('load-custom-categories')
    return mappings || {}
  } catch (error) {
    console.error('Error loading custom category mappings:', error)
    return {}
  }
}

async function saveCustomCategoryMappings(mappings) {
  try {
    await ipcRenderer.invoke('save-custom-categories', mappings)
    return true
  } catch (error) {
    console.error('Error saving custom category mappings:', error)
    return false
  }
}

function loadDistractedCat() {
  return Distracted_List
}

// Helper functions for loading/managing exclusion list
async function loadExclusionList() {
  try {
    const list = await ipcRenderer.invoke('get-exclusion-list')
    return list || { apps: [], domains: [] }
  } catch (error) {
    console.error('Error loading exclusion list:', error)
    return { apps: [], domains: [] }
  }
}

// Listen for category updates from main process
ipcRenderer.on('categories-updated', (event, categories) => {
  if (categories && Array.isArray(categories) && categories.length > 1) {
    Distracted_List = categories[1] // Update distracted categories
    console.log('Distracted categories updated:', Distracted_List)
  }
})

// Listen for exclusion list updates from main process
ipcRenderer.on('exclusion-list-updated', (event, list) => {
  if (list) {
    exclusionList = list
    console.log('Exclusion list updated:', exclusionList)
  }
})
