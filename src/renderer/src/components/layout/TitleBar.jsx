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
      className="h-8 flex items-center justify-between px-4 select-none backdrop-blur-md transition-all bg-white/80 border-b border-neon-cyan-500/30 dark:bg-black/80 dark:border-b dark:border-neon-cyan-500/20"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* App Title */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-heading font-bold tracking-widest uppercase text-neon-cyan-600 dark:text-neon-cyan-500 dark:neon-glow">
          FocusBook
        </span>
      </div>

      {/* Window Controls */}
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={handleMinimize}
          className="h-8 w-10 flex items-center justify-center transition-all duration-200 text-slate-600 hover:text-neon-cyan-600 hover:bg-neon-cyan-500/10 dark:text-slate-400 dark:hover:text-neon-cyan-500 dark:hover:bg-neon-cyan-500/10"
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-8 w-10 flex items-center justify-center transition-all duration-200 text-slate-600 hover:text-neon-cyan-600 hover:bg-neon-cyan-500/10 dark:text-slate-400 dark:hover:text-neon-cyan-500 dark:hover:bg-neon-cyan-500/10"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button
          onClick={handleClose}
          className="h-8 w-10 flex items-center justify-center transition-all duration-200 text-slate-600 hover:text-white hover:bg-neon-pink-500/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-neon-pink-600/80 dark:hover:neon-border-pink"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
