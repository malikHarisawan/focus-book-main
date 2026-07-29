import { useState, useEffect } from 'react'
import { Minus, X, Maximize2, Minimize2, Menu } from 'lucide-react'
import { useSidebar } from '../../context/SidebarContext'

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)
  const { isNarrow, toggleSidebar } = useSidebar()

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
      className="h-10 flex items-center justify-between px-4 select-none transition-all bg-fb-surface border-b border-fb-border"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* App Title */}
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
        {/* Hamburger — only when the sidebar is in overlay mode (narrow window). */}
        {isNarrow && (
          <button
            onClick={toggleSidebar}
            className="h-8 w-8 flex items-center justify-center transition-all duration-200 text-fb-muted hover:text-fb-accent hover:bg-fb-surface2 rounded"
            title="Open menu"
            aria-label="Open navigation menu"
          >
            <Menu size={16} />
          </button>
        )}
        <span className="font-display text-sm font-semibold tracking-wide text-fb-accent">
          FocusBook
        </span>
      </div>

      {/* Window Controls */}
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={handleMinimize}
          className="h-8 w-10 flex items-center justify-center transition-all duration-200 text-fb-muted hover:text-fb-text hover:bg-fb-surface2 rounded"
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-8 w-10 flex items-center justify-center transition-all duration-200 text-fb-muted hover:text-fb-text hover:bg-fb-surface2 rounded"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button
          onClick={handleClose}
          className="h-8 w-10 flex items-center justify-center transition-all duration-200 text-fb-muted hover:text-white hover:bg-cat-distract rounded"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
