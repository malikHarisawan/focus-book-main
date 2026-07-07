const {
  app,
  powerMonitor,
  BrowserWindow,
  ipcMain,
  screen,
  Tray,
  Menu,
  globalShortcut,
  nativeImage,
  dialog,
  shell
} = require('electron')
// NOTE: do NOT destructure `autoUpdater` here. In electron-updater, `autoUpdater`
// is a lazy getter that instantiates NsisUpdater on first property access, which
// reads app.getVersion() — if that happens at module load time (before the app is
// ready) it crashes the whole main process on startup. We require the module now
// but only read the `.autoUpdater` getter later, from inside getAutoUpdater(),
// which is called after app.whenReady().
const electronUpdater = require('electron-updater')
let _autoUpdater = null
function getAutoUpdater() {
  if (!_autoUpdater) {
    _autoUpdater = electronUpdater.autoUpdater
  }
  return _autoUpdater
}
// const { is } = require('@electron-toolkit/utils') // Removed to fix production build issue
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

// Close a distracting native app by its PID using Node's built-in process.kill —
// no external `taskkill`. Tries a graceful SIGTERM first so the app can save,
// then escalates to SIGKILL if it's still alive after a short grace period.
// Targets the single foreground PID, not every instance of the exe.
function closeAppByPid(pid, appName) {
  const numericPid = parseInt(pid, 10)
  if (!numericPid || Number.isNaN(numericPid)) {
    console.log(`Cannot close ${appName}: no valid PID (got ${pid})`)
    return
  }

  const isAlive = () => {
    try {
      process.kill(numericPid, 0) // signal 0 = existence check, doesn't kill
      return true
    } catch {
      return false
    }
  }

  try {
    process.kill(numericPid, 'SIGTERM')
    console.log(`Sent SIGTERM to ${appName} (pid ${numericPid})`)
  } catch (error) {
    if (error.code === 'ESRCH') {
      console.log(`${appName} (pid ${numericPid}) was already closed`)
    } else {
      console.warn(`Could not signal ${appName} (pid ${numericPid}): ${error.message}`)
    }
    return
  }

  // Escalate to a forced kill if it ignored SIGTERM.
  setTimeout(() => {
    if (!isAlive()) {
      console.log(`Successfully closed ${appName} (pid ${numericPid})`)
      return
    }
    try {
      process.kill(numericPid, 'SIGKILL')
      console.log(`Force-closed ${appName} (pid ${numericPid}) after SIGTERM timeout`)
    } catch (error) {
      if (error.code !== 'ESRCH') {
        console.warn(`Failed to force-close ${appName} (pid ${numericPid}): ${error.message}`)
      }
    }
  }, 2000)
}

// Tell the user why an auto tab-close couldn't happen, instead of silently doing
// nothing. Uses a native notification so it works even though the popup is gone.
function notifyTabCloseUnavailable(reason) {
  const { Notification } = require('electron')
  if (!Notification.isSupported()) return
  const body =
    reason === 'no-extension'
      ? 'Install and connect the FocusBook browser extension to auto-close distracting tabs.'
      : reason === 'private'
        ? "This tab is in a private/incognito window FocusBook can't close automatically."
        : "Couldn't close the tab automatically. Please close it manually."
  try {
    new Notification({ title: 'FocusBook', body }).show()
  } catch (error) {
    console.warn('Could not show tab-close notification:', error.message)
  }
}

// In-memory cache for the exclusion list. The list changes only when the user
// adds/removes/clears an exclusion (all of which call invalidateExclusionCache),
// but filterExcludedApps runs on every dashboard/activity refresh. Caching avoids
// a SQLite round-trip on each of those frequent reads.
let exclusionCache = null

function invalidateExclusionCache() {
  exclusionCache = null
}

// Returns { apps: [], domains: [] }, served from cache when available.
async function getCachedExclusionList(categoriesService) {
  if (exclusionCache) {
    return exclusionCache
  }
  const exclusionList = await categoriesService.getExclusionList()
  exclusionCache = {
    apps: exclusionList.apps || [],
    domains: exclusionList.domains || []
  }
  return exclusionCache
}

// Helper function to filter excluded apps from usage data
async function filterExcludedApps(data, categoriesService) {
  if (!data || typeof data !== 'object') {
    return data
  }

  try {
    // Get the exclusion list (returns { apps: [], domains: [] }) — cached
    const exclusionList = await getCachedExclusionList(categoriesService)
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
const BrowserBridge = require('./browserBridge')
// const backgroundSyncService = require('./database/backgroundSyncService') // Commented out for simplified architecture

let mainWindow = null
let popupWindow = null
let tray = null
let totalSeconds = 0
let timeDisplay = 0
let timerInterval = null
let app_name = null
let n_pid = null
// Context for the currently-shown popup: { isBrowser, exe, title } — used by the
// stay-focused handler to close a browser tab via the extension bridge.
let popup_context = null
let isCleaningUp = false
let popupManager = new PopupManager()
let aiServiceManager = new AIServiceManager()
let browserBridge = new BrowserBridge(app.getPath('userData'))

// Window sizing. Default opens comfortably for the dashboard; the minimum is
// smaller so it can shrink (sidebar collapses) without the layout breaking.
const DEFAULT_WINDOW = { width: 1280, height: 800 }
const MIN_WINDOW = { width: 860, height: 600 }
const WINDOW_STATE_FILE = path.join(app.getPath('userData'), 'window-state.json')

// Load the last-saved window bounds, if any. Returns null when absent/invalid.
function loadWindowState() {
  try {
    if (!fs.existsSync(WINDOW_STATE_FILE)) return null
    const state = JSON.parse(fs.readFileSync(WINDOW_STATE_FILE, 'utf8'))
    if (typeof state.width !== 'number' || typeof state.height !== 'number') return null
    return state
  } catch (error) {
    console.warn('Could not read window state:', error.message)
    return null
  }
}

// Persist the current window bounds (and maximized flag) so the next launch
// restores them. Debounced by the caller via resize/move listeners.
function saveWindowState() {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const isMaximized = mainWindow.isMaximized()
    // Use normal bounds so a maximized window still remembers its restored size.
    const bounds = mainWindow.getNormalBounds()
    fs.writeFileSync(
      WINDOW_STATE_FILE,
      JSON.stringify({ ...bounds, isMaximized })
    )
  } catch (error) {
    console.warn('Could not save window state:', error.message)
  }
}

// Only accept a saved position if it still lands on a currently-connected
// display, so unplugging a monitor doesn't strand the window off-screen.
function boundsAreVisible(bounds) {
  if (typeof bounds.x !== 'number' || typeof bounds.y !== 'number') return false
  return screen.getAllDisplays().some((display) => {
    const wa = display.workArea
    return (
      bounds.x < wa.x + wa.width &&
      bounds.x + bounds.width > wa.x &&
      bounds.y < wa.y + wa.height &&
      bounds.y + bounds.height > wa.y
    )
  })
}

function createWindow() {
  const saved = loadWindowState()

  const windowOptions = {
    width: DEFAULT_WINDOW.width,
    height: DEFAULT_WINDOW.height,
    minWidth: MIN_WINDOW.width,
    minHeight: MIN_WINDOW.height,
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    show: true,
    autoHideMenuBar: true,
    frame: false,
    title: 'FocusBook',
    titleBarStyle: 'hidden',
    // Use the same logo as the system tray for the window/taskbar icon so they
    // match. getIconPath() resolves icon.png in both dev and packaged builds.
    icon: getIconPath(),
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  }

  // Restore saved size, and position too if it's still on a visible display.
  if (saved) {
    windowOptions.width = Math.max(saved.width, MIN_WINDOW.width)
    windowOptions.height = Math.max(saved.height, MIN_WINDOW.height)
    if (boundsAreVisible(saved)) {
      windowOptions.x = saved.x
      windowOptions.y = saved.y
    }
  }

  mainWindow = new BrowserWindow(windowOptions)

  // Re-maximize if that's how the user left it.
  if (saved && saved.isMaximized) {
    mainWindow.maximize()
  }

  // Persist bounds when the user resizes, moves, or (un)maximizes the window.
  let saveTimer = null
  const scheduleSave = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(saveWindowState, 400)
  }
  mainWindow.on('resize', scheduleSave)
  mainWindow.on('move', scheduleSave)
  mainWindow.on('maximize', saveWindowState)
  mainWindow.on('unmaximize', saveWindowState)

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

// Configure auto-updater.
// IMPORTANT: this MUST be called after app.whenReady(). Touching `autoUpdater`
// at module load time instantiates NsisUpdater, which reads app.getVersion()
// before Electron's `app` is ready and crashes the whole main process on
// startup. Keep all autoUpdater access inside this function.
let autoUpdaterConfigured = false
function configureAutoUpdater() {
  if (autoUpdaterConfigured) return
  autoUpdaterConfigured = true

  const updater = getAutoUpdater()
  updater.autoDownload = false
  updater.autoInstallOnAppQuit = true

  updater.on('update-available', (info) => {
    console.log('🔔 Update available:', info.version)
    // Notify user about update
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info)
    }
  })

  updater.on('update-downloaded', (info) => {
    console.log('✅ Update downloaded:', info.version)
    // Notify user that update is ready
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', info)
    }
  })

  updater.on('error', (err) => {
    console.error('❌ Auto-updater error:', err)
  })
}

// Heavy backend initialization (SQLite, focus sessions, AI service, Python).
// Runs in the BACKGROUND after the window is already on screen so the user is
// never staring at an empty desktop. IPC data handlers await
// hybridConnection.whenReady() before touching the database, so any data
// request that arrives before this finishes simply waits rather than failing.
async function initializeBackendServices() {
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

    // Only start the AI service if a key is actually configured. The service's
    // startup requires a valid provider key and exits otherwise, so starting it
    // keyless just crash-loops it on every launch. AI features stay unavailable
    // until the user adds a key in Settings (which restarts the service).
    const hasKey = Boolean((aiConfig.openaiKey || '').trim() || (aiConfig.geminiKey || '').trim())
    if (hasKey) {
      await aiServiceManager.start(aiConfig)
      console.log('✅ AI service started successfully')
    } else {
      console.log('📋 No AI key configured — AI service not started (add one in Settings to enable).')
    }
  } catch (error) {
    console.error('❌ Failed to start AI service:', error.message)
    console.log('📋 AI insights will not be available.')
  }


  // Initialize the browser extension bridge (WebSocket URL source). This is a
  // separate health domain from Python error recovery: it self-heals on
  // reconnect and never latches into a permanent no-URL state.
  try {
    const started = await browserBridge.start()
    if (started) {
      console.log('✅ Browser bridge started (extension is the URL source)')
    } else {
      console.log('⚠️ Browser bridge could not bind a port; extension URLs unavailable until restart')
    }
  } catch (error) {
    console.error('❌ Browser bridge initialization failed:', error.message)
  }
}

app.whenReady().then(async () => {
  // On Windows, associate the app with an explicit AppUserModelID so the
  // taskbar uses our window icon (matching electron-builder's appId) instead of
  // the default Electron icon, and groups windows correctly.
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.focusbook.app')
  }

  // Show the window IMMEDIATELY. Everything below this line (DB, AI service,
  // Python) previously blocked window creation, forcing the user to wait
  // ~10s+ staring at nothing. The window now paints first and populates data
  // as soon as the database is ready.
  createWindow()

  // Kick off the heavy initialization in the background — do NOT await it here.
  initializeBackendServices().catch((error) => {
    console.error('❌ Background initialization error:', error)
  })

  // Check for updates (only in production). Configure the updater here — after
  // the app is ready — so instantiating it can safely read app.getVersion().
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
    configureAutoUpdater()
    setTimeout(() => {
      getAutoUpdater().checkForUpdates()
        .then(() => console.log('✅ Checked for updates'))
        .catch((err) => console.error('❌ Failed to check for updates:', err))
    }, 5000) // Check after 5 seconds
  }

  ipcMain.on('show-popup-message', async (event, appName, pid, context) => {
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
      popup_context = context || null

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
      await hybridConnection.whenReady()
      const categoriesService = hybridConnection.getCategoriesService()
      return await categoriesService.getCategoriesForSettings()
    } catch (error) {
      console.error('Error loading categories:', error)
      return [[], []]
    }
  })

  // Full category metadata (name, type, color, icon) for the renderer to drive its
  // palette/icons/lists from the DB instead of hardcoded per-component maps.
  ipcMain.handle('get-all-categories', async () => {
    try {
      await hybridConnection.whenReady()
      const categoriesService = hybridConnection.getCategoriesService()
      return await categoriesService.getAllCategories()
    } catch (error) {
      console.error('Error loading all categories:', error)
      return []
    }
  })

  // --- Category + rule CRUD (Settings "Categories Management") ---
  // Broadcast so any open window refreshes its DB-driven category cache.
  const broadcastCategoriesUpdated = () => {
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.send('categories-updated', null)
    })
  }

  ipcMain.handle('category-add', async (event, { name, type, color, icon }) => {
    try {
      const svc = hybridConnection.getCategoriesService()
      const result = await svc.addCategory(name, type, color, icon)
      broadcastCategoriesUpdated()
      return result
    } catch (error) {
      console.error('Error adding category:', error)
      return false
    }
  })

  ipcMain.handle('category-update', async (event, { name, updates }) => {
    try {
      const svc = hybridConnection.getCategoriesService()
      const result = await svc.updateCategory(name, updates)
      broadcastCategoriesUpdated()
      return result
    } catch (error) {
      console.error('Error updating category:', error)
      return false
    }
  })

  ipcMain.handle('category-delete', async (event, { name }) => {
    try {
      const svc = hybridConnection.getCategoriesService()
      const result = await svc.deleteCategory(name)
      broadcastCategoriesUpdated()
      return result
    } catch (error) {
      console.error('Error deleting category:', error)
      return false
    }
  })

  ipcMain.handle('rule-add', async (event, { pattern, category, matchType, priority }) => {
    try {
      const svc = hybridConnection.getCategoriesService()
      const result = await svc.addCategoryRule(pattern, category, matchType, priority)
      broadcastCategoriesUpdated()
      return result
    } catch (error) {
      console.error('Error adding category rule:', error)
      return false
    }
  })

  ipcMain.handle('rule-update', async (event, { id, updates }) => {
    try {
      const svc = hybridConnection.getCategoriesService()
      const result = await svc.updateCategoryRule(id, updates)
      broadcastCategoriesUpdated()
      return result
    } catch (error) {
      console.error('Error updating category rule:', error)
      return false
    }
  })

  ipcMain.handle('rule-delete', async (event, { id }) => {
    try {
      const svc = hybridConnection.getCategoriesService()
      const result = await svc.deleteCategoryRule(id)
      broadcastCategoriesUpdated()
      return result
    } catch (error) {
      console.error('Error deleting category rule:', error)
      return false
    }
  })

  // Retag an app/domain's category from the Activity or Dashboard view. Instead
  // of a per-app override (which the 30s tracker would overwrite because it
  // re-derives the category every tick), this creates/updates a persistent
  // classification RULE that live tracking respects, then retags existing
  // history so past data is fixed too. One source of truth, no silent revert.
  ipcMain.handle('retag-app-category', async (event, { matchType, pattern, category }) => {
    try {
      if (!pattern || !category) {
        return { success: false, error: 'Missing pattern or category' }
      }
      const catSvc = hybridConnection.getCategoriesService()
      const usageSvc = hybridConnection.getAppUsageService()

      // 'domain' rows match by keyword (URL substring); native apps by 'app'.
      const ruleMatchType = matchType === 'domain' ? 'keyword' : 'app'
      const rule = await catSvc.upsertCategoryRule(pattern, category, ruleMatchType, 100)
      const retagged = await usageSvc.retagByPattern(matchType, pattern, category)

      // Reload rules in every preload (categories-updated) and refresh the
      // renderer views (app-category-updated) so the change shows immediately.
      broadcastCategoriesUpdated()
      mainWindow?.webContents.send('app-category-updated', { pattern, category })

      return { success: true, ruleCreated: rule?.created === true, retagged }
    } catch (error) {
      console.error('Error retagging app category:', error)
      return { success: false, error: error.message }
    }
  })

  // Auto-updater IPC handlers
  ipcMain.handle('check-for-updates', async () => {
    try {
      // Ensure listeners are attached even if the startup check never ran
      // (e.g. dev mode or a manual check before the 5s timer fires).
      configureAutoUpdater()
      const result = await getAutoUpdater().checkForUpdates()
      return result
    } catch (error) {
      console.error('Error checking for updates:', error)
      return null
    }
  })

  ipcMain.handle('download-update', async () => {
    try {
      configureAutoUpdater()
      await getAutoUpdater().downloadUpdate()
      return true
    } catch (error) {
      console.error('Error downloading update:', error)
      return false
    }
  })

  ipcMain.handle('install-update', () => {
    getAutoUpdater().quitAndInstall()
  })

  ipcMain.handle('load-data', async () => {
    try {
      await hybridConnection.whenReady()
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
      await hybridConnection.whenReady()
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

  ipcMain.handle('load-category-rules', async () => {
    try {
      await hybridConnection.whenReady()
      const categoriesService = hybridConnection.getCategoriesService()
      return await categoriesService.getCategoryRules()
    } catch (error) {
      console.error('Error loading category rules:', error)
      return []
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

  // --- Generic UI-state store ({userData}/ui-state.json) ---
  // A small key/value JSON file for renderer UI flags (onboarding progress,
  // dismissed cards, etc.). Kept SEPARATE from config.json because
  // save-ai-config overwrites that whole file; this store merges patches so
  // multiple independent flags can coexist without clobbering each other.
  const uiStatePath = () => path.join(app.getPath('userData'), 'ui-state.json')

  ipcMain.handle('get-ui-state', async () => {
    try {
      const p = uiStatePath()
      if (!fs.existsSync(p)) return {}
      const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'))
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch (error) {
      console.error('Error reading UI state:', error)
      return {}
    }
  })

  ipcMain.handle('set-ui-state', async (event, patch) => {
    try {
      if (!patch || typeof patch !== 'object') {
        return { success: false, error: 'Patch must be an object' }
      }
      const p = uiStatePath()
      let current = {}
      if (fs.existsSync(p)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'))
          if (parsed && typeof parsed === 'object') current = parsed
        } catch (parseError) {
          console.warn('Could not parse ui-state.json, overwriting:', parseError.message)
        }
      }
      const merged = { ...current, ...patch }
      fs.writeFileSync(p, JSON.stringify(merged, null, 2), 'utf-8')
      return { success: true, state: merged }
    } catch (error) {
      console.error('Error saving UI state:', error)
      return { success: false, error: error.message }
    }
  })

  // Resolve the bundled browser-extension folder. In dev it lives at the project
  // root; electron-builder copies it into resources/extension for packaged apps
  // (see electron-builder.yml `from: extension -> to: extension`).
  const getExtensionDir = () => {
    const isDev = process.env.NODE_ENV === 'development'
    const candidates = isDev
      ? [path.join(__dirname, '../../extension')]
      : [
          path.join(process.resourcesPath, 'extension'),
          path.join(__dirname, '../../extension'),
          path.join(__dirname, 'extension')
        ]
    for (const dir of candidates) {
      if (fs.existsSync(dir)) return dir
    }
    return candidates[0]
  }

  // Open the extension folder in the OS file manager so the user can point their
  // browser's "Load unpacked" at it. Returns the path so the UI can show it.
  ipcMain.handle('open-extension-folder', async () => {
    try {
      const dir = getExtensionDir()
      if (!fs.existsSync(dir)) {
        return { success: false, error: 'Extension folder not found', path: dir }
      }
      // openPath returns '' on success, or an error string.
      const err = await shell.openPath(dir)
      if (err) return { success: false, error: err, path: dir }
      return { success: true, path: dir }
    } catch (error) {
      console.error('Error opening extension folder:', error)
      return { success: false, error: error.message }
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
      await hybridConnection.whenReady()
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
      await hybridConnection.whenReady()
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

  // Export handler: the renderer serializes the data (it already has it) and hands
  // us the string; we show a native Save dialog and write the file. Returns
  // { success, canceled?, filePath?, error? } so the UI can give clear feedback.
  ipcMain.handle('export-data', async (event, { content, format, defaultName }) => {
    try {
      if (typeof content !== 'string' || !content) {
        return { success: false, error: 'Nothing to export' }
      }
      const ext = format === 'json' ? 'json' : 'csv'
      const filters =
        ext === 'json'
          ? [{ name: 'JSON', extensions: ['json'] }]
          : [{ name: 'CSV', extensions: ['csv'] }]

      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Export FocusBook Data',
        defaultPath: defaultName || `focusbook-export.${ext}`,
        filters: [...filters, { name: 'All Files', extensions: ['*'] }]
      })

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true }
      }

      fs.writeFileSync(result.filePath, content, 'utf8')
      return { success: true, filePath: result.filePath }
    } catch (error) {
      console.error('Error exporting data:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('get-formatted-usage-data', async (event, startDate, endDate) => {
    try {
      await hybridConnection.whenReady()
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
      await hybridConnection.whenReady()
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
        invalidateExclusionCache()
        const updatedList = await getCachedExclusionList(categoriesService)
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
        invalidateExclusionCache()
        const updatedList = await getCachedExclusionList(categoriesService)
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
      invalidateExclusionCache()
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

  // Stop the browser extension bridge WebSocket server.
  if (browserBridge) {
    try {
      browserBridge.stop()
    } catch (err) {
      console.error('Error stopping browser bridge:', err)
    }
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

    // Browser tab vs regular application. A browser popup carries context.isBrowser
    // (set in the preload); app_name for browsers is the URL/domain.
    const isBrowserTab =
      popup_context?.isBrowser ||
      (app_name && (app_name.startsWith('http') || (app_name.includes('.') && !app_name.endsWith('.exe'))))

    if (isBrowserTab && popup_context?.exe) {
      // Close the tab via the browser extension bridge (no Python). The bridge
      // asks the extension to chrome.tabs.remove the real active tab. When the
      // extension isn't connected we tell the user instead of silently no-op'ing.
      const result = browserBridge.closeActiveTab({
        exe: popup_context.exe,
        title: popup_context.title
      })
      if (result.ok) {
        console.log('Requested tab close via extension bridge')
      } else {
        console.log(`Could not close tab via extension: ${result.reason}`)
        notifyTabCloseUnavailable(result.reason)
      }
    } else if (app_name && app_name.endsWith('.exe')) {
      // Regular application. Use Node's built-in process.kill on the specific
      // foreground PID instead of shelling out to `taskkill /IM /F` (which is
      // Windows-only, force-kills EVERY instance of the exe, and risks unsaved
      // work). This is cross-platform and targets just the offending window's
      // process, trying a graceful SIGTERM before a forced SIGKILL.
      closeAppByPid(n_pid, app_name)
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

// Browser extension bridge: the URL-source seam. The preload calls this only
// after the focus tracker has confirmed a Chromium browser is foreground. It
// resolves state ONLY — it never opens, closes, or mutates a usage span.
ipcMain.handle('resolve-browser-url', (event, windowInfo) => {
  try {
    return browserBridge.resolve(windowInfo || {})
  } catch (error) {
    console.error('Error resolving browser URL:', error)
    return { source: 'degraded' }
  }
})

// Bridge status + token for the Settings UI.
ipcMain.handle('get-browser-bridge-status', () => {
  return browserBridge.getStatus()
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
