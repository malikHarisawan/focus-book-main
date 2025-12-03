import { useState, useEffect } from 'react'
import { Minus, Square, X, Maximize2, Minimize2 } from 'lucide-react'

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const checkMaximized = async () => {
      if (window.electronAPI) {
        const maximized = await window.electronAPI.isMaximized()
        setIsMaximized(maximized)
      }
    }
    checkMaximized()
  }, [])

  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.minimizeWindow()
    }
  }

  const handleMaximize = async () => {
    if (window.electronAPI) {
      window.electronAPI.maximizeWindow()
      // Update state after a short delay
      setTimeout(async () => {
        const maximized = await window.electronAPI.isMaximized()
        setIsMaximized(maximized)
      }, 100)
    }
  }

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.closeWindow()
    }
  }

  return (
    <div
      className="h-10 flex items-center justify-between px-4 select-none backdrop-blur-md transition-all bg-white/90 border-b border-meta-gray-200 dark:bg-dark-bg-secondary/90 dark:border-dark-border-primary"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* App Title */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tracking-wide text-meta-blue-600 dark:text-meta-blue-400">
          FocusBook
        </span>
      </div>

      {/* Window Controls */}
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={handleMinimize}
          className="h-8 w-10 flex items-center justify-center transition-all duration-200 text-meta-gray-500 hover:text-meta-gray-700 hover:bg-meta-gray-100 dark:text-meta-gray-400 dark:hover:text-meta-gray-200 dark:hover:bg-meta-gray-700 rounded"
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-8 w-10 flex items-center justify-center transition-all duration-200 text-meta-gray-500 hover:text-meta-gray-700 hover:bg-meta-gray-100 dark:text-meta-gray-400 dark:hover:text-meta-gray-200 dark:hover:bg-meta-gray-700 rounded"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button
          onClick={handleClose}
          className="h-8 w-10 flex items-center justify-center transition-all duration-200 text-meta-gray-500 hover:text-white hover:bg-meta-red-500 dark:text-meta-gray-400 dark:hover:text-white dark:hover:bg-meta-red-500 rounded"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
