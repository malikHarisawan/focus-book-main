const {
  app,
  powerMonitor,
  BrowserWindow,
  ipcMain,
  screen,
  Tray,
  Menu,
  globalShortcut,
  nativeImage
} = require('electron')
const { autoUpdater } = require('electron-updater')
// const { is } = require('@electron-toolkit/utils') // Removed to fix production build issue
const { exec, spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

// Helper function to get icon path
function getIconPath() {
  const isDev = process.env.NODE_ENV === 'development'
  let iconPath

  if (isDev) {
    // Development: use icon from project root
    iconPath = path.join(__dirname, '../../icon.png')
  } else {
    // Production: try multiple locations
    const locations = [
      path.join(process.resourcesPath, 'icon.png'),
      path.join(process.resourcesPath, 'app.asar', 'out', 'main', 'icon.png'),
      path.join(__dirname, 'icon.png')
    ]

    for (const location of locations) {
      if (fs.existsSync(location)) {
        iconPath = location
        break
      }
    }

    if (!iconPath) {
      iconPath = locations[0] // Fallback to first location
    }
  }

  return iconPath
}

// Helper function to filter excluded apps from usage data
async function filterExcludedApps(data, categoriesService) {
  if (!data || typeof data !== 'object') {
    return data
  }

  try {
    // Get the exclusion list (returns { apps: [], domains: [] })
    const exclusionList = await categoriesService.getExclusionList()
    const excludedApps = new Set(exclusionList.apps || [])
    const excludedDomains = new Set(exclusionList.domains || [])

    if (excludedApps.size === 0 && excludedDomains.size === 0) {
      return data // No exclusions, return original data
    }

    // Deep clone and filter the data
    const filteredData = {}

    for (const [dateStr, dayData] of Object.entries(data)) {
      filteredData[dateStr] = {}

      for (const [key, value] of Object.entries(dayData)) {
        if (key === 'apps') {
          // Filter apps at the day level
          filteredData[dateStr].apps = {}
          for (const [appName, appData] of Object.entries(value)) {
            // Skip if app is excluded
            if (excludedApps.has(appName)) {
              continue
            }
            // Skip if domain is excluded
            if (appData.domain && excludedDomains.has(appData.domain)) {
              continue
            }
            filteredData[dateStr].apps[appName] = appData
          }
        } else {
          // Filter apps at the hour level
          filteredData[dateStr][key] = {}
          for (const [appName, appData] of Object.entries(value)) {
            // Skip if app is excluded
            if (excludedApps.has(appName)) {
              continue
            }
            // Skip if domain is excluded
            if (appData.domain && excludedDomains.has(appData.domain)) {
              continue
            }
            filteredData[dateStr][key][appName] = appData
          }
        }
      }
    }

    return filteredData
  } catch (error) {
    console.error('Error filtering excluded apps:', error)
    return data // Return original data on error
  }
}

// Single instance lock - prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // Another instance is already running, quit this one
  console.log('Another instance of FocusBook is already running. Exiting...')
  app.quit()
} else {
  // Handle second instance attempt - focus the existing window
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('Second instance detected, focusing main window')
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    }
  })
}

const { hybridConnection } = require('./database/hybridConnection')
const focusSessionService = require('./database/focusSessionService')
const PopupManager = require('./popupManager')
const AIServiceManager = require('./aiServiceManager')
const PythonErrorRecovery = require('./pythonErrorRecovery')
// const backgroundSyncService = require('./database/backgroundSyncService') // Commented out for simplified architecture

let mainWindow = null
let popupWindow = null
let tray = null
let totalSeconds = 0
let timeDisplay = 0
let timerInterval = null
let app_name = null
let n_pid = null
let isCleaningUp = false
let popupManager = new PopupManager()
let aiServiceManager = new AIServiceManager()
let pythonErrorRecovery = new PythonErrorRecovery()

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    show: true,
    autoHideMenuBar: true,
    frame: false,
    title: 'FocusBook',
    titleBarStyle: 'hidden',
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (process.env.NODE_ENV === 'development' && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
  //   console.log('running in prod')
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
    console.log('main window loaded')
  
  }
  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault()
      mainWindow.hide()

      // Show notification on first minimize to tray
      if (!global.hasShownTrayNotification) {
        const { Notification } = require('electron')
        if (Notification.isSupported()) {
          const notification = new Notification({
            title: 'FocusBook is still running',
            body: 'FocusBook is minimized to system tray. Click the tray icon to restore or right-click to quit.',
            icon: getIconPath()
          })
          notification.show()
          global.hasShownTrayNotification = true
        }
      }
    }
    return false
  })

  // Add cleanup when window is destroyed
  mainWindow.on('closed', () => {
    clearAppTimers()
    mainWindow = null
  })
}

function clearAppTimers() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
  mainWindow.setSkipTaskbar(false)
}

function createPopUp() {
  if (popupWindow) return

  try {
    const cursorPosition = screen.getCursorScreenPoint()
    const distractedDisplay = screen.getDisplayNearestPoint(cursorPosition)
    const { x, y, width, height } = distractedDisplay.workArea
    const popupWidth = 600
    const popupHeight = 600
    const popupX = x + (width - popupWidth) / 2
    const popupY = y + (height - popupHeight) / 2

    popupWindow = new BrowserWindow({
      width: popupWidth,
      height: popupHeight,
      x: Math.round(popupX),
      y: Math.round(popupY),
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      fullscreen: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload/index.js')
      }
    })

    popupWindow.loadFile(path.join(__dirname, '../renderer/popup-enhanced.html'))

    popupWindow.on('closed', () => {
      popupWindow = null
    })
  } catch (error) {
    console.error('Error creating popup window:', error)
  }
}

// Configure auto-updater
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

autoUpdater.on('update-available', (info) => {
  console.log('🔔 Update available:', info.version)
  // Notify user about update
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info)
  }
})

autoUpdater.on('update-downloaded', (info) => {
  console.log('✅ Update downloaded:', info.version)
  // Notify user that update is ready
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info)
  }
})

autoUpdater.on('error', (err) => {
  console.error('❌ Auto-updater error:', err)
})

app.whenReady().then(async () => {
  try {
    await hybridConnection.connect()
    console.log('✅ SQLite database system initialized successfully')

    // Initialize data aggregation service
    // Data aggregation functionality is now handled directly by app usage service
    
    // Initialize focus session service
    try {
      await focusSessionService.getLocalService().initializeService()
      console.log('✅ Focus session service initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize focus session service:', error.message)
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize database system:', error.message)
    console.log('📋 The app will continue to run with reduced functionality.')
  }

  // Check for updates (only in production)
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
    setTimeout(() => {
      autoUpdater.checkForUpdates()
        .then(() => console.log('✅ Checked for updates'))
        .catch((err) => console.error('❌ Failed to check for updates:', err))
    }, 5000) // Check after 5 seconds
  }

  // Enable auto-startup on first run (for fresh installs)
  try {
    const loginItemSettings = app.getLoginItemSettings()
    if (!loginItemSettings.openAtLogin) {
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: false,
        path: process.execPath,
        args: []
      })
      console.log('✅ Auto-startup enabled for FocusBook')
    }
  } catch (error) {
    console.error('❌ Failed to enable auto-startup:', error.message)
  }

  // Start AI service with config from config.json
  try {
    const userDataPath = app.getPath('userData')
    const configPath = path.join(userDataPath, 'config.json')

    let aiConfig = {
      provider: 'openai',
      openaiKey: '',
      geminiKey: ''
    }

    // Read config.json if it exists
    if (fs.existsSync(configPath)) {
      try {
        const configData = fs.readFileSync(configPath, 'utf-8')
        const savedConfig = JSON.parse(configData)

        // Map config.json format to AIServiceManager format
        aiConfig.provider = savedConfig.provider || 'openai'
        if (savedConfig.provider === 'gemini') {
          aiConfig.geminiKey = savedConfig.apiKey || ''
        } else {
          aiConfig.openaiKey = savedConfig.apiKey || ''
        }

        console.log('📋 Loaded AI config from:', configPath)
        console.log('🤖 AI Provider:', aiConfig.provider)
      } catch (configError) {
        console.warn('⚠️ Could not parse config.json, using defaults:', configError.message)
      }
    }

    await aiServiceManager.start(aiConfig)
    console.log('✅ AI service started successfully')
  } catch (error) {
    console.error('❌ Failed to start AI service:', error.message)
    console.log('📋 AI insights will not be available.')
  }

  // Initialize Python error recovery system
  try {
    await pythonErrorRecovery.checkPythonAvailability()
    await pythonErrorRecovery.checkPythonDependencies()
    const status = pythonErrorRecovery.getStatus()
    if (status.pythonAvailable && !status.fallbackMode) {
      console.log('✅ Python environment verified successfully')
    } else {
      console.log('⚠️ Python environment not available, using fallback mode for browser detection')
    }
  } catch (error) {
    console.error('❌ Python error recovery initialization failed:', error.message)
  }

  createWindow()

  ipcMain.on('show-popup-message', async (event, appName, pid) => {
    if (isCleaningUp) return

    try {
      // Validate app name before proceeding
      if (!appName || appName.trim() === '' || appName === 'undefined' || appName === 'null') {
        console.log('Popup blocked: Invalid or undefined app name:', appName)
        return
      }

      // Get current focus session
      const currentSession = focusSessionService.getCurrentSession()

      // Check if popup should be shown using smart timing
      if (!popupManager.shouldShowPopup(appName, currentSession)) {
        console.log(`Popup blocked by smart timing for ${appName}`)
        return
      }

      console.log('pid', pid, 'appName', appName)
      app_name = appName
      n_pid = pid || null

      // Record popup shown and create popup
      popupManager.recordPopupShown(appName)
      createPopUp()
    } catch (error) {
      console.error('Error in popup trigger:', error)
    }
  })

  ipcMain.on('save-categories', async (event, data) => {
    try {
      const categoriesService = hybridConnection.getCategoriesService()
      const result = await categoriesService.saveCategories(data)
      
      // Notify all windows that categories have been updated
      if (result) {
        const updatedCategories = await categoriesService.getCategoriesForSettings()
        mainWindow?.webContents.send('categories-updated', updatedCategories)
      }
      
      return result
    } catch (error) {
      console.error('Error saving categories:', error)
      return false
    }
  })

  // Listen for app category changes and broadcast to all windows
  ipcMain.on('app-category-updated', (event, data) => {
    console.log('Broadcasting app category update:', data)
    mainWindow?.webContents.send('app-category-updated', data)
  })

  ipcMain.handle('load-categories', async (event) => {
    try {
      const categoriesService = hybridConnection.getCategoriesService()
      return await categoriesService.getCategoriesForSettings()
    } catch (error) {
      console.error('Error loading categories:', error)
      return [[], []]
    }
  })

  // Auto-updater IPC handlers
  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return result
    } catch (error) {
      console.error('Error checking for updates:', error)
      return null
    }
  })

  ipcMain.handle('download-update', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return true
    } catch (error) {
      console.error('Error downloading update:', error)
      return false
    }
  })

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('load-data', async () => {
    try {
      const appUsageService = hybridConnection.getAppUsageService()
      const categoriesService = hybridConnection.getCategoriesService()
      const data = await appUsageService.getAppUsageData()
      return await filterExcludedApps(data, categoriesService)
    } catch (error) {
      console.error('Error loading data:', error)
      return {}
    }
  })

  ipcMain.handle('save-data', async (event, appUsageData) => {
    try {
      const appUsageService = hybridConnection.getAppUsageService()
      return await appUsageService.bulkUpdateAppUsageData(appUsageData)
    } catch (error) {
      console.error('Error saving data:', error)
      return false
    }
  })

  ipcMain.handle('idle-state', async (event, idleThreshold) => {
    try {
      let state = powerMonitor.getSystemIdleState(idleThreshold)
      console.log(
        `[${new Date().toLocaleTimeString()}] System state: ${state} (threshold: ${idleThreshold}s)`
      )

      // Additional check for system sleep/wake
      if (state === 'active') {
        // Check if system was recently woken up by looking at uptime gaps
        // This is a basic check - more sophisticated detection could be added
        const currentTime = Date.now()
        if (!global.lastActiveCheck) {
          global.lastActiveCheck = currentTime
        }

        const timeSinceLastCheck = currentTime - global.lastActiveCheck
        global.lastActiveCheck = currentTime

        // If more than 10 minutes have passed since last check, system might have been sleeping
        if (timeSinceLastCheck > 10 * 60 * 1000) {
          console.log(
            `⚠️ Large time gap detected in idle checks: ${Math.round(timeSinceLastCheck / 60000)}min - system may have been sleeping`
          )
        }
      }

      return state
    } catch (error) {
      console.error('Error getting system idle state:', error)
      return 'unknown'
    }
  })

  ipcMain.handle('load-custom-categories', async () => {
    try {
      const categoriesService = hybridConnection.getCategoriesService()
      return await categoriesService.getCustomCategoryMappings()
    } catch (error) {
      console.error('Error loading custom categories:', error)
      return {}
    }
  })

  ipcMain.handle('save-custom-categories', async (event, mappings) => {
    try {
      const categoriesService = hybridConnection.getCategoriesService()
      return await categoriesService.saveCustomCategoryMappings(mappings)
    } catch (error) {
      console.error('Error saving custom categories:', error)
      return false
    }
  })

  // AI Service IPC handlers
  ipcMain.handle('ai-chat', async (event, message) => {
    try {
      if (!aiServiceManager.getStatus().isRunning) {
        throw new Error('AI service is not running')
      }
      return await aiServiceManager.sendMessage(message)
    } catch (error) {
      console.error('Error sending message to AI service:', error)
      return { error: error.message }
    }
  })

  ipcMain.handle('ai-service-status', async () => {
    try {
      return aiServiceManager.getStatus()
    } catch (error) {
      console.error('Error getting AI service status:', error)
      return { error: error.message }
    }
  })

  ipcMain.handle('ai-service-restart', async (event, config = {}) => {
    try {
      await aiServiceManager.stop()
      // Pass the configuration (provider, openaiKey, geminiKey) to the start method
      await aiServiceManager.start(config)
      return { success: true }
    } catch (error) {
      console.error('Error restarting AI service:', error)
      return { error: error.message }
    }
  })

  // Sync functionality commented out for simplified architecture
  // ipcMain.handle('get-storage-stats', async () => {
  //   try {
  //     return await backgroundSyncService.getStorageStats()
  //   } catch (error) {
  //     console.error('Error getting storage stats:', error)
  //     return { error: error.message }
  //   }
  // })

  // ipcMain.handle('get-sync-status', async () => {
  //   try {
  //     return backgroundSyncService.getSyncStatus()
  //   } catch (error) {
  //     console.error('Error getting sync status:', error)
  //     return { error: error.message }
  //   }
  // })

  // ipcMain.handle('force-sync-to-mongo', async () => {
  //   try {
  //     return await backgroundSyncService.forcePushToMongo()
  //   } catch (error) {
  //     console.error('Error forcing sync to MongoDB:', error)
  //     return false
  //   }
  // })

  // ipcMain.handle('force-sync-from-mongo', async () => {
  //   try {
  //     return await backgroundSyncService.forcePullFromMongo()
  //   } catch (error) {
  //     console.error('Error forcing sync from MongoDB:', error)
  //     return false
  //   }
  // })

  ipcMain.handle('get-connection-mode', async () => {
    try {
      return {
        mode: hybridConnection.getStorageType(),
        isOnline: false, // Always offline in simplified architecture
        isOffline: true // Always offline in simplified architecture
      }
    } catch (error) {
      console.error('Error getting connection mode:', error)
      return { error: error.message }
    }
  })

  // ipcMain.handle('export-local-data', async () => {
  //   try {
  //     return await backgroundSyncService.exportLocalData()
  //   } catch (error) {
  //     console.error('Error exporting local data:', error)
  //     throw error
  //   }
  // })

  // ipcMain.handle('import-local-data', async (event, data) => {
  //   try {
  //     return await backgroundSyncService.importLocalData(data)
  //   } catch (error) {
  //     console.error('Error importing local data:', error)
  //     throw error
  //   }
  // })

  // Focus Session IPC handlers
  ipcMain.handle('start-focus-session', async (event, sessionData) => {
    try {
      const session = await focusSessionService.startSession(sessionData)
      return session
    } catch (error) {
      console.error('Error starting focus session:', error)
      return { error: error.message }
    }
  })

  ipcMain.handle('stop-focus-session', async (event, sessionId) => {
    try {
      const currentSession = focusSessionService.getCurrentSession()
      if (!currentSession && !sessionId) {
        return { error: 'No active session found' }
      }

      const id = sessionId || currentSession._id
      const session = await focusSessionService.endSession(id, 'completed')
      return session
    } catch (error) {
      console.error('Error stopping focus session:', error)
      return { error: error.message }
    }
  })

  ipcMain.handle('pause-focus-session', async (event, sessionId) => {
    try {
      const session = await focusSessionService.pauseSession(sessionId)
      return session
    } catch (error) {
      console.error('Error pausing focus session:', error)
      return { error: error.message }
    }
  })

  ipcMain.handle('resume-focus-session', async (event, sessionId) => {
    try {
      const session = await focusSessionService.resumeSession(sessionId)
      return session
    } catch (error) {
      console.error('Error resuming focus session:', error)
      return { error: error.message }
    }
  })

ipcMain.handle('ai-service-reset-memory', async () => {
    try {
      return await aiServiceManager.resetMemory()
    } catch (error) {
      console.error('Error resetting AI service memory:', error)
      return { error: error.message }
    }
  })

  // AI Config file handlers
  ipcMain.handle('get-ai-config', async () => {
    try {
      const userDataPath = app.getPath('userData')
      const configPath = path.join(userDataPath, 'config.json')

      if (!fs.existsSync(configPath)) {
        // Return default config if file doesn't exist
        return {
          apiKey: '',
          provider: 'openai',
          lastUpdated: new Date().toISOString()
        }
      }

      const configData = fs.readFileSync(configPath, 'utf-8')
      return JSON.parse(configData)
    } catch (error) {
      console.error('Error reading AI config:', error)
      return {
        apiKey: '',
        provider: 'openai',
        lastUpdated: new Date().toISOString()
      }
    }
  })

  ipcMain.handle('save-ai-config', async (event, config) => {
    try {
      const userDataPath = app.getPath('userData')
      const configPath = path.join(userDataPath, 'config.json')

      // Add lastUpdated timestamp
      const configToSave = {
        ...config,
        lastUpdated: new Date().toISOString()
      }

      fs.writeFileSync(configPath, JSON.stringify(configToSave, null, 2), 'utf-8')
      console.log('AI config saved to:', configPath)
      return { success: true }
    } catch (error) {
      console.error('Error saving AI config:', error)
      return { error: error.message }
    }
  })
  
  ipcMain.handle('cancel-focus-session', async (event, sessionId) => {
    try {
      const currentSession = focusSessionService.getCurrentSession()
      if (!currentSession && !sessionId) {
        return { error: 'No active session found' }
      }

      const id = sessionId || currentSession._id
      const session = await focusSessionService.endSession(id, 'cancelled')
      return session
    } catch (error) {
      console.error('Error cancelling focus session:', error)
      return { error: error.message }
    }
  })

  // Window control handlers
  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize()
  })

  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow.maximize()
      }
    }
  })

  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close()
  })

  ipcMain.handle('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false
  })

  ipcMain.handle('get-current-focus-session', async () => {
    try {
      const session = focusSessionService.getCurrentSession()
      return session
    } catch (error) {
      console.error('Error getting current focus session:', error)
      return { error: error.message }
    }
  })

  ipcMain.handle('get-focus-session-stats', async () => {
    try {
      const stats = await focusSessionService.getTodaysStats()
      return stats
    } catch (error) {
      console.error('Error getting focus session stats:', error)
      return { error: error.message }
    }
  })

  ipcMain.handle('get-focus-sessions-by-date', async (event, startDate, endDate) => {
    try {
      const sessions = await focusSessionService.getSessionsByDateRange(startDate, endDate)
      return sessions
    } catch (error) {
      console.error('Error getting focus sessions by date:', error)
      return { error: error.message }
    }
  })

  ipcMain.handle('add-focus-session-interruption', async (event, sessionId, reason, appName) => {
    try {
      const session = await focusSessionService.addInterruption(sessionId, reason, appName)
      return session
    } catch (error) {
      console.error('Error adding focus session interruption:', error)
      return { error: error.message }
    }
  })

  ipcMain.handle('rate-focus-session', async (event, sessionId, productivity, notes) => {
    try {
      const session = await focusSessionService.updateSessionRating(sessionId, productivity, notes)
      return session
    } catch (error) {
      console.error('Error rating focus session:', error)
      return { error: error.message }
    }
  })

  ipcMain.handle('show-notification', async (event, options) => {
    try {
      const { Notification } = require('electron')
      if (Notification.isSupported()) {
        const notification = new Notification({
          title: options.title,
          body: options.body,
          icon: getIconPath()
        })
        notification.show()
        return true
      }
      return false
    } catch (error) {
      console.error('Error showing notification:', error)
      return false
    }
  })

  // Data Aggregation IPC handlers
  ipcMain.handle('get-aggregated-data-by-date', async (event, date) => {
    try {
      const appUsageService = hybridConnection.getAppUsageService()
      const categoriesService = hybridConnection.getCategoriesService()
      if (!appUsageService) {
        throw new Error('App usage service not initialized')
      }
      const data = await appUsageService.getAppUsageData(date, date)
      return await filterExcludedApps(data, categoriesService)
    } catch (error) {
      console.error('Error getting aggregated data by date:', error)
      return { error: error.message }
    }
  })

  ipcMain.handle('get-all-aggregated-data', async () => {
    try {
      const appUsageService = hybridConnection.getAppUsageService()
      const categoriesService = hybridConnection.getCategoriesService()
      if (!appUsageService) {
        throw new Error('App usage service not initialized')
      }
      const data = await appUsageService.getAppUsageData()
      return await filterExcludedApps(data, categoriesService)
    } catch (error) {
      console.error('Error getting all aggregated data:', error)
      return { error: error.message }
    }
  })

  ipcMain.handle('get-formatted-usage-data', async (event, startDate, endDate) => {
    try {
      const appUsageService = hybridConnection.getAppUsageService()
      const categoriesService = hybridConnection.getCategoriesService()
      if (!appUsageService) {
        throw new Error('App usage service not initialized')
      }
      const data = await appUsageService.getAppUsageData(startDate, endDate)
      return await filterExcludedApps(data, categoriesService)
    } catch (error) {
      console.error('Error getting formatted usage data:', error)
      return { error: error.message }
    }
  })

  ipcMain.handle('get-productivity-summary', async (event, date) => {
    try {
      const appUsageService = hybridConnection.getAppUsageService()
      if (!appUsageService) {
        throw new Error('App usage service not initialized')
      }
      const summary = await appUsageService.getProductivitySummary(date)
      return summary
    } catch (error) {
      console.error('Error getting productivity summary:', error)
      return { error: error.message }
    }
  })

  ipcMain.handle('cleanup-database', async () => {
    try {
      const appUsageService = hybridConnection.getAppUsageService()
      if (!appUsageService) {
        throw new Error('App usage service not initialized')
      }
      // Database cleanup functionality can be implemented directly in app usage service
      console.log('Database cleanup requested - functionality needs to be implemented in app usage service')
      return { success: true, message: 'Cleanup functionality moved to app usage service' }
    } catch (error) {
      console.error('Error cleaning up database:', error)
      return { error: error.message }
    }
  })

  // Popup analytics and control handlers
  ipcMain.handle('get-popup-stats', async () => {
    try {
      return popupManager.getPopupStats()
    } catch (error) {
      console.error('Error getting popup stats:', error)
      return { error: error.message }
    }
  })

  ipcMain.handle('update-popup-preferences', async (event, preferences) => {
    try {
      popupManager.updatePreferences(preferences)
      return true
    } catch (error) {
      console.error('Error updating popup preferences:', error)
      return false
    }
  })

  ipcMain.handle('cleanup-popup-dismissals', async () => {
    try {
      popupManager.cleanupExpiredDismissals()
      return true
    } catch (error) {
      console.error('Error cleaning up dismissals:', error)
      return false
    }
  })

  ipcMain.handle('get-focus-quality-data', async (event, date, startHour = 9, endHour = 17) => {
    try {
      const appUsageService = hybridConnection.getAppUsageService()
      if (!appUsageService) {
        throw new Error('App usage service not initialized')
      }

      return await appUsageService.getFocusQualityData(date, startHour, endHour)
    } catch (error) {
      console.error('Error getting focus quality data:', error)
      return []
    }
  })

  // Auto-startup management handlers
  ipcMain.handle('get-auto-launch-status', () => {
    try {
      const loginItemSettings = app.getLoginItemSettings()
      return {
        enabled: loginItemSettings.openAtLogin,
        wasOpenedAtLogin: loginItemSettings.wasOpenedAtLogin
      }
    } catch (error) {
      console.error('Error getting auto-launch status:', error)
      return { enabled: false, error: error.message }
    }
  })

  ipcMain.handle('set-auto-launch', (event, enabled) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: false, // Show window on startup
        path: process.execPath,
        args: []
      })
      console.log(`Auto-launch ${enabled ? 'enabled' : 'disabled'}`)
      return { success: true, enabled }
    } catch (error) {
      console.error('Error setting auto-launch:', error)
      return { success: false, error: error.message }
    }
  })

  // Exclusion List IPC handlers
  ipcMain.handle('get-exclusion-list', async () => {
    try {
      const categoriesService = hybridConnection.getCategoriesService()
      return await categoriesService.getExclusionList()
    } catch (error) {
      console.error('Error getting exclusion list:', error)
      return { apps: [], domains: [], error: error.message }
    }
  })

  ipcMain.handle('add-to-exclusion-list', async (event, identifier, type) => {
    try {
      const categoriesService = hybridConnection.getCategoriesService()
      const result = await categoriesService.addToExclusionList(identifier, type)

      // Notify all windows that exclusion list has been updated
      if (result) {
        const updatedList = await categoriesService.getExclusionList()
        mainWindow?.webContents.send('exclusion-list-updated', updatedList)
      }

      return result
    } catch (error) {
      console.error('Error adding to exclusion list:', error)
      return false
    }
  })

  ipcMain.handle('remove-from-exclusion-list', async (event, identifier, type) => {
    try {
      const categoriesService = hybridConnection.getCategoriesService()
      const result = await categoriesService.removeFromExclusionList(identifier, type)

      // Notify all windows that exclusion list has been updated
      if (result) {
        const updatedList = await categoriesService.getExclusionList()
        mainWindow?.webContents.send('exclusion-list-updated', updatedList)
      }

      return result
    } catch (error) {
      console.error('Error removing from exclusion list:', error)
      return false
    }
  })

  ipcMain.handle('is-excluded', async (event, identifier, type) => {
    try {
      const categoriesService = hybridConnection.getCategoriesService()
      return await categoriesService.isExcluded(identifier, type)
    } catch (error) {
      console.error('Error checking exclusion:', error)
      return false
    }
  })

  ipcMain.handle('clear-exclusion-list', async () => {
    try {
      const categoriesService = hybridConnection.getCategoriesService()
      const result = await categoriesService.clearExclusionList()

      // Notify all windows that exclusion list has been cleared
      mainWindow?.webContents.send('exclusion-list-updated', { apps: [], domains: [] })

      return result
    } catch (error) {
      console.error('Error clearing exclusion list:', error)
      return 0
    }
  })

  // Create system tray icon with error handling
  try {
    console.log('Creating system tray icon...')

    const iconPath = getIconPath()
    console.log('Icon path:', iconPath)
    console.log('Icon exists:', fs.existsSync(iconPath))

    const icon = nativeImage.createFromPath(iconPath)
    tray = new Tray(icon)

    // Prevent tray from being garbage collected
    app.tray = tray

    const trayMenu = Menu.buildFromTemplate([
      {
        label: 'Show FocusBook',
        click: () => showMainWindow()
      },
      { type: 'separator' },
      {
        label: 'Quit FocusBook',
        click: () => {
          app.isQuiting = true
          cleanupWithDb()
          app.quit()
        }
      }
    ])

    tray.setContextMenu(trayMenu)
    tray.setToolTip('FocusBook - Productivity Tracker')

    // Handle left-click on tray icon (Windows/Linux)
    tray.on('click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isVisible()) {
          mainWindow.hide()
        } else {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    })

    // Handle double-click on tray icon
    tray.on('double-click', () => {
      showMainWindow()
    })

    console.log('✅ System tray icon created successfully')
  } catch (error) {
    console.error('❌ Failed to create system tray icon:', error)
  }

  globalShortcut.register('CommandOrControl+o', () => {
    showMainWindow()
  })

  globalShortcut.register('CommandOrControl+q', () => {
    app.isQuiting = true
    cleanup()
    app.quit()
  })
})

// Centralized cleanup function
function cleanup() {
  isCleaningUp = true
  clearAppTimers()

  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close()
    popupWindow = null
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close()
    mainWindow = null
  }

  if (tray) {
    tray.destroy()
    tray = null
  }

  // Stop AI service
  if (aiServiceManager) {
    aiServiceManager.stop().catch((err) => {
      console.error('Error stopping AI service:', err)
    })
  }

  // Disconnect from hybrid database system
  hybridConnection.disconnect().catch((err) => {
    console.error('Error disconnecting from database:', err)
  })
}

app.on('will-quit', () => {
  cleanup()
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  // Don't quit the app when windows are closed - keep running in tray
  // Only quit when user explicitly chooses "Quit" from tray menu
  console.log('All windows closed, but app continues running in system tray')
})

app.on('before-quit', () => {
  cleanupWithDb()
})

ipcMain.on('stay-focused', (event) => {
  if (isCleaningUp) return

  console.log('stay-focus received in main process')

  // Record user action for smart timing
  popupManager.recordUserAction('stay-focused', app_name)

  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close()
    popupWindow = null

    // Check if we're dealing with a Chrome/Brave browser tab (URL) vs regular application (.exe)
    if (app_name && (app_name.startsWith('http') || (app_name.includes('.') && !app_name.endsWith('.exe'))) && n_pid) {
      // This is a URL/domain from Chrome/Brave - use Python script to close tab
      // In production, scripts are in extraResources; in dev, they're in the project root
      const isDev = process.env.NODE_ENV === 'development' || !process.resourcesPath
      const closeScriptPath = isDev
        ? path.join(__dirname, '../../scripts/closeTab.py')
        : path.join(process.resourcesPath, 'scripts/closeTab.py')

      console.log(`Close script path (isDev=${isDev}): ${closeScriptPath}`)

      // Check if Python script exists
      if (!fs.existsSync(closeScriptPath)) {
        console.warn('Python closeTab script not found, cannot close browser tab')
        console.log('User requested to close distracting tab but script is unavailable')
        return
      }

      try {
        const pythonProcess = spawn('python', [closeScriptPath, n_pid, app_name])
        
        // Set timeout for Python process
        const timeout = setTimeout(() => {
          pythonProcess.kill('SIGKILL')
          console.warn('Python closeTab script timeout')
        }, 10000) // 10 second timeout

        pythonProcess.stdout.on('data', (data) => {
          clearTimeout(timeout)
          try {
            const result = JSON.parse(data.toString())
            if (result.success) {
              console.log(`Successfully closed Chrome tab: ${result.closed_domain}`)
            } else if (result.error) {
              console.warn(`Python script error: ${result.error}`)
            } else {
              console.log(`Tab not closed: ${result.reason}`)
            }
          } catch {
            console.log('Python script output:', data.toString())
          }
        })

        pythonProcess.stderr.on('data', (data) => {
          clearTimeout(timeout)
          console.warn('Python script error:', data.toString())
        })
        
        pythonProcess.on('error', (err) => {
          clearTimeout(timeout)
          console.warn('Failed to start Python closeTab process:', err.message)
          console.log('User requested to close tab but Python execution failed')
        })
        
        pythonProcess.on('close', (code) => {
          clearTimeout(timeout)
          if (code !== 0) {
            console.warn(`Python closeTab script exited with code ${code}`)
          }
        })
        
      } catch (error) {
        console.warn('Error executing Python closeTab script:', error.message)
        console.log('User requested to close tab but script execution failed')
      }
    } else if (app_name && app_name.endsWith('.exe')) {
      // This is a regular application - use taskkill
      try {
        exec(`taskkill /IM "${app_name}" /F`, { timeout: 5000 }, (error, stdout, stderr) => {
          if (error) {
            if (error.code === 128) {
              console.log(`Application ${app_name} was not running or already closed`)
            } else {
              console.warn(`Error closing app ${app_name}: ${error.message}`)
            }
            return
          }
          if (stderr && !stderr.includes('SUCCESS')) {
            console.warn(`Warning while closing ${app_name}: ${stderr}`)
            return
          }
          console.log(`Successfully closed application: ${app_name}`)
        })
      } catch (error) {
        console.warn(`Failed to execute taskkill for ${app_name}:`, error.message)
      }
    } else {
      console.log(`App close requested but cannot determine closure method for: ${app_name} (invalid format or missing PID)`)
      console.log('This may be a system process or already closed application')
    }
  }
})

ipcMain.on('cooldown', (event) => {
  if (isCleaningUp) return

  console.log('cooldown Received in main process')

  // Record user action for smart timing
  popupManager.recordUserAction('cooldown', app_name)

  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close()
    popupWindow = null

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cooldown')
    }
  }
})

ipcMain.on('dismiss', (event) => {
  if (isCleaningUp) return

  console.log('dismiss Received in main process')

  // Record user action for smart timing
  popupManager.recordUserAction('dismiss', app_name)

  if (popupWindow && !popupWindow.isDestroyed()) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('dismiss index')
      mainWindow.webContents.send('dismiss', app_name)
    }
    popupWindow.close()
    popupWindow = null
  }
})

ipcMain.on('categoriesUpdated', (event, catTags) => {
  if (isCleaningUp) return

  console.log(catTags)
  const data = JSON.stringify(catTags, null, 4)
  fs.writeFileSync('Distractedcat.json', data, (err) => {
    console.log('error writing file', err)
  })
})

// Debug endpoint for Python error recovery status
ipcMain.handle('get-python-status', () => {
  return pythonErrorRecovery.getStatus()
})

// Manual reset for Python error recovery
ipcMain.handle('reset-python-recovery', () => {
  pythonErrorRecovery.reset()
  return { success: true, message: 'Python error recovery system reset' }
})

ipcMain.on('start-focus', (event, isFocused) => {
  if (isCleaningUp) return

  // Clear any existing timer first
  clearAppTimers()

  timerInterval = setInterval(async () => {
    // Check if we're cleaning up or main window is destroyed
    if (isCleaningUp || !mainWindow || mainWindow.isDestroyed()) {
      clearAppTimers()
      return
    }

    // Check if we have an active session and if it should be completed
    try {
      const currentSession = await focusSessionService.getCurrentSession()
      
      if (currentSession && currentSession.status === 'active') {
        const now = Date.now()
        const sessionStart = new Date(currentSession.start_time).getTime()
        const plannedDurationMs = currentSession.planned_duration
        const elapsed = now - sessionStart - (currentSession.paused_duration || 0)
        
        // Check if session should be completed
        if (elapsed >= plannedDurationMs) {
          console.log('Auto-completing focus session - duration reached')
          await focusSessionService.endSession(currentSession._id, 'completed')
          
          // Clear timer and notify frontend
          clearAppTimers()
          mainWindow.webContents.send('end-focus', isFocused)
          return
        }
        
        // Update time display based on remaining time
        const remainingMs = Math.max(0, plannedDurationMs - elapsed)
        timeDisplay = Math.ceil(remainingMs / 1000)
      } else {
        // No active session, just increment as before
        totalSeconds++
        timeDisplay = totalSeconds
      }
    } catch (error) {
      console.error('Error checking session status:', error)
      // Fallback to simple timer
      totalSeconds++
      timeDisplay = totalSeconds
    }

    try {
      mainWindow.webContents.send('start-focus', isFocused, timeDisplay)
    } catch (error) {
      console.error('Error sending focus timer update:', error)
      clearAppTimers()
    }
  }, 1500)
})

ipcMain.on('end-focus', (event, isFocused) => {
  if (isCleaningUp) return

  clearAppTimers() // Clear timer when focus ends

  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('end-focus', isFocused)
    } catch (error) {
      console.error('Error sending end-focus:', error)
    }
  }
})

ipcMain.on('pause-focus', (event) => {
  if (isCleaningUp) return

  // Don't clear timers completely, just pause them
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('pause-focus')
    } catch (error) {
      console.error('Error sending pause-focus:', error)
    }
  }
})

ipcMain.on('resume-focus', (event) => {
  if (isCleaningUp) return

  // Resume the timer from where it left off
  if (!timerInterval) {
    timerInterval = setInterval(async () => {
      if (isCleaningUp || !mainWindow || mainWindow.isDestroyed()) {
        clearAppTimers()
        return
      }

      // Check if we have an active session and if it should be completed
      try {
        const currentSession = await focusSessionService.getCurrentSession()
        
        if (currentSession && currentSession.status === 'active') {
          const now = Date.now()
          const sessionStart = new Date(currentSession.start_time).getTime()
          const plannedDurationMs = currentSession.planned_duration
          const elapsed = now - sessionStart - (currentSession.paused_duration || 0)
          
          // Check if session should be completed
          if (elapsed >= plannedDurationMs) {
            console.log('Auto-completing focus session - duration reached (resume timer)')
            await focusSessionService.endSession(currentSession._id, 'completed')
            
            // Clear timer and notify frontend
            clearAppTimers()
            mainWindow.webContents.send('end-focus', true)
            return
          }
          
          // Update time display based on remaining time
          const remainingMs = Math.max(0, plannedDurationMs - elapsed)
          timeDisplay = Math.ceil(remainingMs / 1000)
        } else {
          // No active session, just increment as before
          totalSeconds++
          timeDisplay = totalSeconds
        }
      } catch (error) {
        console.error('Error checking session status:', error)
        // Fallback to simple timer
        totalSeconds++
        timeDisplay = totalSeconds
      }

      try {
        mainWindow.webContents.send('start-focus', true, timeDisplay)
      } catch (error) {
        console.error('Error sending focus timer update:', error)
        clearAppTimers()
      }
    }, 1500)
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('resume-focus')
    } catch (error) {
      console.error('Error sending resume-focus:', error)
    }
  }
})

// Updated cleanup function with database connection handling
async function cleanupWithDb() {
  console.log('🔄 Starting cleanup...')
  isCleaningUp = true

  clearAppTimers()

  try {
    // Close database connection
    await hybridConnection.disconnect()
    console.log('✅ Database connection closed')
  } catch (error) {
    console.error('Error during cleanup:', error)
  }

  // Call original cleanup
  cleanup()

  console.log('✅ Cleanup completed')
}
