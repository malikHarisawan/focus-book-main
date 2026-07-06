/**
 * FocusBook Tab Reporter - MV3 service worker
 *
 * Connects to the FocusBook desktop app's local WebSocket bridge and reports
 * active-tab state: a full snapshot on connect, then incremental events. This
 * extension reports STATE ONLY (what tab is active in which window) — it never
 * measures, computes, or reports durations or "time spent". The desktop app's
 * focus tracker is the sole authority on when time is spent.
 *
 * Liveness under MV3: the service worker can be suspended at any time. Two
 * mechanisms keep reporting alive:
 *   1. A heartbeat sent over the socket every HEARTBEAT_INTERVAL_MS. Active
 *      WebSocket traffic resets Chrome's service-worker idle timer, so a busy
 *      socket keeps the worker alive on its own.
 *   2. A chrome.alarms alarm as the resurrection path: if the worker is killed
 *      anyway, the alarm wakes it, and onStartup/onInstalled/alarm handlers all
 *      re-establish the socket and re-send a fresh snapshot.
 */

// Must match PORTS in src/main/browserBridge.js.
const PORTS = [17650, 17651, 17652]
const HEARTBEAT_INTERVAL_MS = 10000
const ALARM_NAME = 'focusbook-keepalive'
const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 30000

let socket = null
let portIndex = 0
let reconnectDelay = RECONNECT_BASE_MS
let reconnectTimer = null
let heartbeatTimer = null
let authToken = null
let profileId = null

// Detect the browser so the desktop app can match the exe reported by the OS
// focus tracker (chrome.exe / brave.exe / msedge.exe) to this connection.
function detectBrowser() {
  const ua = navigator.userAgent
  if (/Edg\//.test(ua)) return 'edge'
  if (/Brave/.test(ua) || (navigator.brave && navigator.brave.isBrave)) return 'brave'
  return 'chrome'
}
const browserName = detectBrowser()

async function getAuthToken() {
  if (authToken) return authToken
  const stored = await chrome.storage.local.get('focusbookToken')
  authToken = stored.focusbookToken || null
  return authToken
}

// A stable per-profile id. chrome.instanceID-style uniqueness isn't needed;
// we just need to distinguish simultaneous profile connections of the same
// browser. Persist a random id in storage on first run.
async function getProfileId() {
  if (profileId) return profileId
  const stored = await chrome.storage.local.get('focusbookProfileId')
  if (stored.focusbookProfileId) {
    profileId = stored.focusbookProfileId
  } else {
    profileId = `${browserName}-${Math.random().toString(36).slice(2, 10)}`
    await chrome.storage.local.set({ focusbookProfileId: profileId })
  }
  return profileId
}

function isReportableUrl(url) {
  if (!url) return false
  // Never report internal browser pages or extension pages.
  return /^https?:\/\//i.test(url)
}

function send(message) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return
  try {
    socket.send(JSON.stringify({ ...message, token: authToken }))
  } catch (e) {
    // socket died between the readyState check and send; reconnect path handles it
  }
}

// Build the full state: every normal window with its active tab, plus which
// window is focused. Windows/tabs the extension cannot see (a browser with no
// extension access in incognito) simply won't appear — the desktop app treats
// a focused-but-absent window as private and never guesses a URL.
async function buildSnapshot() {
  const windows = await chrome.windows.getAll({ populate: true })
  const focused = await chrome.windows.getLastFocused().catch(() => null)

  const payload = []
  for (const win of windows) {
    if (win.type !== 'normal') continue
    const activeTab = (win.tabs || []).find((t) => t.active)
    if (!activeTab) continue
    payload.push({
      windowId: win.id,
      activeTabId: activeTab.id,
      url: isReportableUrl(activeTab.url) ? activeTab.url : null,
      title: activeTab.title || null,
      incognito: Boolean(win.incognito)
    })
  }

  return {
    type: 'snapshot',
    browser: browserName,
    profileId,
    windows: payload,
    focusedWindowId: focused && focused.type === 'normal' ? focused.id : null
  }
}

async function sendSnapshot() {
  try {
    const snapshot = await buildSnapshot()
    send(snapshot)
  } catch (e) {
    console.warn('FocusBook: failed to build snapshot', e)
  }
}

function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = setInterval(() => {
    send({ type: 'heartbeat', browser: browserName, profileId })
  }, HEARTBEAT_INTERVAL_MS)
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    // Rotate through candidate ports on each retry so a shifted port is found.
    portIndex = (portIndex + 1) % PORTS.length
    connect()
  }, reconnectDelay)
  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS)
}

async function connect() {
  await getAuthToken()
  await getProfileId()

  if (!authToken) {
    // No token entered yet: retry later (user pastes it in the options page).
    scheduleReconnect()
    return
  }

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return
  }

  const port = PORTS[portIndex]
  try {
    socket = new WebSocket(`ws://127.0.0.1:${port}`)
  } catch (e) {
    scheduleReconnect()
    return
  }

  socket.onopen = () => {
    reconnectDelay = RECONNECT_BASE_MS
    send({ type: 'hello', browser: browserName, profileId })
    sendSnapshot()
    startHeartbeat()
  }

  socket.onclose = () => {
    stopHeartbeat()
    socket = null
    scheduleReconnect()
  }

  socket.onerror = () => {
    // onclose will follow and drive the reconnect.
    try {
      socket && socket.close()
    } catch (e) {
      // ignore
    }
  }
}

// --- Tab/window event listeners: incremental state updates ---

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId)
    if (!tab || tab.windowId === undefined) return
    send({
      type: 'tab_activated',
      browser: browserName,
      profileId,
      windowId: tab.windowId,
      tabId: tab.id,
      url: isReportableUrl(tab.url) ? tab.url : null,
      title: tab.title || null,
      incognito: Boolean(tab.incognito)
    })
  } catch (e) {
    // tab gone; ignore
  }
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only the active tab, and only real URL/title changes.
  if (!tab || !tab.active) return
  if (changeInfo.url) {
    send({
      type: 'tab_url_changed',
      browser: browserName,
      profileId,
      windowId: tab.windowId,
      tabId,
      url: isReportableUrl(changeInfo.url) ? changeInfo.url : null,
      title: tab.title || null,
      incognito: Boolean(tab.incognito)
    })
  } else if (changeInfo.title) {
    send({
      type: 'tab_title_changed',
      browser: browserName,
      profileId,
      windowId: tab.windowId,
      tabId,
      title: changeInfo.title,
      incognito: Boolean(tab.incognito)
    })
  }
})

chrome.windows.onFocusChanged.addListener((windowId) => {
  // WINDOW_ID_NONE (-1) means the browser lost focus to another app; report
  // null so the desktop app doesn't attribute a URL when the browser isn't
  // foreground. The focus tracker is still the real authority on foreground.
  send({
    type: 'window_focus_changed',
    browser: browserName,
    profileId,
    focusedWindowId: windowId === chrome.windows.WINDOW_ID_NONE ? null : windowId
  })
})

chrome.windows.onRemoved.addListener((windowId) => {
  send({ type: 'window_removed', browser: browserName, profileId, windowId })
})

// --- Service-worker lifecycle / keepalive ---

chrome.runtime.onStartup.addListener(() => connect())
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.5 })
  connect()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    // Resurrection path: re-establish the socket if it died while suspended,
    // and refresh state so the desktop app never sits on stale data.
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      connect()
    } else {
      sendSnapshot()
    }
  }
})

// Re-read the token as soon as the user pastes it in the options page.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.focusbookToken) {
    authToken = changes.focusbookToken.newValue || null
    if (authToken) {
      reconnectDelay = RECONNECT_BASE_MS
      connect()
    }
  }
})

// Ensure the keepalive alarm exists even after a plain worker restart, then
// connect on load.
chrome.alarms.get(ALARM_NAME, (alarm) => {
  if (!alarm) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.5 })
  }
})
connect()
