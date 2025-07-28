const {
  app,
  powerMonitor,
  BrowserWindow,
  ipcMain,
  screen,
  Tray,
  Menu,
  globalShortcut
} = require('electron')
const { exec, spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
import icon from '../../resources/icon.png?asset'

const { hybridConnection } = require('./database/hybridConnection')
const focusSessionService = require('./database/focusSessionService')
const PopupManager = require('./popupManager')
const AIServiceManager = require('./aiServiceManager')
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    resizable: true,
    show: true,
    Menu: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
  //   mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  // } else {
  //   console.log('running in prod')
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
    console.log('main window loaded')
  

  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault()
      mainWindow.hide()
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
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.show()
  mainWindow.focus()
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

app.whenReady().then(async () => {
  try {
    await hybridConnection.connect()
    console.log('✅ SQLite database system initialized successfully')

    // Initialize data aggregation service
    // Data aggregation functionality is now handled directly by app usage service
    
  } catch (error) {
    console.error('❌ Failed to initialize database system:', error.message)
    console.log('📋 The app will continue to run with reduced functionality.')
  }

  // Start AI service
  try {
    await aiServiceManager.start()
    console.log('✅ AI service started successfully')
  } catch (error) {
    console.error('❌ Failed to start AI service:', error.message)
    console.log('📋 AI insights will not be available.')
  }

  createWindow()

  ipcMain.on('show-popup-message', async (event, appName, pid) => {
    if (isCleaningUp) return

    try {
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
      return await categoriesService.saveCategories(data)
    } catch (error) {
      console.error('Error saving categories:', error)
      return false
    }
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

  ipcMain.handle('load-data', async () => {
    try {
      const appUsageService = hybridConnection.getAppUsageService()
      return await appUsageService.getAppUsageData()
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

  ipcMain.handle('ai-service-restart', async () => {
    try {
      await aiServiceManager.stop()
      await aiServiceManager.start()
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
          icon: icon
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
      if (!appUsageService) {
        throw new Error('App usage service not initialized')
      }
      const data = await appUsageService.getAppUsageData(date, date)
      return data
    } catch (error) {
      console.error('Error getting aggregated data by date:', error)
      return { error: error.message }
    }
  })

  ipcMain.handle('get-all-aggregated-data', async () => {
    try {
      const appUsageService = hybridConnection.getAppUsageService()
      if (!appUsageService) {
        throw new Error('App usage service not initialized')
      }
      const data = await appUsageService.getAppUsageData()
      return data
    } catch (error) {
      console.error('Error getting all aggregated data:', error)
      return { error: error.message }
    }
  })

  ipcMain.handle('get-formatted-usage-data', async (event, startDate, endDate) => {
    try {
      const appUsageService = hybridConnection.getAppUsageService()
      if (!appUsageService) {
        throw new Error('App usage service not initialized')
      }
      const data = await appUsageService.getAppUsageData(startDate, endDate)
      return data
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

  tray = new Tray(icon)
  const trayMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => showMainWindow() },
    {
      label: 'Quit',
      click: () => {
        app.isQuiting = true
        cleanupWithDb()
        app.quit()
      }
    }
  ])

  tray.setContextMenu(trayMenu)
  tray.setToolTip('Focusbook')

  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
    }
  })

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

app.on('window-all-closed', (e) => {
  if (process.platform !== 'darwin') {
    e.preventDefault()
  }
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
    if (app_name && (app_name.startsWith('http') || app_name.includes('.')) && n_pid) {
      // This is a URL/domain from Chrome/Brave - use Python script to close tab
      const closeScriptPath = path.join(__dirname, '../../scripts/closeTab.py')
      const pythonProcess = spawn('python', [closeScriptPath, n_pid, app_name])

      pythonProcess.stdout.on('data', (data) => {
        try {
          const result = JSON.parse(data.toString())
          if (result.success) {
            console.log(`Successfully closed Chrome tab: ${result.closed_domain}`)
          } else if (result.error) {
            console.error(`Python script error: ${result.error}`)
          } else {
            console.log(`Tab not closed: ${result.reason}`)
          }
        } catch {
          console.log('Python script output:', data.toString())
        }
      })

      pythonProcess.stderr.on('data', (data) => {
        console.error('Python script error:', data.toString())
      })
    } else if (app_name && app_name.endsWith('.exe')) {
      // This is a regular application - use taskkill
      exec(`taskkill /IM ${app_name} /F`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error closing app: ${error.message}`)
          return
        }
        if (stderr) {
          console.error(`Error: ${stderr}`)
          return
        }
        console.log(`Successfully closed application: ${app_name}`)
      })
    } else {
      console.warn(`Unable to close app: ${app_name} (invalid format or missing PID)`)
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

ipcMain.on('start-focus', (event, isFocused) => {
  if (isCleaningUp) return

  // Clear any existing timer first
  clearAppTimers()

  timerInterval = setInterval(() => {
    // Check if we're cleaning up or main window is destroyed
    if (isCleaningUp || !mainWindow || mainWindow.isDestroyed()) {
      clearAppTimers()
      return
    }

    totalSeconds++
    timeDisplay = totalSeconds

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
