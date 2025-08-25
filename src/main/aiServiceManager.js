/**
 * AIServiceManager: manages the lifecycle of the local AI service process used by the Electron app.
 *
 * Responsibilities:
 * - Find an open TCP port and start the AI service on it
 * - Determine dev vs prod executable (Python venv vs bundled binary)
 * - Wire environment variables (FOCUSBOOK_DB_PATH, OPENAI_API_KEY)
 * - Probe health (/docs) and auto-restart on crashes or failed health checks
 * - Expose a small HTTP client for /chat requests
 *
 * Notes:
 * - Development mode assumes a Windows-style venv at AI_agent/venv/Scripts/python.exe
 * - Production mode loads the packaged executable from process.resourcesPath/ai_service
 * - Health checks run every 30s and can trigger a soft restart with limited retries
 */
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const { app } = require('electron')
const net = require('net')

/**
 * @typedef {Object} ServiceStatus
 * @property {boolean} isRunning - Whether the service process is considered running.
 * @property {number|null} port - The TCP port the service is bound to, if running.
 * @property {number} retryCount - Number of auto-restart attempts performed.
 */

class AIServiceManager {
  /**
   * Construct a new AIServiceManager.
   * Initializes state for process tracking, ports, retries, and health check timer.
   */
  constructor() {
    this.process = null
    this.port = null
    this.isStarting = false
    this.isRunning = false
    this.retryCount = 0
    this.maxRetries = 3
    this.healthCheckInterval = null
  }

  /**
   * Find an available port for the AI service
   * @param {number} [startPort=8000] - Preferred starting port; will scan upward.
   * @returns {Promise<number>} Resolves with a free port number.
   * @throws If no port is available in the scan window.
   */
  async findAvailablePort(startPort = 8000) {
    const maxAttempts = 10
    for (let i = 0; i < maxAttempts; i++) {
      const testPort = startPort + i
      const isAvailable = await this.isPortAvailable(testPort)
      if (isAvailable) {
        console.log(`Found available port: ${testPort}`)
        return testPort
      }
    }
    throw new Error(`No available ports found in range ${startPort}-${startPort + maxAttempts - 1}`)
  }

  /**
   * Test whether a port can be bound locally.
   * @param {number} port - The port to probe.
   * @returns {Promise<boolean>} True if the port can be bound; otherwise false.
   */
  async isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer()
      
      server.listen(port, () => {
        server.close(() => resolve(true))
      })
      
      server.on('error', () => resolve(false))
    })
  }

  /**
   * Get the path to the AI service executable
   *
   * Development:
   * - Uses Python from venv at AI_agent/venv/Scripts/python.exe and runs start_service.py
   *
   * Production:
   * - Uses packaged executable under process.resourcesPath/ai_service
   *
   * @returns {{ command: string, args: string[] }} Executable command and argv.
   */
  getServiceExecutablePath() {
    const isDev = process.env.NODE_ENV === 'development'
    
    if (isDev) {
      // In development, use virtual environment Python
      const venvPython = path.join(__dirname, '../../AI_agent/venv/Scripts/python.exe')
      
      return {
        command: venvPython,
        args: [path.join(__dirname, '../../AI_agent/start_service.py')]
      }
    } else {
      // In production, use the bundled executable
      const platform = process.platform
      let executableName = 'ai_service'
      
      if (platform === 'win32') {
        executableName += '.exe'
      }
      
      return {
        command: path.join(process.resourcesPath, 'ai_service', executableName),
        args: []
      }
    }
  }

  /**
   * Get the database path for the AI service
   * @returns {string} Absolute path to the Electron userData SQLite database file.
   */
  getDatabasePath() {
    const userDataPath = app.getPath('userData')
    return path.join(userDataPath, 'focusbook.db')
  }

  /**
   * Start the AI service
   * - Allocates a port, spawns the process, and performs initial health checks.
   * - Sets OPENAI_API_KEY in the environment if provided or available in process.env.
   *
   * Concurrency safety: if a start is in progress, waits until it completes and returns the port.
   *
   * @param {string|null} [apiKey=null] - Optional API key to pass to the service; falls back to env.
   * @returns {Promise<number>} Resolves with the port the service is (or will be) listening on.
   * @throws If startup fails before spawning or port allocation fails.
   */
  async start(apiKey = null) {
    if (this.isStarting) {
      console.log('AI service is already starting, waiting...')
      // Wait for the current startup to complete
      while (this.isStarting) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      return this.port
    }

    if (this.isRunning) {
      console.log('AI service is already running on port', this.port)
      return this.port
    }

    this.isStarting = true

    try {
      // Find an available port
      this.port = await this.findAvailablePort()
      
      // Get service executable info
      const { command, args } = this.getServiceExecutablePath()
      
      // Prepare arguments
      const dbPath = this.getDatabasePath()
      const effectiveApiKey = apiKey || process.env.OPENAI_API_KEY || ''
      const serviceArgs = [
        ...args,
        dbPath,
        // Only pass API key if it's not empty (let .env file handle it)
        effectiveApiKey.trim() ? effectiveApiKey : '',
        this.port.toString()
      ]

      console.log(`Starting AI service on port ${this.port}`)
      console.log(`Command: ${command}`)
      console.log(`Args: ${serviceArgs.join(' ')}`)

      // Spawn the process
      this.process = spawn(command, serviceArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          FOCUSBOOK_DB_PATH: dbPath,
          OPENAI_API_KEY: apiKey || process.env.OPENAI_API_KEY || ''
        }
      })

      // Handle process events
      this.process.on('spawn', () => {
        console.log('AI service process spawned successfully')
        // Don't mark as running yet - wait for full startup
      })

      this.process.on('error', (error) => {
        console.error('AI service process error:', error)
        this.isStarting = false
        this.isRunning = false
        this.handleProcessExit()
      })

      this.process.on('exit', (code, signal) => {
        console.log(`AI service process exited with code ${code}, signal ${signal}`)
        this.isStarting = false
        this.isRunning = false
        
        // If exit code is not 0, there was an error
        if (code !== 0) {
          console.error(`AI service failed with exit code ${code}`)
        }
        
        this.handleProcessExit()
      })

      // Log output for debugging
      this.process.stdout.on('data', (data) => {
        console.log(`AI service stdout: ${data}`)
      })

      this.process.stderr.on('data', (data) => {
        const output = data.toString()
        console.log(`AI service stderr: ${output}`)
        
        // Check for specific error patterns
        if (output.includes('EADDRINUSE') || output.includes('address already in use')) {
          console.error('⚠️ Port conflict detected - AI service cannot bind to port')
        }
        if (output.includes('ModuleNotFoundError') || output.includes('ImportError')) {
          console.error('⚠️ Python dependency missing - check virtual environment')
        }
        if (output.includes('AuthenticationError') || output.includes('API key')) {
          console.error('⚠️ OpenAI API key issue detected')
        }
      })

      // Wait longer for the service to fully start (MCP setup takes time)
      await new Promise(resolve => setTimeout(resolve, 8000))
      
      // Try health check multiple times
      let isHealthy = false
      for (let i = 0; i < 5; i++) {
        isHealthy = await this.checkHealth()
        if (isHealthy) break
        console.log(`Health check attempt ${i + 1}/5 failed, retrying...`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      
      // Mark service as running regardless of health check
      // The periodic health checks will monitor actual status
      this.isStarting = false
      this.isRunning = true
      this.retryCount = 0
      
      // Start health checks
      this.startHealthCheck()
      
      if (isHealthy) {
        console.log('✅ AI service is healthy and ready')
      } else {
        console.warn('⚠️ AI service health check failed, but service appears to be starting...')
      }

      return this.port

    } catch (error) {
      console.error('Failed to start AI service:', error)
      this.isStarting = false
      this.isRunning = false
      throw error
    }
  }

  /**
   * Stop the AI service
  * Attempts graceful termination (SIGTERM), then force-kills after a timeout.
  * Clears periodic health checks and resets internal state.
  * @returns {Promise<void>} Resolves when stop logic completes (not necessarily process exit).
   */
  async stop() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }

    if (this.process && !this.process.killed) {
      console.log('Stopping AI service...')
      
      // Try graceful shutdown first
      this.process.kill('SIGTERM')
      
      // Force kill after timeout
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          console.log('Force killing AI service process')
          this.process.kill('SIGKILL')
        }
      }, 5000)

      this.process = null
    }

    this.isRunning = false
    this.port = null
  }

  /**
   * Check if the AI service is healthy
  * Performs a GET /docs against the local service with a short timeout.
  * @returns {Promise<boolean>} True when HTTP 200 is returned; false otherwise.
   */
  async checkHealth() {
    if (!this.port) return false

    return new Promise((resolve) => {
      const http = require('http')
      const req = http.request({
        hostname: '127.0.0.1',
        port: this.port,
        path: '/docs',
        method: 'GET',
        timeout: 2000
      }, (res) => {
        resolve(res.statusCode === 200)
      })

      req.on('error', () => resolve(false))
      req.on('timeout', () => {
        req.destroy()
        resolve(false)
      })
      
      req.end()
    })
  }

  /**
   * Start periodic health checks
  * Schedules a 30s interval to probe health; on failure, triggers restart handling.
   */
  startHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      const isHealthy = await this.checkHealth()
      if (!isHealthy && this.isRunning) {
        console.warn('AI service health check failed')
        this.handleProcessExit()
      }
    }, 30000) // Check every 30 seconds
  }

  /**
   * Handle process exit and potential restart
  * Clears health checks and auto-restarts up to maxRetries unless the app is quitting.
   */
  handleProcessExit() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }

    // Auto-restart if we haven't exceeded retry limit
    if (this.retryCount < this.maxRetries && !app.isQuiting) {
      this.retryCount++
      console.log(`Attempting to restart AI service (attempt ${this.retryCount}/${this.maxRetries})`)
      
      setTimeout(() => {
        this.start().catch(error => {
          console.error('Failed to restart AI service:', error)
        })
      }, 5000) // Wait 5 seconds before restart
    }
  }

  /**
   * Get the current service status
  * @returns {ServiceStatus} Snapshot of the manager's current state.
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      retryCount: this.retryCount
    }
  }

  /**
   * Send a chat message to the AI service
  * Performs an HTTP POST /chat with JSON body { message } and 30s timeout.
  * @param {string} message - The user message to send to the AI service.
  * @returns {Promise<any>} Resolves with the parsed JSON response from the service.
  * @throws If the service isn't running, if the request fails, times out, or if parsing fails.
   */
  async sendMessage(message) {
    if (!this.isRunning || !this.port) {
      throw new Error('AI service is not running')
    }

    return new Promise((resolve, reject) => {
      const http = require('http')
      const data = JSON.stringify({ message })

      const options = {
        hostname: '127.0.0.1',
        port: this.port,
        path: '/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        },
        timeout: 30000 // 30 second timeout for AI responses
      }

      const req = http.request(options, (res) => {
        let responseData = ''

        res.on('data', (chunk) => {
          responseData += chunk
        })

        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
              return
            }

            const jsonResponse = JSON.parse(responseData)
            resolve(jsonResponse)
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`))
          }
        })
      })

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`))
      })

      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Request timeout'))
      })

      req.write(data)
      req.end()
    })
  }

  async resetMemory() {
    if (!this.isRunning || !this.port) {
      throw new Error('AI service is not running')
    }

    return new Promise((resolve, reject) => {
      const http = require('http')

      const options = {
        hostname: '127.0.0.1',
        port: this.port,
        path: '/reset',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout for reset
      }

      const req = http.request(options, (res) => {
        let responseData = ''

        res.on('data', (chunk) => {
          responseData += chunk
        })

        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
              return
            }

            const jsonResponse = JSON.parse(responseData)
            resolve(jsonResponse)
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`))
          }
        })
      })

      req.on('error', (error) => {
        reject(new Error(`Reset request failed: ${error.message}`))
      })

      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Reset request timeout'))
      })

      req.end()
    })
  } 

/**
   * Reset the AI service conversation memory
   */
  async resetMemory() {
    if (!this.isRunning || !this.port) {
      throw new Error('AI service is not running')
    }

    return new Promise((resolve, reject) => {
      const http = require('http')

      const options = {
        hostname: '127.0.0.1',
        port: this.port,
        path: '/reset',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout for reset
      }

      const req = http.request(options, (res) => {
        let responseData = ''

        res.on('data', (chunk) => {
          responseData += chunk
        })

        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
              return
            }

            const jsonResponse = JSON.parse(responseData)
            resolve(jsonResponse)
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`))
          }
        })
      })

      req.on('error', (error) => {
        reject(new Error(`Reset request failed: ${error.message}`))
      })

      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Reset request timeout'))
      })

      req.end()
    })
  }
}

module.exports = AIServiceManager