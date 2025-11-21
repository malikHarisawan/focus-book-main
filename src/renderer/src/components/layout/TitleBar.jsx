import { useState, useEffect } from 'react'
import { Minus, Square, X, Maximize2, Minimize2 } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

export function TitleBar() {
  const { theme } = useTheme()
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
      className={`h-8 flex items-center justify-between px-4 select-none ${
        theme === 'dark'
          ? 'bg-slate-900/95 border-b border-slate-800/50'
          : 'bg-white/95 border-b border-gray-200'
      }`}
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* App Title */}
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>
          FocusBook
        </span>
      </div>

      {/* Window Controls */}
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={handleMinimize}
          className={`h-8 w-10 flex items-center justify-center transition-colors ${
            theme === 'dark'
              ? 'hover:bg-slate-700/50 text-slate-400 hover:text-slate-200'
              : 'hover:bg-gray-100 text-slate-600 hover:text-slate-900'
          }`}
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className={`h-8 w-10 flex items-center justify-center transition-colors ${
            theme === 'dark'
              ? 'hover:bg-slate-700/50 text-slate-400 hover:text-slate-200'
              : 'hover:bg-gray-100 text-slate-600 hover:text-slate-900'
          }`}
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button
          onClick={handleClose}
          className={`h-8 w-10 flex items-center justify-center transition-colors ${
            theme === 'dark'
              ? 'hover:bg-red-600 text-slate-400 hover:text-white'
              : 'hover:bg-red-500 text-slate-600 hover:text-white'
          }`}
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
