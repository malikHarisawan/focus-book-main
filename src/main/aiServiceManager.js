const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const { app } = require('electron')
const net = require('net')

class AIServiceManager {
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
   */
  getServiceExecutablePath() {
    const isDev = process.env.NODE_ENV === 'development'
    
    if (isDev) {
      // In development, use virtual environment Python
      const venvPython = path.join(__dirname, '../../AI_agent/ai_env/Scripts/python.exe')
      
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
   */
  getDatabasePath() {
    const userDataPath = app.getPath('userData')
    return path.join(userDataPath, 'appUsage.db')
  }

  /**
   * Start the AI service
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
}

module.exports = AIServiceManager