import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const SidebarContext = createContext()

// Width at/below which the sidebar stops docking and becomes a temporary overlay
// (opened via the hamburger). Above it, the sidebar docks normally. Kept in sync
// with the point where the dashboard's multi-column layout starts to feel tight.
const NARROW_BREAKPOINT = 900

export function SidebarProvider({ children }) {
  // Is the viewport narrow enough that the sidebar should overlay rather than dock?
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= NARROW_BREAKPOINT : false
  )

  // User's explicit docked-collapse preference (icon rail vs full), used only when
  // NOT narrow. Persisted so it survives reloads.
  const [userCollapsed, setUserCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebarCollapsed')
      if (saved !== null) return saved === 'true'
      return window.innerWidth <= 1024
    }
    return true
  })

  // Whether the overlay drawer is currently open (only meaningful when narrow).
  const [overlayOpen, setOverlayOpen] = useState(false)

  // Track viewport width so the layout can switch between docked and overlay modes
  // live as the window is resized.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => {
      const narrow = window.innerWidth <= NARROW_BREAKPOINT
      setIsNarrow(narrow)
      // Leaving narrow mode closes any open drawer so it can't linger docked.
      if (!narrow) setOverlayOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarCollapsed', userCollapsed)
    }
  }, [userCollapsed])

  // When narrow, the docked rail is hidden entirely (content goes full-width) and
  // the sidebar only appears as an overlay. `isCollapsed` (icon-rail form) applies
  // to the docked sidebar only.
  const isCollapsed = isNarrow ? false : userCollapsed

  const toggleSidebar = useCallback(() => {
    if (isNarrow) {
      // In narrow mode the toggle opens/closes the overlay drawer.
      setOverlayOpen((o) => !o)
    } else {
      setUserCollapsed((c) => !c)
    }
  }, [isNarrow])

  const openOverlay = useCallback(() => setOverlayOpen(true), [])
  const closeOverlay = useCallback(() => setOverlayOpen(false), [])

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        toggleSidebar,
        setIsCollapsed: setUserCollapsed,
        isNarrow,
        overlayOpen,
        openOverlay,
        closeOverlay
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export const useSidebar = () => {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}
