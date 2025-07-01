const { contextBridge, ipcRenderer } = require('electron')
const activeWindows = require('electron-active-window')
const { spawn } = require('child_process')
import { json } from 'stream/consumers'
import APP_CATEGORIES from './categories'
import { time } from 'console'
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
  const state = await ipcRenderer.invoke('idle-state', threshold)
  console.log('state', state)
  return state
}
let previousWindowClass = null
let previousWindowName = null
let hasAppSwitched = false

async function updateAppUsage() {
  try {
    const state = await getCurrentState(120)
    if (state == 'idle' || state == 'locked') return
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
function startFocusSession(isFocused) {
  console.log('Focus started')
  isFocusSessionActive = true
  focusSessionStartTime = Date.now()
  ipcRenderer.send('start-focus', isFocused)
}
function endFocusSession(isFocused) {
  isFocusSessionActive = false
  ipcRenderer.send('end-focus', isFocused)
  const focusTime = Date.now() - focusSessionStartTime
  totalFocusTime += focusTime
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
    if (timeSpent > 1000 * 10) {
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
          timeSpent,
          formattedHour,
          hasAppSwitched
        )
      } else {
        updateAppTime(
          formattedDate,
          appClass,
          appDescription.description,
          timeSpent,
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
  if (currentWindow.windowClass === 'chrome.exe' || currentWindow.windowClass === 'brave.exe') {
    const pid = await getChromePid(currentWindow)
    if (pid) {
      const chromeTabInfo = await getActiveChromeTab(pid)
      active_url = String(chromeTabInfo.active_app)
    }
    ipcRenderer.send('show-popup-message', active_url, pid)
  } else {
    ipcRenderer.send('show-popup-message', currentWindow.windowClass)
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
  }
})

contextBridge.exposeInMainWorld('activeWindow', {
  getAppUsageStats: (date) => getAppUsageStats(date),
  getDistractedCat: () => loadDistractedCat(),
  getAppUsageRange: (startDate, endDate) => getAppUsageRange(startDate, endDate),
  getFormattedStats: (date) => getFormattedStats(date),
  getCategoryAppsData: (date) => getCategoryAppsData(date),
  getCategoryColor: (cat) => getCategoryColor(cat),
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
