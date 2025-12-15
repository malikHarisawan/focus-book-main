'use client'

import { useLocation } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Activity, Command, Hexagon, ListTodo, Settings, Timer, Play, Pause, MessageSquare } from 'lucide-react'
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
    <Card className="backdrop-blur-sm w-full min-w-0 border border-[#E8EDF1] bg-white dark:bg-[#212329] dark:border-[#282932] shadow-sm">
      <CardContent className="p-3 min-w-0">
        {/* Toggle Button - Top of Sidebar */}
        <div className="flex justify-end mb-3">
          <Button
            onClick={toggleSidebar}
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-[#768396] dark:text-[#898999] hover:text-[#5051F9] hover:bg-[#F4F7FE] dark:hover:bg-[#282932]"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Logo */}
        <div className={`flex items-center mb-4 min-w-0 stagger-1 ${collapsed ? 'justify-center' : 'space-x-2'}`}>
          <Hexagon className="h-5 w-5 text-[#5051F9] flex-shrink-0" />
          {!collapsed && (
            <span className="text-sm font-medium tracking-tight truncate min-w-0 text-[#232360] dark:text-white">
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
          <NavItem href="/tasks" icon={ListTodo} label="Tasks" active={pathname === '/tasks'} collapsed={collapsed} />
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
          <div className="mt-4 pt-4 border-t border-[#E8EDF1] dark:border-[#282932]">
            <div className="text-xs mb-2 uppercase tracking-wide font-medium text-[#768396]">Focus Session</div>
            <div className="rounded-lg p-3 space-y-2 transition-all duration-200 bg-[#F4F7FE] border border-[#E8EDF1] hover:border-[#5051F9]/30 dark:bg-[#282932] dark:border-[#282932] dark:hover:border-[#5051F9]/50">
            {currentSession && (currentSession.status === 'active' || currentSession.status === 'paused') ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {currentSession.status === 'active' ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" style={{boxShadow: `0 0 8px ${statusColors.active}`}}></div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Active</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 rounded-full bg-amber-500" style={{boxShadow: `0 0 8px ${statusColors.paused}`}}></div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Paused</span>
                      </>
                    )}
                  </div>
                  <span className="text-xs capitalize font-medium tracking-wide text-[#5051F9]">{currentSession.type}</span>
                </div>
                <div className="text-3xl font-semibold tracking-tight text-[#232360] dark:text-white">{formatTime(timeLeft)}</div>
                <div className="text-xs font-medium tracking-wide text-[#768396]">
                  {currentSession.type === 'focus' ? 'Time Remaining' : 'Break Time'}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#768396] dark:bg-[#5F6388]"></div>
                  <span className="text-xs font-medium uppercase tracking-wide text-[#768396]">No Active Session</span>
                </div>
                <div className="text-3xl font-semibold tracking-tight text-[#768396]/50 dark:text-[#5F6388]">00:00</div>
                <div className="flex flex-col gap-2 mt-1 w-full">
                  <Button
                    size="sm"
                    className="w-full text-xs font-medium tracking-wide transition-all duration-200 hover-lift bg-[#5051F9] text-white hover:bg-[#4142E0] shadow-sm"
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
                    className="w-full font-medium tracking-wide transition-all duration-200 hover-lift border-[#E8EDF1] text-[#232360] hover:bg-[#F4F7FE] dark:border-[#282932] dark:text-white dark:hover:bg-[#282932]"
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
      className={`w-full text-sm py-2 min-w-0 font-normal rounded-lg transition-all duration-200 group
        ${collapsed ? 'justify-center px-0' : 'justify-start px-2.5'}
        ${active 
          ? 'bg-[#5051F9]/10 text-[#5051F9] border-l-2 border-[#5051F9] hover:bg-[#5051F9]/15' 
          : 'text-[#768396] dark:text-[#898999] hover:text-[#232360] dark:hover:text-white hover:bg-[#F4F7FE] dark:hover:bg-[#282932] border-l-2 border-transparent hover:border-[#5051F9]/50'
      }`}
    >
      <Link to={href} className={`flex items-center min-w-0 w-full ${collapsed ? 'justify-center' : 'gap-2'}`}>
        <Icon className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${active ? 'scale-105' : 'group-hover:scale-105'}`} />
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
          <TooltipContent side="right" className="bg-[#232360] dark:bg-white text-white dark:text-[#232360] border-0">
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return buttonContent
}
