'use client'

import { useLocation } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Activity, Command, Hexagon, Settings, Timer, Play, Pause, MessageSquare } from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent } from '..//ui/card'
import { StatusItem } from '../Dashboard/status-item'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { useEffect, useState } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { useSidebar } from '../../context/SidebarContext'
import { Menu, ChevronLeft } from 'lucide-react'

export function Sidebar({ productivityScore, dailyGoalProgress, weeklyGoalProgress, collapsed = false }) {
  const location = useLocation()
  const pathname = location.pathname
  const { resolvedTheme } = useTheme()
  const { toggleSidebar } = useSidebar()
  const [currentSession, setCurrentSession] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [isStarting, setIsStarting] = useState(false)

  // Theme-aware colors
  const statusColors = {
    active: resolvedTheme === 'dark' ? 'rgba(49, 162, 76, 0.6)' : 'rgba(49, 162, 76, 0.5)',
    paused: resolvedTheme === 'dark' ? 'rgba(245, 166, 35, 0.6)' : 'rgba(245, 166, 35, 0.5)',
  }

  const loadCurrentSession = async () => {
    try {
      if (window.electronAPI) {
        const session = await window.electronAPI.getCurrentFocusSession()
        setCurrentSession(session)
        return session
      }
    } catch (error) {
      console.error('Error loading current session:', error)
      return null
    }
  }

  const updateTimeLeft = (session) => {
    if (session && (session.startTime || session.start_time) && (session.plannedDuration || session.planned_duration)) {
      const now = Date.now()
      const startTime = new Date(session.startTime || session.start_time).getTime()
      const plannedDuration = session.plannedDuration || session.planned_duration
      const pausedDuration = session.pausedDuration || session.paused_duration || 0
      
      // Calculate elapsed time excluding paused periods
      const elapsed = (now - startTime) - pausedDuration
      const remaining = plannedDuration - elapsed
      const timeLeftSeconds = Math.max(0, Math.floor(remaining / 1000))
      
      setTimeLeft(timeLeftSeconds)
    } else {
      setTimeLeft(0)
    }
  }

  useEffect(() => {
    loadCurrentSession()
    
    const interval = setInterval(async () => {
      const session = await loadCurrentSession()
      if (session && session.status === 'active') {
        updateTimeLeft(session)
      } else if (session && session.status === 'paused') {
        // Don't update time when paused - keep the current timeLeft
        // Just update the session state for UI display
        setCurrentSession(session)
      } else {
        setTimeLeft(0)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, []) // Remove currentSession dependency to prevent infinite loops

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const startQuickFocusSession = async () => {
    setIsStarting(true)
    try {
      if (window.electronAPI) {
        // Start a default 25-minute focus session
        await window.electronAPI.startFocusSession({
          type: 'focus',
          duration: 25 * 60 * 1000, // 25 minutes in milliseconds
          notes: 'Quick start from sidebar'
        })
        // Reload to update the display
        await loadCurrentSession()
      }
    } catch (error) {
      console.error('Error starting focus session:', error)
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <Card className="w-full min-w-0">
      <CardContent className="p-3 min-w-0">
        {/* Toggle Button - Top of Sidebar */}
        <div className="flex justify-end mb-3">
          <Button
            onClick={toggleSidebar}
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-fb-muted hover:text-fb-accent hover:bg-fb-surface2"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Logo */}
        <div className={`flex items-center mb-4 min-w-0 stagger-1 ${collapsed ? 'justify-center' : 'space-x-2.5'}`}>
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[11px] bg-fb-accent shadow-[0_4px_12px_rgba(91,91,214,0.35)]">
            <Hexagon className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <span className="font-display text-base font-semibold tracking-tight truncate min-w-0 text-fb-text">
              Focus Book
            </span>
          )}
        </div>

        <nav className="space-y-0.5">
          <NavItem href="/" icon={Command} label="Dashboard" active={pathname === '/'} collapsed={collapsed} />
          <NavItem
            href="/activity"
            icon={Activity}
            label="Activities"
            active={pathname === '/activity'}
            collapsed={collapsed}
          />
          <NavItem href="/focus" icon={Timer} label="Focus Timer" active={pathname === '/focus'} collapsed={collapsed} />
          <NavItem href="/chat" icon={MessageSquare} label="AI Insights" active={pathname === '/chat'} collapsed={collapsed} />
          <NavItem
            href="/settings"
            icon={Settings}
            label="Settings"
            active={pathname === '/settings'}
            collapsed={collapsed}
          />
        </nav>

        {/* Focus Session Status - Hide when collapsed */}
        {!collapsed && (
          <div className="mt-4 pt-4 border-t border-fb-border">
            <div className="text-xs mb-2 uppercase tracking-wide font-semibold text-fb-muted">Focus Session</div>
            <div className="rounded-xl p-3 space-y-2 transition-all duration-200 bg-fb-surface2 border border-fb-border hover:border-fb-accent/40">
            {currentSession && (currentSession.status === 'active' || currentSession.status === 'paused') ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {currentSession.status === 'active' ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-cat-create animate-pulse" style={{boxShadow: `0 0 8px ${statusColors.active}`}}></div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-cat-create">Active</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 rounded-full bg-cat-break" style={{boxShadow: `0 0 8px ${statusColors.paused}`}}></div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-cat-break">Paused</span>
                      </>
                    )}
                  </div>
                  <span className="text-xs capitalize font-medium tracking-wide text-fb-accent">{currentSession.type}</span>
                </div>
                <div className="font-display text-3xl font-semibold tracking-tight text-fb-text">{formatTime(timeLeft)}</div>
                <div className="text-xs font-medium tracking-wide text-fb-muted">
                  {currentSession.type === 'focus' ? 'Time Remaining' : 'Break Time'}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-fb-muted"></div>
                  <span className="text-xs font-medium uppercase tracking-wide text-fb-muted">No Active Session</span>
                </div>
                <div className="font-display text-3xl font-semibold tracking-tight text-fb-muted/50">00:00</div>
                <div className="flex flex-col gap-2 mt-1 w-full">
                  <Button
                    size="sm"
                    className="w-full text-xs tracking-wide hover-lift"
                    onClick={startQuickFocusSession}
                    disabled={isStarting}
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                    <span className="truncate">{isStarting ? 'Starting...' : 'Quick Start (25min)'}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                    className="w-full tracking-wide hover-lift"
                  >
                    <Link to="/focus" className="flex items-center justify-center">
                      <Timer className="w-3.5 h-3.5 mr-1.5" />
                      <span className="text-xs">Custom Timer</span>
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
        )}
      </CardContent>
    </Card>
  )
}

// Component for nav items
function NavItem({ icon: Icon, label, active, href, collapsed = false }) {
  const buttonContent = (
    <Button
      variant="ghost"
      asChild
      className={`w-full text-sm py-3 min-w-0 font-medium rounded-xl transition-all duration-200 group
        ${collapsed ? 'justify-center px-2' : 'justify-start px-3'}
        ${active
          ? 'bg-fb-accentsoft text-fb-accent hover:bg-fb-accentsoft'
          : 'text-fb-muted hover:text-fb-text hover:bg-fb-surface2'
      }`}
    >
      <Link to={href} className={`flex items-center min-w-0 w-full ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
        <Icon className={`h-5 w-5 flex-shrink-0 transition-transform duration-200 ${active ? 'scale-105' : 'group-hover:scale-105'}`} />
        {!collapsed && (
          <span className="truncate text-left font-normal tracking-normal">{label}</span>
        )}
      </Link>
    </Button>
  )

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            {buttonContent}
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-fb-tip text-white border-0">
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return buttonContent
}
