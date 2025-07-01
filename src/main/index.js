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
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

const { dbConnection } = require('./database/connection')
const appUsageService = require('./database/appUsageService')
const categoriesService = require('./database/categoriesService')
const migrationService = require('./database/migrationService')

let mainWindow = null
let popupWindow = null
let tray = null
let totalSeconds = 0
let timeDisplay = 0
let timerInterval = null
let app_name = null
let n_pid = null
let isCleaningUp = false

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
            sandbox: false,
        },
    });

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
        console.log("running in dev")
    } else {
        console.log("running in prod")
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
        mainWindow.webContents.openDevTools()

    }
  })

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

    popupWindow.loadFile(path.join(__dirname, '../renderer/popup.html'))

    popupWindow.on('closed', () => {
      popupWindow = null
    })
  } catch (error) {
    console.error('Error creating popup window:', error)
  }
}

app.whenReady().then(async () => {
  try {
    await dbConnection.connect()
    await migrationService.runFullMigration()
    console.log('✅ Database initialized and migration completed')
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message)
    console.log('📋 The app will continue to run, but database features will be unavailable.')
    console.log('💡 To enable PostgreSQL features:')
    console.log('   1. Install PostgreSQL')
    console.log('   2. Create a database named "focusbook"')
    console.log('   3. Update the .env file with your database credentials')
    console.log('   4. Run: node migrate.js')
  }

  createWindow()

  ipcMain.on('show-popup-message', (event, appName, pid) => {
    if (isCleaningUp) return
    console.log('pid', pid, 'appName', appName)
    app_name = appName
    n_pid = pid
    createPopUp()
  })

  ipcMain.on('save-categories', async (event, data) => {
    try {
      return await categoriesService.saveCategories(data)
    } catch (error) {
      console.error('Error saving categories:', error)
      return false
    }
  })

  ipcMain.handle('load-categories', async (event) => {
    try {
      return await categoriesService.getCategoriesForSettings()
    } catch (error) {
      console.error('Error loading categories:', error)
      return [[], []]
    }
  })

  ipcMain.handle('load-data', async () => {
    try {
      return await appUsageService.getAppUsageData()
    } catch (error) {
      console.error('Error loading data:', error)
      return {}
    }
  })

  ipcMain.handle('save-data', async (event, appUsageData) => {
    try {
      return await appUsageService.bulkUpdateAppUsageData(appUsageData)
    } catch (error) {
      console.error('Error saving data:', error)
      return false
    }
  })

  ipcMain.handle('idle-state', async (event, idleThreshold) => {
    let state = powerMonitor.getSystemIdleState(idleThreshold)
    console.log(`[${new Date().toLocaleTimeString()}] State: ${state}`)
    return state
  })

  ipcMain.handle('load-custom-categories', async () => {
    try {
      return await categoriesService.getCustomCategoryMappings()
    } catch (error) {
      console.error('Error loading custom categories:', error)
      return {}
    }
  })

  ipcMain.handle('save-custom-categories', async (event, mappings) => {
    try {
      return await categoriesService.saveCustomCategoryMappings(mappings)
    } catch (error) {
      console.error('Error saving custom categories:', error)
      return false
    }
  })

  tray = new Tray(icon)
  const trayMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => showMainWindow() },
    {
      label: 'Quit',
      click: () => {
        app.isQuiting = true
        cleanup()
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

  // Disconnect from database
  dbConnection.disconnect().catch((err) => {
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
  cleanup()
})

ipcMain.on('stay-focused', (event, data) => {
  if (isCleaningUp) return

  console.log('stay-focus received in main process')
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close()
    popupWindow = null

    if (!app_name.endsWith('.exe')) {
      const closeScriptPath = path.join(__dirname, '../../scripts/closeTab.py')
      const pythonProcess = spawn('python', [closeScriptPath, n_pid, app_name])

      pythonProcess.stdout.on('data', (data) => {
        // Handle output if needed
      })

      pythonProcess.stderr.on('data', (data) => {
        console.error('Python script error:', data.toString())
      })
    } else {
      exec(`taskkill /IM ${app_name} /F`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error closing app: ${error.message}`)
          return
        }
        if (stderr) {
          console.error(`Error: ${stderr}`)
          return
        }
      })
    }
  }
})

ipcMain.on('cooldown', (event) => {
  if (isCleaningUp) return

  console.log('cooldown Received in main process')
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

