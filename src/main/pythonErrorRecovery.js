/**
 * Python Error Recovery System
 * 
 * This module provides graceful fallback mechanisms when Python scripts fail.
 * It handles common scenarios like missing Python installation, missing dependencies,
 * or script execution failures.
 */

const { spawn, exec } = require('child_process')
const fs = require('fs')
const path = require('path')

class PythonErrorRecovery {
  constructor() {
    this.pythonAvailable = null
    this.dependenciesChecked = false
    this.fallbackMode = false
    this.errorStats = {
      pythonErrors: 0,
      scriptErrors: 0,
      timeouts: 0
    }
  }

  /**
   * Check if Python is available on the system
   */
  async checkPythonAvailability() {
    if (this.pythonAvailable !== null) {
      return this.pythonAvailable
    }

    return new Promise((resolve) => {
      const pythonProcess = spawn('python', ['--version'])
      
      pythonProcess.on('error', () => {
        console.warn('Python not found in PATH, enabling fallback mode')
        this.pythonAvailable = false
        this.fallbackMode = true
        resolve(false)
      })

      pythonProcess.on('close', (code) => {
        this.pythonAvailable = code === 0
        if (!this.pythonAvailable) {
          console.warn('Python version check failed, enabling fallback mode')
          this.fallbackMode = true
        }
        resolve(this.pythonAvailable)
      })

      // Timeout after 3 seconds
      setTimeout(() => {
        pythonProcess.kill()
        this.pythonAvailable = false
        this.fallbackMode = true
        resolve(false)
      }, 3000)
    })
  }

  /**
   * Check if required Python dependencies are installed
   */
  async checkPythonDependencies() {
    if (this.dependenciesChecked || this.fallbackMode) {
      return !this.fallbackMode
    }

    const isAvailable = await this.checkPythonAvailability()
    if (!isAvailable) return false

    return new Promise((resolve) => {
      const checkProcess = spawn('python', ['-c', 'import pywinauto; print("OK")'])
      
      checkProcess.on('error', () => {
        console.warn('Failed to check Python dependencies')
        this.fallbackMode = true
        this.dependenciesChecked = true
        resolve(false)
      })

      checkProcess.on('close', (code) => {
        if (code === 0) {
          console.log('Python dependencies are available')
          this.dependenciesChecked = true
          resolve(true)
        } else {
          console.warn('Python dependencies (pywinauto) not found, enabling fallback mode')
          this.fallbackMode = true
          this.dependenciesChecked = true
          resolve(false)
        }
      })

      // Timeout after 5 seconds
      setTimeout(() => {
        checkProcess.kill()
        this.fallbackMode = true
        this.dependenciesChecked = true
        resolve(false)
      }, 5000)
    })
  }

  /**
   * Safe execution of Python scripts with error recovery
   */
  async executePythonScript(scriptPath, args = [], options = {}) {
    const {
      timeout = 10000,
      fallbackValue = null,
      retryCount = 1
    } = options

    // Check if we should even attempt Python execution
    if (this.fallbackMode) {
      console.log('Python fallback mode active, returning fallback value')
      return fallbackValue
    }

    // Check if script exists
    if (!fs.existsSync(scriptPath)) {
      console.warn(`Python script not found: ${scriptPath}`)
      this.fallbackMode = true
      return fallbackValue
    }

    // Attempt execution with retries
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        const result = await this._executePythonProcess(scriptPath, args, timeout)
        return result
      } catch (error) {
        console.warn(`Python script execution attempt ${attempt} failed:`, error.message)
        this.errorStats.scriptErrors++
        
        if (attempt === retryCount) {
          // Final attempt failed, enable fallback mode for future calls
          if (this.errorStats.scriptErrors >= 3) {
            console.warn('Multiple Python script failures detected, enabling fallback mode')
            this.fallbackMode = true
          }
          return fallbackValue
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return fallbackValue
  }

  /**
   * Internal method to execute Python process
   */
  _executePythonProcess(scriptPath, args, timeout) {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', [scriptPath, ...args])
      
      let output = ''
      let error = ''
      let isResolved = false

      // Set timeout
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true
          pythonProcess.kill('SIGKILL')
          this.errorStats.timeouts++
          reject(new Error('Python script timeout'))
        }
      }, timeout)

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString()
      })

      pythonProcess.stderr.on('data', (data) => {
        error += data.toString()
      })

      pythonProcess.on('error', (err) => {
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeoutId)
          this.errorStats.pythonErrors++
          reject(new Error(`Python process error: ${err.message}`))
        }
      })

      pythonProcess.on('close', (code) => {
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeoutId)
          
          if (code === 0) {
            resolve(output)
          } else {
            reject(new Error(`Python script exited with code ${code}: ${error}`))
          }
        }
      })
    })
  }

  /**
   * Get fallback browser detection when Python scripts fail
   */
  getBrowserFallback(processName) {
    const browserMap = {
      'chrome.exe': { url: 'Chrome Browser', title: 'Chrome Tab' },
      'brave.exe': { url: 'Brave Browser', title: 'Brave Tab' },
      'firefox.exe': { url: 'Firefox Browser', title: 'Firefox Tab' },
      'msedge.exe': { url: 'Edge Browser', title: 'Edge Tab' },
      'opera.exe': { url: 'Opera Browser', title: 'Opera Tab' }
    }

    return browserMap[processName?.toLowerCase()] || { url: 'Browser Tab', title: 'Browser Tab' }
  }

  /**
   * Reset error recovery state (useful for testing or manual recovery)
   */
  reset() {
    this.pythonAvailable = null
    this.dependenciesChecked = false
    this.fallbackMode = false
    this.errorStats = {
      pythonErrors: 0,
      scriptErrors: 0,
      timeouts: 0
    }
    console.log('Python error recovery system reset')
  }

  /**
   * Get current status and statistics
   */
  getStatus() {
    return {
      pythonAvailable: this.pythonAvailable,
      dependenciesChecked: this.dependenciesChecked,
      fallbackMode: this.fallbackMode,
      errorStats: { ...this.errorStats }
    }
  }

  /**
   * Manual override to enable/disable fallback mode
   */
  setFallbackMode(enabled) {
    this.fallbackMode = enabled
    console.log(`Python fallback mode ${enabled ? 'enabled' : 'disabled'} manually`)
  }
}

module.exports = PythonErrorRecovery