import { useState } from 'react'
import { Sidebar } from './sidebar'
import { TitleBar } from './TitleBar'
import { useSidebar } from '../../context/SidebarContext'

export function MainLayout({ children }) {
  const { isCollapsed, isNarrow, overlayOpen, closeOverlay } = useSidebar()
  const [isLoading] = useState(false)

  return (
    <div className="min-h-screen flex flex-col relative transition-colors duration-300 overflow-hidden bg-fb-bg text-fb-text">
      {/* Subtle background texture — kept very light to match the calm reference look */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="subtle-grid absolute inset-0 opacity-40" />
        <div className="gradient-overlay absolute inset-0" />
      </div>

      {/* Content Layer — fb-screen-h (not h-screen) so it fills the full window
          despite the #root zoom, which shrinks a plain 100vh box (see main.css). */}
      <div className="relative z-10 fb-screen-h flex flex-col">
        {/* Custom Title Bar - Sticky at top */}
        <div className="sticky top-0 z-50">
          <TitleBar />
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-fb-bg/95 backdrop-blur-sm">
            <div className="flex flex-col items-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-fb-border rounded-full"></div>
                <div className="absolute inset-0 border-4 border-t-fb-accent border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
              </div>
              <div className="mt-4 text-fb-muted font-normal text-sm tracking-wide">
                Loading productivity data...
              </div>
            </div>
          </div>
        )}

        {/* Main content area - fills remaining height */}
        <div className="flex-1 flex min-h-0 relative">

          {/* DOCKED sidebar — only when the window is wide enough. On narrow
              windows the rail is removed entirely so content spans full width;
              the sidebar is reachable as an overlay drawer instead. */}
          {!isNarrow && (
            <div className={`
              flex flex-col flex-shrink-0
              transition-all duration-300 ease-in-out
              ${isCollapsed ? 'w-20' : 'w-60 xl:w-64'}
              overflow-y-auto custom-scrollbar
            `}>
              {/* flex-1 so the sidebar card stretches to the full content height */}
              <div className="flex-1 flex p-3 min-h-0">
                <Sidebar
                  collapsed={isCollapsed}
                  productivityScore={85}
                  dailyGoalProgress={68}
                  weeklyGoalProgress={72}
                />
              </div>
            </div>
          )}

          {/* OVERLAY drawer + backdrop — narrow windows only. The drawer slides
              in from the left over the content and is dismissed by tapping the
              backdrop, so it never squeezes the page. */}
          {isNarrow && (
            <>
              <div
                className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200
                  ${overlayOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={closeOverlay}
                aria-hidden="true"
              />
              <div
                className={`fixed left-0 top-10 bottom-0 z-40 w-64 max-w-[85vw] p-3
                  transition-transform duration-300 ease-in-out
                  ${overlayOpen ? 'translate-x-0' : '-translate-x-full'}`}
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
              >
                <div className="h-full flex">
                  <Sidebar
                    collapsed={false}
                    productivityScore={85}
                    dailyGoalProgress={68}
                    weeklyGoalProgress={72}
                    onNavigate={closeOverlay}
                  />
                </div>
              </div>
            </>
          )}

          <main className="flex-1 overflow-y-auto custom-scrollbar p-2 min-w-0">
            {/* Full-width wrapper — no `container`/max-width cap, so pages expand to
                fill the whole content area on wide screens instead of being clamped
                to a centered column. Individual pages own their own padding. */}
            <div className="w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
