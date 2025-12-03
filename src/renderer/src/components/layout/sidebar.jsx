'use client'

import { useLocation } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Activity, Command, Hexagon, ListTodo, Settings, Timer, Play, Pause, MessageSquare } from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent } from '..//ui/card'
import { StatusItem } from '../Dashboard/status-item'
import { useEffect, useState } from 'react'
import { useTheme } from '../../context/ThemeContext'

export function Sidebar({ productivityScore, dailyGoalProgress, weeklyGoalProgress }) {
  const location = useLocation()
  const pathname = location.pathname
  const { resolvedTheme } = useTheme()
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
    <Card className="backdrop-blur-sm w-full min-w-0 border border-meta-gray-200 bg-white/95 dark:bg-dark-bg-secondary/95 dark:border-dark-border-primary shadow-sm">
      <CardContent className="p-3 sm:p-4 md:p-5 min-w-0">
        <div className="flex items-center space-x-2.5 mb-6 sm:mb-8 min-w-0 stagger-1">
          <Hexagon className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 text-meta-blue-500" />
          <span className="text-sm sm:text-base font-semibold tracking-tight truncate min-w-0 text-meta-gray-900 dark:text-dark-text-primary">
            Focus Book
          </span>
        </div>

        <nav className="space-y-1">
          <NavItem href="/" icon={Command} label="Dashboard" active={pathname === '/'} />
          <NavItem
            href="/activity"
            icon={Activity}
            label="Activities"
            active={pathname === '/activity'}
          />
          <NavItem href="/focus" icon={Timer} label="Focus Timer" active={pathname === '/focus'} />
          <NavItem href="/chat" icon={MessageSquare} label="AI Insights" active={pathname === '/chat'} />
          <NavItem href="/tasks" icon={ListTodo} label="Tasks" active={pathname === '/tasks'} />
          <NavItem
            href="/settings"
            icon={Settings}
            label="Settings"
            active={pathname === '/settings'}
          />
        </nav>

        {/* Focus Session Status - Always visible */}
        <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-meta-gray-200 dark:border-dark-border-primary">
          <div className="text-xs mb-3 uppercase tracking-wide font-semibold text-meta-gray-500 dark:text-dark-text-tertiary">Focus Session</div>
          <div className="rounded-lg p-3 sm:p-4 space-y-3 transition-all duration-200 bg-meta-gray-50 border border-meta-gray-200 hover:border-meta-gray-300 dark:bg-dark-bg-tertiary dark:border-dark-border-primary dark:hover:border-dark-border-secondary">
            {currentSession && (currentSession.status === 'active' || currentSession.status === 'paused') ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {currentSession.status === 'active' ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-meta-green-500 animate-pulse" style={{boxShadow: `0 0 8px ${statusColors.active}`}}></div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-meta-green-600 dark:text-meta-green-400">Active</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 rounded-full bg-meta-orange-500" style={{boxShadow: `0 0 8px ${statusColors.paused}`}}></div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-meta-orange-600 dark:text-meta-orange-400">Paused</span>
                      </>
                    )}
                  </div>
                  <span className="text-xs capitalize font-medium tracking-wide text-meta-blue-600 dark:text-meta-blue-400">{currentSession.type}</span>
                </div>
                <div className="text-3xl font-bold tracking-tight text-meta-gray-900 dark:text-dark-text-primary">{formatTime(timeLeft)}</div>
                <div className="text-xs font-medium tracking-wide text-meta-gray-500 dark:text-dark-text-tertiary">
                  {currentSession.type === 'focus' ? 'Time Remaining' : 'Break Time'}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-meta-gray-400 dark:bg-meta-gray-600"></div>
                  <span className="text-xs font-medium uppercase tracking-wide text-meta-gray-500 dark:text-dark-text-tertiary">No Active Session</span>
                </div>
                <div className="text-3xl font-bold tracking-tight text-meta-gray-300 dark:text-meta-gray-600">00:00</div>
                <div className="flex flex-col gap-2 mt-1 w-full">
                  <Button
                    size="sm"
                    className="w-full text-xs font-semibold tracking-wide transition-all duration-200 hover-lift bg-meta-blue-500 text-white hover:bg-meta-blue-600 shadow-sm"
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
                    className="w-full font-medium tracking-wide transition-all duration-200 hover-lift border-meta-gray-300 text-meta-gray-600 hover:bg-meta-gray-100 dark:border-meta-gray-600 dark:text-meta-gray-300 dark:hover:bg-meta-gray-700"
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
      </CardContent>
    </Card>
  )
}

// Component for nav items
function NavItem({ icon: Icon, label, active, href }) {
  return (
    <Button
      variant="ghost"
      asChild
      className={`w-full justify-start text-sm px-3 py-2.5 min-w-0 font-medium rounded-lg transition-all duration-200 group 
        ${active 
          ? 'bg-meta-blue-50 text-meta-blue-600 border-l-2 border-meta-blue-500 hover:bg-meta-blue-100 dark:bg-meta-blue-500/10 dark:text-meta-blue-400 dark:border-l-2 dark:border-meta-blue-500 dark:hover:bg-meta-blue-500/20' 
          : 'text-meta-gray-600 hover:text-meta-gray-900 hover:bg-meta-gray-100 border-l-2 border-transparent hover:border-meta-blue-300 dark:text-dark-text-secondary dark:hover:text-dark-text-primary dark:hover:bg-meta-gray-700 dark:border-l-2 dark:border-transparent dark:hover:border-meta-blue-400'
      }`}
    >
      <Link to={href} className="flex items-center min-w-0 w-full gap-2.5">
        <Icon className={`h-4 w-4 flex-shrink-0 transition-transform duration-200 ${active ? 'scale-105' : 'group-hover:scale-105'}`} />
        <span className="truncate text-left font-medium tracking-normal">{label}</span>
      </Link>
    </Button>
  )
}
