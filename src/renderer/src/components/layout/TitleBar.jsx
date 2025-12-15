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
      className="h-10 flex items-center justify-between px-4 select-none backdrop-blur-md transition-all bg-white/90 border-b border-[#E8EDF1] dark:bg-[#212329]/90 dark:border-[#282932]"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* App Title */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tracking-wide text-[#5051F9]">
          FocusBook
        </span>
      </div>

      {/* Window Controls */}
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={handleMinimize}
          className="h-8 w-10 flex items-center justify-center transition-all duration-200 text-[#768396] hover:text-[#232360] hover:bg-[#F4F7FE] dark:text-[#898999] dark:hover:text-white dark:hover:bg-[#282932] rounded"
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-8 w-10 flex items-center justify-center transition-all duration-200 text-[#768396] hover:text-[#232360] hover:bg-[#F4F7FE] dark:text-[#898999] dark:hover:text-white dark:hover:bg-[#282932] rounded"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button
          onClick={handleClose}
          className="h-8 w-10 flex items-center justify-center transition-all duration-200 text-[#768396] hover:text-white hover:bg-[#FF6B6B] dark:text-[#898999] dark:hover:text-white dark:hover:bg-[#FF6B6B] rounded"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
