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
// Span-model categorization (new architecture): immutable span log + query-time
// resolution. See src/main/classification/. Bound lazily to the live connection.
const { SpanService } = require('./classification/spanService')
const { spansToAppUsageData } = require('./classification/appUsageAdapter')

// One SpanService bound to the current DB connection. Rebuilt if the connection
// changes (online/offline switch); getConnection() exposes run/all which SpanService needs.
let _spanService = null
let _spanServiceConn = null
function getSpanService() {
  const conn = hybridConnection.getConnection()
  if (!conn) return null
  if (_spanService && _spanServiceConn === conn) return _spanService
  _spanService = new SpanService(conn)
  _spanServiceConn = conn
  return _spanService
}

// Build the legacy appUsageData shape from spans resolved over [startMs, endMs).
// Shared by load-data and the aggregated-data handlers so they resolve identically.
async function resolvedAppUsageData(startMs, endMs) {
  const spanSvc = getSpanService()
  if (!spanSvc) return {}
  const resolved = await spanSvc.getResolvedSpans(startMs, endMs)
  return spansToAppUsageData(resolved)
}

// Presence/idle engine (see docs/PRESENCE_AND_IDLE_ENGINE.md). Main owns the state
// machine as the SINGLE writer of presence spans, driven by powerMonitor events + a
// periodic idle poll. Bound to the live connection, same lazy pattern as getSpanService.
const { PresenceService } = require('./classification/presenceService')
const PRESENCE_HEARTBEAT_MS = 5000
// How often we poll idle state to catch the active→idle transition. Finer than the idle
// threshold so detection latency is bounded; backdating (§3) corrects the entry edge
// regardless, so this cadence only affects how soon a span is *written*, not its bounds.
const PRESENCE_POLL_MS = 30 * 1000
let _presenceService = null
let _presenceServiceConn = null
let presenceHeartbeatInterval = null
let presencePollInterval = null
let presenceListenersBound = false

function getPresenceService() {
  const conn = hybridConnection.getConnection()
  if (!conn) return null
  if (_presenceService && _presenceServiceConn === conn) return _presenceService
  _presenceService = new PresenceService(conn, { heartbeatIntervalMs: PRESENCE_HEARTBEAT_MS })
  _presenceServiceConn = conn
  return _presenceService
}

// Build the current OS observation for the state machine. `event` is the powerMonitor
// signal that triggered this poll ('suspend'|'resume'|'lock'|'unlock'|undefined). For
// suspend/lock the verdict is unambiguous; everything else re-reads the authoritative
// idle state + seconds-since-input so the machine recomputes from scratch (idempotent).
function readPresenceObservation(event) {
  const obs = { event }
  try {
    obs.idleState = powerMonitor.getSystemIdleState(1) // 1s threshold — we apply our own
    obs.idleSeconds = powerMonitor.getSystemIdleTime() // seconds since last input (§3)
  } catch (e) {
    // If the platform can't answer, leave them undefined; observationToType falls back
    // to 'active' for non-suspend/lock events, which the next poll corrects.
  }
  return obs
}

// Minimum absence worth prompting about on return (§7/§9). Below this, the return
// prompt is noise (a bathroom break); at/above it, asking converts the app's worst-
// quality data (was that idle block a meeting?) into its best.
const AWAY_PROMPT_MIN_MS = 5 * 60 * 1000

// The single reconcile entry point. Every powerMonitor handler and the periodic poll
// call this; running it twice for one real event is safe (idempotent by design, §6).
// When the user returns from a long absence, fire the 'away-return' event so the
// renderer can ask what it was — the answer becomes a span_annotation (a new fact).
async function reconcilePresence(event) {
  const svc = getPresenceService()
  if (!svc) return
  try {
    const res = await svc.reconcile(readPresenceObservation(event), Date.now())
    if (
      res &&
      res.returnedFromAbsence &&
      res.closedDurationMs >= AWAY_PROMPT_MIN_MS &&
      res.closedSpanId != null
    ) {
      const payload = {
        spanId: res.closedSpanId,
        type: res.closedType,
        durationMs: res.closedDurationMs
      }
      BrowserWindow.getAllWindows().forEach((w) => {
        if (!w.isDestroyed()) w.webContents.send('away-return', payload)
      })
    }
  } catch (err) {
    console.error(`Presence reconcile (${event || 'poll'}) failed:`, err)
  }
}

// Register powerMonitor listeners exactly once. Each just triggers an idempotent
// recompute — we deliberately do NOT hand-code the resume/unlock choreography (§9).
function bindPresenceListeners() {
  if (presenceListenersBound) return
  presenceListenersBound = true
  powerMonitor.on('suspend', () => { reconcilePresence('suspend') })
  powerMonitor.on('resume', () => { reconcilePresence('resume') })
  powerMonitor.on('lock-screen', () => { reconcilePresence('lock') })
  powerMonitor.on('unlock-screen', () => { reconcilePresence('unlock') })
}

// Run once after the DB is ready: reconcile any period the app was NOT running into an
// explicit `unknown` presence span, open the first live span from the state observed at
// launch, then start the heartbeat (watermark + open-span flush) and the idle poll.
// Writing a fresh heartbeat immediately AFTER reconcile is what makes a second startup
// not re-attribute the same gap. Best-effort — a failure here must never block startup.
async function startPresenceTracking() {
  const svc = getPresenceService()
  if (!svc) return
  try {
    const res = await svc.reconcileOnStartup(Date.now())
    if (res.backfilled) {
      console.log(
        `🕳️  Backfilled ${Math.round(res.gapMs / 60000)}min the app was not running as an 'unknown' presence span`
      )
    }
    // Seed the watermark right away so the next launch measures the gap from now.
    await svc.heartbeat(Date.now())
    // Open the first live span from whatever state the machine observes right now.
    const obs = readPresenceObservation()
    svc.startTracking(svc.observationToType(obs), Date.now())
  } catch (error) {
    console.error('Presence startup failed:', error)
  }

  bindPresenceListeners()

  if (presenceHeartbeatInterval) clearInterval(presenceHeartbeatInterval)
  presenceHeartbeatInterval = setInterval(() => {
    const s = getPresenceService()
    if (!s) return
    // Heartbeat advances the watermark AND flushes the open span, so the on-disk log
    // plus the (short) open span always tile the timeline even across a crash.
    const now = Date.now()
    s.heartbeat(now).catch((err) => console.error('Presence heartbeat failed:', err))
    s.flushOpenSpan(now).catch((err) => console.error('Presence flush failed:', err))
  }, PRESENCE_HEARTBEAT_MS)

  if (presencePollInterval) clearInterval(presencePollInterval)
  presencePollInterval = setInterval(() => { reconcilePresence() }, PRESENCE_POLL_MS)
}

// Stop just the presence timers (sync). Safe to call from the sync clearAppTimers path.
function stopPresenceTimers() {
  if (presenceHeartbeatInterval) {
    clearInterval(presenceHeartbeatInterval)
    presenceHeartbeatInterval = null
  }
  if (presencePollInterval) {
    clearInterval(presencePollInterval)
    presencePollInterval = null
  }
}

// Stop the timers AND close the open span at `now` (clean shutdown). Must be awaited
// BEFORE the DB disconnects so the final span is persisted. Closing on quit means the
// next startup's reconcile sees a fresh watermark and correctly finds no hole — so we
// never write a spurious `unknown` span for a clean quit.
async function stopPresenceTracking() {
  stopPresenceTimers()
  const svc = getPresenceService()
  if (svc) {
    try { await svc.closeTracking(Date.now()) }
    catch (err) { console.error('Presence closeTracking failed:', err) }
  }
}

// Cached rule context for the live focus/popup resolve (C1). The tracking loop hits
// resolve-live every tick, so we cache the rule/category/override snapshot and bust
// it whenever rules change (invalidateRuleContext, called from broadcastCategoriesUpdated).
let _ruleContext = null
async function getRuleContext() {
  if (_ruleContext) return _ruleContext
  const spanSvc = getSpanService()
  if (!spanSvc) return { rules: [], categories: {}, overrides: {} }
  _ruleContext = await spanSvc.loadRuleContext()
  return _ruleContext
}
function invalidateRuleContext() {
  _ruleContext = null
}

// Start-of-day / end-of-day epoch ms for a 'YYYY-MM-DD' date string (local time).
function dayRange(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const start = d.getTime()
  return { start, end: start + 24 * 60 * 60 * 1000 }
}
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
  // Sync: just stop the timers here. The open presence span is closed+persisted in the
  // async cleanupWithDb path (which awaits it before disconnecting the DB).
  stopPresenceTimers()
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

    // Presence/idle engine: reconcile any crash/power-cut gap and start the liveness
    // heartbeat. Runs right after the DB is up so a hole is attributed before anything
    // else touches presence data. Non-blocking on failure (handled inside).
    await startPresenceTracking()

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

  // Auto-startup is OPT-IN, not forced. We used to silently enable openAtLogin on
  // first run, which added FocusBook to system startup without asking — a common
  // trust complaint. The user now controls this from Settings → Startup (the
  // get/set-auto-launch handlers); we no longer touch login items here.

  // --- AI service DISABLED ---
  // The local AI service (Chat/Insights) is currently disabled: the Python process
  // is never spawned. The IPC handlers, preload bridges, and Settings AI config
  // reading are left intact but the UI entry points (sidebar link, /chat route,
  // Settings AI panel) are hidden, so nothing tries to reach a service that isn't
  // running. To re-enable, uncomment the startup block below and restore the UI
  // entry points (see git history / the WORK_MODE_ENGINE notes).
  //
  // // Start AI service with config from config.json
  // try {
  //   const userDataPath = app.getPath('userData')
  //   const configPath = path.join(userDataPath, 'config.json')
  //
  //   let aiConfig = {
  //     provider: 'openai',
  //     openaiKey: '',
  //     geminiKey: ''
  //   }
  //
  //   // Read config.json if it exists
  //   if (fs.existsSync(configPath)) {
  //     try {
  //       const configData = fs.readFileSync(configPath, 'utf-8')
  //       const savedConfig = JSON.parse(configData)
  //
  //       // Map config.json format to AIServiceManager format
  //       aiConfig.provider = savedConfig.provider || 'openai'
  //       if (savedConfig.provider === 'gemini') {
  //         aiConfig.geminiKey = savedConfig.apiKey || ''
  //       } else {
  //         aiConfig.openaiKey = savedConfig.apiKey || ''
  //       }
  //
  //       console.log('📋 Loaded AI config from:', configPath)
  //       console.log('🤖 AI Provider:', aiConfig.provider)
  //     } catch (configError) {
  //       console.warn('⚠️ Could not parse config.json, using defaults:', configError.message)
  //     }
  //   }
  //
  //   // Only start the AI service if a key is actually configured. The service's
  //   // startup requires a valid provider key and exits otherwise, so starting it
  //   // keyless just crash-loops it on every launch. AI features stay unavailable
  //   // until the user adds a key in Settings (which restarts the service).
  //   const hasKey = Boolean((aiConfig.openaiKey || '').trim() || (aiConfig.geminiKey || '').trim())
  //   if (hasKey) {
  //     await aiServiceManager.start(aiConfig)
  //     console.log('✅ AI service started successfully')
  //   } else {
  //     console.log('📋 No AI key configured — AI service not started (add one in Settings to enable).')
  //   }
  // } catch (error) {
  //   console.error('❌ Failed to start AI service:', error.message)
  //   console.log('📋 AI insights will not be available.')
  // }
  console.log('📋 AI service is disabled in this build.')


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

  // Work-modes (Level 2) metadata: [{ name, rollup, color, icon }, ...]. The
  // renderer uses this to drive the mode donut/drill-down palette and the
  // mode -> productive/neutral/distracted rollup.
  ipcMain.handle('get-all-modes', async () => {
    try {
      await hybridConnection.whenReady()
      const categoriesService = hybridConnection.getCategoriesService()
      return await categoriesService.getModes()
    } catch (error) {
      console.error('Error loading modes:', error)
      return []
    }
  })

  // Category -> default_mode map { categoryName: modeName } for getMode's fallback.
  ipcMain.handle('get-category-default-modes', async () => {
    try {
      await hybridConnection.whenReady()
      const categoriesService = hybridConnection.getCategoriesService()
      return await categoriesService.getCategoryDefaultModes()
    } catch (error) {
      console.error('Error loading category default modes:', error)
      return {}
    }
  })

  // --- Category + rule CRUD (Settings "Categories Management") ---
  // Broadcast so any open window refreshes its DB-driven category cache.
  const broadcastCategoriesUpdated = () => {
    // Any rule/category change invalidates the cached live-resolve context so the
    // focus/popup decision picks up the edit on the next tick.
    invalidateRuleContext()
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

  ipcMain.handle('rule-add', async (event, { pattern, category, matchType, priority, mode }) => {
    try {
      const svc = hybridConnection.getCategoriesService()
      const result = await svc.addCategoryRule(pattern, category, matchType, priority, mode)
      broadcastCategoriesUpdated()
      return result
    } catch (error) {
      console.error('Error adding category rule:', error)
      return false
    }
  })

  // --- Per-app work-mode (Level 2) overrides (Settings + Activity-row mode picker) ---
  // Each mutation broadcasts categories-updated so every preload reloads its
  // in-memory modeOverrides map and getMode honours the change on the next tick.
  ipcMain.handle('mode-override-get', async () => {
    try {
      const svc = hybridConnection.getCategoriesService()
      return await svc.getModeOverrides()
    } catch (error) {
      console.error('Error loading mode overrides:', error)
      return {}
    }
  })

  ipcMain.handle('mode-override-set', async (event, { appIdentifier, mode, matchType, pattern }) => {
    try {
      const svc = hybridConnection.getCategoriesService()
      const result = await svc.setModeOverride(appIdentifier, mode)

      // Also rewrite the MODE on existing app_usage rows so the change is visible
      // immediately in the Activity table (not just on the next tracking tick).
      // Without this the row re-reads its old stored mode on reload and appears to
      // "not change". Mirrors the category retag. The pattern/matchType come from
      // the preload (derived from the row like retagAppCategory); fall back to the
      // identifier as an app-name match when they're absent.
      const usageSvc = hybridConnection.getAppUsageService()
      const effMatchType = matchType || 'app'
      const effPattern = pattern || appIdentifier
      const retagged = await usageSvc.retagModeByPattern(effMatchType, effPattern, mode)

      broadcastCategoriesUpdated()
      mainWindow?.webContents.send('app-category-updated', { pattern: effPattern, mode })

      return { success: result === true, retagged }
    } catch (error) {
      console.error('Error setting mode override:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('mode-override-delete', async (event, { appIdentifier }) => {
    try {
      const svc = hybridConnection.getCategoriesService()
      const result = await svc.removeModeOverride(appIdentifier)
      broadcastCategoriesUpdated()
      return result
    } catch (error) {
      console.error('Error deleting mode override:', error)
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

  // SPAN MODEL — read path (Phase B). Build the legacy appUsageData shape from spans
  // RESOLVED at query time (category comes from the current rules, never from a stored
  // column), so editing a rule retroactively re-labels the dashboard with no migration.
  // Default range: last 90 days (dashboards are day/week/month scoped; all-time isn't
  // needed and keeps the resolve set bounded).
  ipcMain.handle('load-data', async () => {
    try {
      await hybridConnection.whenReady()
      const categoriesService = hybridConnection.getCategoriesService()
      const now = Date.now()
      const data = await resolvedAppUsageData(now - 90 * 24 * 60 * 60 * 1000, now + 24 * 60 * 60 * 1000)
      return await filterExcludedApps(data, categoriesService)
    } catch (error) {
      console.error('Error loading data (span model):', error)
      return {}
    }
  })

  // SPAN MODEL — write path (Phase A). One immutable span per tracked interval. No
  // category/mode is computed or stored here; it is derived at read time.
  ipcMain.handle('write-span', async (event, { raw, start, end, degraded }) => {
    try {
      const spanSvc = getSpanService()
      if (!spanSvc) return null
      return await spanSvc.writeSpan(raw, start, end, !!degraded)
    } catch (error) {
      console.error('Error writing span:', error)
      return null
    }
  })

  // SPAN MODEL — live resolve (C1). The tracking loop's real-time "is this app
  // distracting?" decision resolves a single raw observation against the CURRENT
  // rules, so focus/popup uses the same classification source as the dashboards.
  // Returns { category, productivity, winning_rule } — never throws.
  ipcMain.handle('resolve-live', async (event, raw) => {
    try {
      const { normalizeKey } = require('./classification/normalizeKey')
      const { resolve } = require('./classification/resolver')
      const ctx = await getRuleContext()
      const key = normalizeKey(raw || {})
      return resolve(key, ctx.rules, ctx.categories, ctx.overrides)
    } catch (error) {
      console.error('Error in resolve-live:', error)
      return { category: null, productivity: 'unrated', winning_rule: null }
    }
  })

  // Uncategorized time, grouped by key, longest first — the self-service backlog.
  ipcMain.handle('get-uncategorized', async (event, range) => {
    try {
      const spanSvc = getSpanService()
      if (!spanSvc) return []
      const now = Date.now()
      const start = (range && range.start) || now - 7 * 24 * 60 * 60 * 1000
      const end = (range && range.end) || now + 24 * 60 * 60 * 1000
      return await spanSvc.getUncategorizedByKey(start, end)
    } catch (error) {
      console.error('Error loading uncategorized spans:', error)
      return []
    }
  })

  // --- PRESENCE MODEL — annotations (§7) ---
  // Record the user's interpretation of an absence span (the answer to the return
  // prompt). A new fact, not a correction — the presence_span is never rewritten.
  ipcMain.handle('presence-annotate-span', async (event, { spanId, label }) => {
    try {
      const svc = getPresenceService()
      if (!svc || !spanId || !label) return { success: false }
      const res = await svc.annotateSpan(spanId, label, Date.now())
      return { success: res.id != null, id: res.id }
    } catch (error) {
      console.error('presence-annotate-span:', error)
      return { success: false }
    }
  })

  // Long, unannotated absences in a window — backlog for the return prompt (e.g. after
  // the app was closed over several away blocks). Defaults to the last 24h.
  ipcMain.handle('presence-get-unannotated-away', async (event, range) => {
    try {
      const svc = getPresenceService()
      if (!svc) return []
      const now = Date.now()
      const start = (range && range.start) || now - 24 * 60 * 60 * 1000
      const end = (range && range.end) || now + 60 * 1000
      return await svc.getUnannotatedAway(start, end, AWAY_PROMPT_MIN_MS)
    } catch (error) {
      console.error('presence-get-unannotated-away:', error)
      return []
    }
  })

  // Resolved presence spans (absence + joined user label) for a range — the seam a
  // presence/timeline dashboard consumes. Defaults to the last 24h.
  ipcMain.handle('presence-get-resolved', async (event, range) => {
    try {
      const svc = getPresenceService()
      if (!svc) return []
      const now = Date.now()
      const start = (range && range.start) || now - 24 * 60 * 60 * 1000
      const end = (range && range.end) || now + 60 * 1000
      return await svc.getResolvedPresence(start, end)
    } catch (error) {
      console.error('presence-get-resolved:', error)
      return []
    }
  })

  // Legacy save-data is retired under the span model (spans are written per-interval
  // via write-span). Kept as a no-op so any stale caller doesn't error during cutover.
  ipcMain.handle('save-data', async () => {
    return true
  })

  // --- SPAN MODEL — category/rule CRUD + correction (C2) ---
  // All mutations invalidate the live-resolve cache (via getSpanService's context) and
  // broadcast categories-updated so preloads + dashboards refresh. Because reads
  // resolve live, corrections are retroactive with no history migration.
  const afterRuleChange = () => {
    invalidateRuleContext()
    BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('categories-updated', null))
  }

  ipcMain.handle('span-categories-get', async () => {
    try { return await getSpanService()?.getCategories() ?? [] }
    catch (e) { console.error('span-categories-get:', e); return [] }
  })

  ipcMain.handle('span-rules-get', async () => {
    try { return await getSpanService()?.getRules() ?? [] }
    catch (e) { console.error('span-rules-get:', e); return [] }
  })

  ipcMain.handle('span-category-add', async (event, { name, defaultProductivity }) => {
    try { const r = await getSpanService()?.addCategory(name, defaultProductivity); afterRuleChange(); return r }
    catch (e) { console.error('span-category-add:', e); return false }
  })

  ipcMain.handle('span-category-update', async (event, { id, updates }) => {
    try { const r = await getSpanService()?.updateCategory(id, updates); afterRuleChange(); return r }
    catch (e) { console.error('span-category-update:', e); return false }
  })

  ipcMain.handle('span-category-delete', async (event, { id }) => {
    try { const r = await getSpanService()?.deleteCategory(id); afterRuleChange(); return r }
    catch (e) { console.error('span-category-delete:', e); return false }
  })

  ipcMain.handle('span-rule-add', async (event, payload) => {
    try { const r = await getSpanService()?.upsertRule(payload); afterRuleChange(); return r }
    catch (e) { console.error('span-rule-add:', e); return { id: null, created: false } }
  })

  ipcMain.handle('span-rule-update', async (event, { id, updates }) => {
    try { const r = await getSpanService()?.updateRule(id, updates); afterRuleChange(); return r }
    catch (e) { console.error('span-rule-update:', e); return false }
  })

  ipcMain.handle('span-rule-delete', async (event, { id }) => {
    try { const r = await getSpanService()?.deleteRule(id); afterRuleChange(); return r }
    catch (e) { console.error('span-rule-delete:', e); return false }
  })

  // The correction primitive: "change this app/domain's category" -> upsert a user
  // rule. `app` is the Activity/dashboard row ({ name, key, domain, ... }); we derive
  // a matcher (domain rule for web rows, app rule for native) and re-point it. Instantly
  // retroactive — no retagByPattern UPDATE sweep.
  ipcMain.handle('span-correct-category', async (event, { app, categoryName }) => {
    try {
      const svc = getSpanService()
      if (!svc || !categoryName) return { success: false, error: 'Missing service or category' }
      let matcher_type
      let matcher_value
      if (app && app.domain) {
        matcher_type = 'domain'
        const { normalizeDomain } = require('./classification/normalizeKey')
        matcher_value = normalizeDomain(app.domain)
      } else {
        matcher_type = 'app'
        // Native rows are keyed by friendly name; match on the raw exe when available,
        // else the friendly name. The row carries `key` (the tracker appKey).
        matcher_value = String(app?.exe || app?.key || app?.name || '').toLowerCase()
      }
      if (!matcher_value) return { success: false, error: 'Could not derive a matcher' }
      const res = await svc.upsertRule({ matcher_type, matcher_value, categoryName, is_user_rule: 1 })
      afterRuleChange()
      return { success: true, created: res.created, matcher_type, matcher_value }
    } catch (e) {
      console.error('span-correct-category:', e)
      return { success: false, error: e.message }
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

  // --- Blocking / focus settings ---
  // Persist the user's distraction-blocking preferences (global on/off switch,
  // productive-time threshold before an auto session, auto-session length) into
  // ui-state.json under `blocking`, then broadcast the change so the preload
  // tracking loop applies it live without a restart. The preload is the enforcer;
  // this handler is just the persist + notify path.
  ipcMain.handle('get-blocking-settings', async () => {
    try {
      const p = uiStatePath()
      if (!fs.existsSync(p)) return {}
      const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'))
      return (parsed && typeof parsed === 'object' && parsed.blocking) || {}
    } catch (error) {
      console.error('Error reading blocking settings:', error)
      return {}
    }
  })

  ipcMain.handle('set-blocking-settings', async (event, patch) => {
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
      const blocking = { ...(current.blocking || {}), ...patch }
      const merged = { ...current, blocking }
      fs.writeFileSync(p, JSON.stringify(merged, null, 2), 'utf-8')

      // Notify the tracking loop (runs in the window's preload) so it takes effect now.
      mainWindow?.webContents.send('blocking-settings-changed', blocking)
      return { success: true, blocking }
    } catch (error) {
      console.error('Error saving blocking settings:', error)
      return { success: false, error: error.message }
    }
  })

  // Resolve the bundled (read-only source) browser-extension folder. In dev it
  // lives at the project root; electron-builder copies it into resources/extension
  // for packaged apps (see electron-builder.yml `from: extension -> to: extension`).
  const getBundledExtensionDir = () => {
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

  // The extension folder we actually reveal and stamp the token into. In a
  // per-machine install the bundled copy under Program Files is read-only for
  // standard users, so we can't stamp the token there. To make auto-pairing work
  // regardless of install type, we mirror the bundled extension into a writable
  // per-user directory (userData/extension) and reveal that copy.
  //
  // In dev, the project's extension/ folder is already writable and is what the
  // developer edits, so we use it directly and skip the copy.
  const getExtensionDir = () => {
    const isDev = process.env.NODE_ENV === 'development'
    const bundled = getBundledExtensionDir()
    if (isDev) return bundled

    const target = path.join(app.getPath('userData'), 'extension')
    try {
      syncExtensionCopy(bundled, target)
      return target
    } catch (error) {
      // Copy failed (odd permissions on userData?): fall back to the bundled
      // path. Stamping may then fail on a read-only install, but the manual
      // token flow still works.
      console.warn('Could not prepare writable extension copy:', error.message)
      return bundled
    }
  }

  // Mirror the bundled extension into `target`, skipping the token stamp file so
  // a previously-stamped token isn't clobbered by the empty placeholder.
  //
  // Copies when the target is missing, when a source file differs in size, or
  // when the app version has changed since the last sync. The version gate makes
  // updates deterministic even if the installer doesn't preserve mtimes across
  // the resources -> userData boundary: every app update ships a new version, so
  // the whole extension is refreshed on first launch after an update.
  const syncExtensionCopy = (source, target) => {
    if (!fs.existsSync(source)) return
    fs.mkdirSync(target, { recursive: true })

    const stampPath = path.join(target, '.version')
    let lastVersion = null
    try {
      lastVersion = fs.readFileSync(stampPath, 'utf-8').trim()
    } catch {
      lastVersion = null
    }
    const versionChanged = lastVersion !== app.getVersion()

    for (const name of fs.readdirSync(source)) {
      // Never overwrite the stamped token file from the source placeholder.
      if (name === 'focusbook-token.js') continue
      const srcPath = path.join(source, name)
      const dstPath = path.join(target, name)
      const srcStat = fs.statSync(srcPath)
      if (srcStat.isDirectory()) continue // extension is flat; ignore any nested dirs
      let needsCopy = versionChanged
      if (!needsCopy) {
        try {
          const dstStat = fs.statSync(dstPath)
          needsCopy = srcStat.size !== dstStat.size
        } catch {
          needsCopy = true // target missing
        }
      }
      if (needsCopy) fs.copyFileSync(srcPath, dstPath)
    }

    if (versionChanged) {
      try {
        fs.writeFileSync(stampPath, app.getVersion())
      } catch {
        // non-fatal: worst case we re-copy identical files next launch
      }
    }
  }

  // Stamp the current pairing token into the extension folder so that loading the
  // unpacked extension connects automatically — no copy/paste. The extension's
  // service worker reads focusbook-token.js when its storage has no user-entered
  // token (see extension/background.js getBundledToken). Returns true on success.
  const writeExtensionToken = (dir) => {
    try {
      const status = browserBridge?.getStatus?.()
      const token = status?.token
      if (!token) return false
      const file = path.join(dir, 'focusbook-token.js')
      const contents =
        '// Auto-generated by the FocusBook desktop app. Do not edit by hand.\n' +
        `globalThis.FOCUSBOOK_BUNDLED_TOKEN = ${JSON.stringify(token)}\n`
      fs.writeFileSync(file, contents)
      return true
    } catch (error) {
      console.warn('Could not stamp extension token:', error.message)
      return false
    }
  }

  // Prepare the writable copy and stamp the token at startup so an already-loaded
  // extension re-pairs on the next app launch, and so the folder is pre-paired
  // even before the user opens Settings.
  try {
    const dir = getExtensionDir()
    if (fs.existsSync(dir)) writeExtensionToken(dir)
  } catch (error) {
    console.warn('Extension token stamp on startup failed:', error.message)
  }

  // Open the extension folder in the OS file manager so the user can point their
  // browser's "Load unpacked" at it. Stamps the pairing token first so the loaded
  // extension connects on its own. Returns the path so the UI can show it.
  ipcMain.handle('open-extension-folder', async () => {
    try {
      const dir = getExtensionDir()
      if (!fs.existsSync(dir)) {
        return { success: false, error: 'Extension folder not found', path: dir }
      }
      const paired = writeExtensionToken(dir)
      // openPath returns '' on success, or an error string.
      const err = await shell.openPath(dir)
      if (err) return { success: false, error: err, path: dir }
      return { success: true, path: dir, paired }
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
      const categoriesService = hybridConnection.getCategoriesService()
      const { start, end } = dayRange(date)
      const data = await resolvedAppUsageData(start, end)
      return await filterExcludedApps(data, categoriesService)
    } catch (error) {
      console.error('Error getting aggregated data by date:', error)
      return { error: error.message }
    }
  })

  ipcMain.handle('get-all-aggregated-data', async () => {
    try {
      await hybridConnection.whenReady()
      const categoriesService = hybridConnection.getCategoriesService()
      const now = Date.now()
      const data = await resolvedAppUsageData(now - 365 * 24 * 60 * 60 * 1000, now + 24 * 60 * 60 * 1000)
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

  // Delete the user's recorded activity. This is a REAL, irreversible wipe of the
  // event logs (spans, presence, legacy usage, focus sessions) — the renderer must
  // confirm with the user first. It deliberately PRESERVES the taxonomy the user
  // configured: categories, classification rules, productivity overrides, custom
  // mappings, exclusions and mode overrides all survive, so a wipe resets the
  // history without throwing away the rules the user tuned.
  //   scope 'history' — clear activity + presence, keep focus-session records.
  //   scope 'all'     — also clear focus-session history (everything but taxonomy).
  ipcMain.handle('delete-activity-data', async (event, scope = 'all') => {
    const conn = hybridConnection.getConnection()
    if (!conn) {
      return { success: false, error: 'Database is not available.' }
    }

    // Only wipe tables that actually exist in this DB (span/presence tables are
    // absent on very old databases), so a missing table never fails the whole op.
    const existing = await conn.all(
      "SELECT name FROM sqlite_master WHERE type='table'"
    )
    const tableSet = new Set(existing.map((r) => r.name))

    // Activity/event-log tables. timestamps + span_annotation cascade from their
    // parents, but we clear them explicitly so the op works even if FK cascade is off.
    const historyTables = [
      'timestamps',
      'app_usage',
      'span_annotation',
      'presence_span',
      'span',
      'app_liveness'
    ]
    const focusTables = ['focus_session_interruptions', 'focus_sessions']
    const targets = (scope === 'history' ? historyTables : [...historyTables, ...focusTables])
      .filter((t) => tableSet.has(t))

    try {
      await conn.run('BEGIN')
      let cleared = 0
      for (const table of targets) {
        const res = await conn.run(`DELETE FROM ${table}`)
        cleared += res?.changes || 0
      }
      await conn.run('COMMIT')

      // Reclaim disk and reset any in-memory presence/span services bound to the
      // now-empty tables so the next tick starts clean.
      try {
        await conn.run('VACUUM')
      } catch (vacuumError) {
        console.warn('VACUUM after data wipe failed (non-fatal):', vacuumError.message)
      }
      _spanService = null
      _presenceService = null

      // Tell the UI its data changed so open views reload to the empty state.
      mainWindow?.webContents.send('category-updated')

      console.log(`Activity data wiped (scope=${scope}); ${cleared} rows removed`)
      return { success: true, scope, rowsCleared: cleared }
    } catch (error) {
      try {
        await conn.run('ROLLBACK')
      } catch {
        // ignore — nothing to roll back
      }
      console.error('Error deleting activity data:', error)
      return { success: false, error: error.message }
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

  // Close+persist the open presence span BEFORE the DB disconnects, so a clean quit
  // leaves the timeline gapless up to now (and the next startup finds no hole).
  try {
    await stopPresenceTracking()
  } catch (error) {
    console.error('Error closing presence span during cleanup:', error)
  }

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
