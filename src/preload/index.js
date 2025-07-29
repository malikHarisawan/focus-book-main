const { contextBridge, ipcRenderer } = require('electron')
const activeWindows = require('electron-active-window')
const { spawn } = require('child_process')
import APP_CATEGORIES from './categories'
const { exec } = require('child_process')
const util = require('util')
const execPromise = util.promisify(exec)
const path = require('path')
let appUsageData = {}
let lastActiveApp = null
let lastUpdateTime = Date.now()
let Distracted_List = ['Entertainment']
let customCategoryMappings = {}


// Initialize tracking data
;(async function initializeTracking() {
  try {
    const currentWindow = await getActiveWindow()
    if (currentWindow && currentWindow.windowClass) {
      lastActiveApp = currentWindow
      lastUpdateTime = Date.now()
      console.log('Initialized tracking with app:', currentWindow.windowClass)
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
let isFocusSessionActive = false
let dismissedApps = {}
let isCoolDown = false
let startDismisstime = 0
let focusSessionStartTime = 0
let totalFocusTime = 0
loadData()

async function getActiveChromeTab(pid) {
  if (!pid) {
    console.warn('Invalid PID: Cannot fetch Chrome tab info')
    return null
  }

  return new Promise((resolve, reject) => {
    const getURLScriptPath = path.join(__dirname, '../../scripts/get_active_url.py')
    const pythonProcess = spawn('python', [getURLScriptPath, pid.toString()])

    let output = ''
    let error = ''

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString()
    })

    pythonProcess.stderr.on('data', (data) => {
      error += data.toString()
    })

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output)
          resolve(result)
        } catch (parseError) {
          reject(`Error parsing JSON: ${parseError.message}`)
        }
      } else {
        reject(`Python process exited with code ${code}: ${error}`)
      }
    })
  })
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

async function updateAppUsage() {
  try {
    const state = await getCurrentState(120)
    if (state == 'idle' || state == 'locked' || state == 'unknown') {
      // Reset tracking variables when system is idle/locked/unknown to prevent false data recording
      console.log(`System is ${state}, resetting tracking variables`)
      lastActiveApp = null
      lastUpdateTime = Date.now()
      return
    }
    console.log('State ===>> ', state)
    const currentWindow = await getActiveWindow()
    if (!isValidWindow(currentWindow)) {
      return
    }
    const currentAppClass = currentWindow.windowClass
    const currentAppName = currentWindow.windowName

    // Check if app has changed - either different application or different browser tab
    hasAppSwitched =
      (lastActiveApp && currentAppClass !== lastActiveApp.windowClass) ||
      ((currentAppClass === 'chrome.exe' || currentAppClass === 'brave.exe') &&
        lastActiveApp &&
        lastActiveApp.windowClass === currentAppClass &&
        currentAppName !== lastActiveApp.windowName)

    if (hasAppSwitched) {
      console.log(
        `App switched: From ${lastActiveApp ? lastActiveApp.windowClass : 'unknown'} to ${currentAppClass}`
      )
    }

    let appIdentifier =
      currentWindow.windowClass == 'chrome.exe' || currentWindow.windowClass === 'brave.exe'
        ? getCategory(currentWindow.windowName)
        : getCategory(currentWindow.windowClass)

    console.log('appIdentifier ==>> ', appIdentifier)
    const isFocused = !Distracted_List.includes(appIdentifier)
    let isDismissed = handleDismiss(appIdentifier)

    if (isFocused) {
      startFocusSession(isFocused)
    }

    if (!isFocused && isFocusSessionActive) {
      console.log('isFocusSessionActive', isFocusSessionActive)
      handlePopup(appIdentifier, currentWindow, isDismissed)
      endFocusSession(isFocused)
    }
    previousWindowClass = currentAppClass
    previousWindowName = currentAppName

    updateUsageData(currentWindow, hasAppSwitched)
  } catch (error) {
    console.error('Error updating app usage:', error)
  }
}
async function startFocusSession(isFocused) {
  console.log('Focus started - starting actual focus session')

  if (!isFocusSessionActive) {
    try {
      // Start an actual focus session via IPC
      const sessionData = {
        type: 'focus',
        duration: 25 * 60 * 1000, // 25 minutes in milliseconds
        isAutoStarted: true
      }

      const session = await ipcRenderer.invoke('start-focus-session', sessionData)

      if (session && !session.error) {
        isFocusSessionActive = true
        focusSessionStartTime = Date.now()
        console.log('Auto-started focus session:', session._id)

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
        const pid = await getChromePid(lastActiveApp)

        if (pid) {
          const chromeTabInfo = await getActiveChromeTab(pid)
          active_url = String(chromeTabInfo.active_app)
          if (active_url === 'undefined') active_url = null
        }
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
      appUsageData[formattedDate].apps[appClass].timestamps[lastIndex].duration += timeSpent
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
    // Check if the last timestamp is recent (within last 10 seconds)
    const lastTimestamp = timestamps[timestamps.length - 1]
    const lastStart = new Date(lastTimestamp.start)
    const now = new Date()
    const timeDiff = now - lastStart

    // If last timestamp is recent and we're on the same app, update it
    // Otherwise, create a new timestamp (genuine app switch)
    if (timeDiff < 10000 && !hasAppSwitched) {
      // 10 seconds threshold
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
  if (!appUsageData[formattedDate].apps.hasOwnProperty(windowName)) {
    appUsageData[formattedDate].apps[windowName] = {
      time: 0,
      category: getCategory(active_url || description || windowName),
      domain: active_url,
      description: description,
      timestamps: []
    }
  }

  appUsageData[formattedDate].apps[windowName].time += timeSpent
  appUsageData[formattedDate].apps[windowName].category = getCategory(
    active_url || description || windowName
  )

  // Only add timestamps when app/tab is switched or on first entry
  if (hasAppSwitched || appUsageData[formattedDate].apps[windowName].timestamps.length === 0) {
    appUsageData[formattedDate].apps[windowName].timestamps.push({
      start: new Date().toString(),
      duration: timeSpent
    })
  } else {
    // Update the duration of the last timestamp entry instead of adding a new one
    const lastIndex = appUsageData[formattedDate].apps[windowName].timestamps.length - 1
    if (lastIndex >= 0) {
      appUsageData[formattedDate].apps[windowName].timestamps[lastIndex].duration += timeSpent
    }
  }

  if (!appUsageData[formattedDate][formattedHour].hasOwnProperty(windowName)) {
    appUsageData[formattedDate][formattedHour][windowName] = {
      time: 0,
      category: getCategory(active_url || description || windowName),
      domain: active_url,
      description: description,
      timestamps: []
    }
  }

  appUsageData[formattedDate][formattedHour][windowName].time += timeSpent
  appUsageData[formattedDate][formattedHour][windowName].category = getCategory(
    active_url || description || windowName
  )

  const timestamps = appUsageData[formattedDate][formattedHour][windowName].timestamps

  if (timestamps.length === 0) {
    // First entry for this app in this hour
    timestamps.push({
      start: new Date().toString(),
      duration: timeSpent
    })
  } else {
    // Check if the last timestamp is recent (within last 10 seconds)
    const lastTimestamp = timestamps[timestamps.length - 1]
    const lastStart = new Date(lastTimestamp.start)
    const now = new Date()
    const timeDiff = now - lastStart

    // If last timestamp is recent and we're on the same app, update it
    // Otherwise, create a new timestamp (genuine app switch)
    if (timeDiff < 10000 && !hasAppSwitched) {
      // 10 seconds threshold
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

function getCategoryAppsData(date) {
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
    const appData = mergeTimeByDomain(apps_data)
    return appData
  } else {
    return null
  }
}

function mergeTimeByDomain(data) {
  const result = {}

  for (const category in data) {
    const entries = data[category]
    const domainMap = new Map()

    entries.forEach((entry) => {
      const domainKey = entry.domain || entry.app

      if (domainMap.has(domainKey)) {
        const existing = domainMap.get(domainKey)
        existing.time += entry.time
      } else {
        domainMap.set(domainKey, { ...entry })
      }
    })

    result[category] = Array.from(domainMap.values())
  }

  return result
}

setInterval(updateAppUsage, 30000)
setInterval(() => {
  saveData().catch((err) => console.error('Error in saveData interval:', err))
}, 60000)

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
  restartAiService: () => ipcRenderer.invoke('ai-service-restart')
})

contextBridge.exposeInMainWorld('activeWindow', {
  getAppUsageStats: (date) => getAppUsageStats(date),
  getDistractedCat: () => loadDistractedCat(),
  getAppUsageRange: (startDate, endDate) => getAppUsageRange(startDate, endDate),
  getFormattedStats: (date) => getFormattedStats(date),
  getCategoryAppsData: (date) => getCategoryAppsData(date),
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
