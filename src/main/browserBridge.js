/**
 * Browser Bridge - WebSocket server for the FocusBook browser extension
 *
 * Replaces the pywinauto/get_active_url.py subprocess as the URL source for
 * Chromium browsers (Chrome, Brave, Edge). The extension pushes active-tab
 * state over an authenticated local WebSocket; this module only maintains
 * that state (BrowserState) and answers point-in-time queries from the
 * tracking seam ("what URL is the foreground browser window on?").
 *
 * Health model: this module is intentionally independent of
 * pythonErrorRecovery.js. There are no failure counters and no latch — a
 * dead connection simply degrades resolution to title-only until the
 * extension reconnects and re-sends a snapshot.
 *
 * Hard rule: extension messages mutate BrowserState and nothing else. This
 * module never creates, opens, or closes usage spans; the focus tracker in
 * the preload remains the sole authority on when time is spent.
 */

const { WebSocketServer } = require('ws')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

// Extension tries these same ports in order; keep the two lists in sync
// with extension/background.js.
const PORTS = [17650, 17651, 17652]

// Extension sends a heartbeat every 10s. A connection that has been silent
// for 2x that interval is considered dead and is ignored by resolve().
const HEARTBEAT_INTERVAL_MS = 10000
const DEAD_AFTER_MS = HEARTBEAT_INTERVAL_MS * 2

// A socket that has not authenticated (valid hello) within this window is closed.
const HELLO_TIMEOUT_MS = 5000

// Maps the exe name reported by the focus tracker to the browser name the
// extension reports in hello.
const EXE_TO_BROWSER = {
  'chrome.exe': 'chrome',
  'brave.exe': 'brave',
  'msedge.exe': 'edge'
}

class BrowserBridge {
  constructor(userDataPath) {
    this.configPath = path.join(userDataPath, 'browser-bridge.json')
    this.config = this._loadConfig()
    this.server = null
    this.port = null
    // key `${browser}:${profileId}` -> connection record
    this.connections = new Map()
  }

  _loadConfig() {
    let config = {}
    try {
      if (fs.existsSync(this.configPath)) {
        config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'))
      }
    } catch (error) {
      console.warn('BrowserBridge: could not read config, regenerating:', error.message)
      config = {}
    }

    let dirty = false
    if (!config.token || typeof config.token !== 'string' || config.token.length < 32) {
      config.token = crypto.randomBytes(32).toString('hex')
      dirty = true
    }
    if (dirty) {
      this._saveConfig(config)
    }
    return config
  }

  _saveConfig(config) {
    try {
      fs.mkdirSync(path.dirname(this.configPath), { recursive: true })
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2))
    } catch (error) {
      console.error('BrowserBridge: failed to persist config:', error.message)
    }
  }

  async start() {
    for (const port of PORTS) {
      try {
        await this._listen(port)
        this.port = port
        console.log(`BrowserBridge: listening on ws://127.0.0.1:${port}`)
        return true
      } catch (error) {
        if (error.code === 'EADDRINUSE') {
          console.warn(`BrowserBridge: port ${port} in use, trying next`)
          continue
        }
        console.error('BrowserBridge: failed to start:', error.message)
        return false
      }
    }
    console.error('BrowserBridge: all candidate ports in use, extension URLs unavailable')
    return false
  }

  _listen(port) {
    return new Promise((resolve, reject) => {
      const server = new WebSocketServer({ host: '127.0.0.1', port })
      server.once('listening', () => {
        server.removeListener('error', reject)
        server.on('error', (err) => console.error('BrowserBridge server error:', err.message))
        server.on('connection', (socket) => this._onConnection(socket))
        this.server = server
        resolve()
      })
      server.once('error', reject)
    })
  }

  stop() {
    for (const conn of this.connections.values()) {
      try {
        conn.socket.terminate()
      } catch {
        // already closed
      }
    }
    this.connections.clear()
    if (this.server) {
      this.server.close()
      this.server = null
    }
  }

  _onConnection(socket) {
    let conn = null

    const helloTimer = setTimeout(() => {
      if (!conn) {
        console.warn('BrowserBridge: closing socket that never authenticated')
        socket.terminate()
      }
    }, HELLO_TIMEOUT_MS)

    socket.on('message', (raw) => {
      let msg
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }
      if (!msg || typeof msg.type !== 'string') {
        return
      }

      if (!conn) {
        // First message must be an authenticated hello.
        if (msg.type !== 'hello' || !this._tokenMatches(msg.token)) {
          console.warn('BrowserBridge: rejecting socket (bad hello or token)')
          clearTimeout(helloTimer)
          socket.close(4001, 'unauthorized')
          return
        }
        conn = this._registerConnection(socket, msg)
        clearTimeout(helloTimer)
        return
      }

      // Cheap re-check: every message carries the token; drop forged frames.
      if (!this._tokenMatches(msg.token)) {
        return
      }
      conn.lastHeartbeatAt = Date.now()
      this._applyMessage(conn, msg)
    })

    socket.on('close', () => {
      clearTimeout(helloTimer)
      if (conn && this.connections.get(conn.key) === conn) {
        this.connections.delete(conn.key)
        console.log(`BrowserBridge: ${conn.key} disconnected`)
      }
    })

    socket.on('error', (err) => {
      console.warn('BrowserBridge socket error:', err.message)
    })
  }

  _tokenMatches(token) {
    if (typeof token !== 'string') return false
    const expected = Buffer.from(this.config.token)
    const received = Buffer.from(token)
    if (expected.length !== received.length) return false
    return crypto.timingSafeEqual(expected, received)
  }

  _registerConnection(socket, hello) {
    const browser = typeof hello.browser === 'string' ? hello.browser : 'chrome'
    const profileId = typeof hello.profileId === 'string' ? hello.profileId : 'default'
    const key = `${browser}:${profileId}`

    // A reconnect replaces any stale connection for the same profile.
    const existing = this.connections.get(key)
    if (existing) {
      try {
        existing.socket.terminate()
      } catch {
        // already closed
      }
    }

    const conn = {
      key,
      browser,
      profileId,
      socket,
      // windowId -> { activeTabId, url, title, incognito }
      windows: new Map(),
      focusedWindowId: null,
      lastHeartbeatAt: Date.now()
    }
    this.connections.set(key, conn)
    console.log(`BrowserBridge: ${key} connected`)
    return conn
  }

  /**
   * Apply a state message to the connection's BrowserState. State mutation
   * only — nothing here may touch spans, attribution, or persistence.
   */
  _applyMessage(conn, msg) {
    switch (msg.type) {
      case 'snapshot': {
        conn.windows = new Map()
        if (Array.isArray(msg.windows)) {
          for (const win of msg.windows) {
            if (typeof win.windowId !== 'number') continue
            conn.windows.set(win.windowId, {
              activeTabId: win.activeTabId ?? null,
              url: typeof win.url === 'string' ? win.url : null,
              title: typeof win.title === 'string' ? win.title : null,
              incognito: Boolean(win.incognito)
            })
          }
        }
        conn.focusedWindowId = typeof msg.focusedWindowId === 'number' ? msg.focusedWindowId : null
        break
      }
      case 'tab_activated':
      case 'tab_url_changed':
      case 'tab_title_changed': {
        if (typeof msg.windowId !== 'number') break
        const entry = conn.windows.get(msg.windowId) || {
          activeTabId: null,
          url: null,
          title: null,
          incognito: false
        }
        if (msg.tabId !== undefined) entry.activeTabId = msg.tabId
        if (typeof msg.url === 'string') entry.url = msg.url
        if (typeof msg.title === 'string') entry.title = msg.title
        if (msg.incognito !== undefined) entry.incognito = Boolean(msg.incognito)
        conn.windows.set(msg.windowId, entry)
        break
      }
      case 'window_focus_changed': {
        conn.focusedWindowId = typeof msg.focusedWindowId === 'number' ? msg.focusedWindowId : null
        break
      }
      case 'window_removed': {
        if (typeof msg.windowId === 'number') {
          conn.windows.delete(msg.windowId)
          if (conn.focusedWindowId === msg.windowId) {
            conn.focusedWindowId = null
          }
        }
        break
      }
      case 'heartbeat':
        // lastHeartbeatAt already bumped for every message
        break
      default:
        break
    }
  }

  _isAlive(conn) {
    return (
      conn.socket.readyState === conn.socket.OPEN &&
      Date.now() - conn.lastHeartbeatAt < DEAD_AFTER_MS
    )
  }

  /**
   * Resolve the URL for the OS-foreground browser window. Called from the
   * tracking seam ONLY when the focus tracker has already confirmed a
   * Chromium browser is foreground — this module never decides *when* time
   * is attributed, only *what* the browser was showing.
   *
   * Returns one of:
   *  { source: 'extension', url, domain, title, browser }  - live state for the focused window
   *  { source: 'private' }                                 - live connection, but the focused window is not
   *                                                          in BrowserState (incognito/PWA); never guess a URL
   *  { source: 'degraded' }                                - no live/matching connection; caller falls back
   *                                                          to title-only attribution
   */
  resolve({ exe, title }) {
    const browser = EXE_TO_BROWSER[String(exe || '').toLowerCase()]
    if (!browser) {
      return { source: 'degraded' }
    }

    const candidates = []
    for (const conn of this.connections.values()) {
      if (conn.browser === browser && this._isAlive(conn)) {
        candidates.push(conn)
      }
    }
    if (candidates.length === 0) {
      return { source: 'degraded' }
    }

    // Multiple profiles of the same browser can be connected at once. Pick
    // the connection whose focused-window tab title matches the OS window
    // title; with a single candidate, trust its focused window (tab titles
    // can briefly lag the OS title during navigation).
    let chosen = null
    if (candidates.length === 1) {
      chosen = candidates[0]
    } else {
      chosen = candidates.find((conn) => {
        const entry = conn.focusedWindowId !== null ? conn.windows.get(conn.focusedWindowId) : null
        return entry && this._titleMatches(entry.title, title)
      })
      // No title match: only safe if exactly one candidate believes it owns
      // OS focus (focusedWindowId set). Otherwise we cannot tell profiles
      // apart and must not guess a URL.
      if (!chosen) {
        const focusedCandidates = candidates.filter((c) => c.focusedWindowId !== null)
        if (focusedCandidates.length === 1) {
          chosen = focusedCandidates[0]
        }
      }
      if (!chosen) {
        return { source: 'degraded' }
      }
    }

    // Connection is live but reports no focused window (or one we have no
    // entry for): the OS-foreground browser window is invisible to the
    // extension — incognito without extension access, or a PWA shell.
    const entry = chosen.focusedWindowId !== null ? chosen.windows.get(chosen.focusedWindowId) : null
    if (!entry || !entry.url) {
      return { source: 'private' }
    }

    return {
      source: 'extension',
      url: entry.url,
      domain: this._hostnameOf(entry.url),
      title: entry.title,
      browser: chosen.browser
    }
  }

  _titleMatches(tabTitle, osTitle) {
    if (!tabTitle || !osTitle) return false
    const os = String(osTitle).toLowerCase()
    const tab = String(tabTitle).toLowerCase()
    // OS titles look like "<tab title> - Google Chrome"; compare on prefix.
    return os.startsWith(tab)
  }

  _hostnameOf(url) {
    try {
      return new URL(url).hostname || null
    } catch {
      return null
    }
  }

  getStatus() {
    return {
      running: this.server !== null,
      port: this.port,
      token: this.config.token,
      connections: Array.from(this.connections.values()).map((conn) => ({
        browser: conn.browser,
        profileId: conn.profileId,
        alive: this._isAlive(conn),
        windows: conn.windows.size,
        focusedWindowId: conn.focusedWindowId,
        lastHeartbeatAt: conn.lastHeartbeatAt
      }))
    }
  }
}

module.exports = BrowserBridge
