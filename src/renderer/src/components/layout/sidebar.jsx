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
  const { theme } = useTheme()
  const location = useLocation()
  const pathname = location.pathname
  const [currentSession, setCurrentSession] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [isStarting, setIsStarting] = useState(false)

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
    <Card className={`backdrop-blur-sm w-full min-w-0 ${theme === 'dark' ? 'bg-slate-900/30 border-slate-700/30' : 'bg-white border-gray-100 shadow-sm'}`}>
      <CardContent className="p-3 sm:p-4 md:p-5 min-w-0">
        <div className="flex items-center space-x-2.5 mb-6 sm:mb-8 min-w-0">
          <Hexagon className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-500 flex-shrink-0" />
          <span className="text-sm sm:text-base font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent truncate min-w-0 tracking-tight">
            FOCUS BOOK
          </span>
        </div>

        <nav className="space-y-1">
          <NavItem href="/" icon={Command} label="Dashboard" active={pathname === '/'} theme={theme} />
          <NavItem
            href="/activity"
            icon={Activity}
            label="Activities"
            active={pathname === '/activity'}
            theme={theme}
          />
          <NavItem href="/focus" icon={Timer} label="Focus Timer" active={pathname === '/focus'} theme={theme} />
          <NavItem href="/chat" icon={MessageSquare} label="AI Insights" active={pathname === '/chat'} theme={theme} />
          <NavItem href="/tasks" icon={ListTodo} label="Tasks" active={pathname === '/tasks'} theme={theme} />
          <NavItem
            href="/settings"
            icon={Settings}
            label="Settings"
            active={pathname === '/settings'}
            theme={theme}
          />
        </nav>

        {/* Focus Session Status - Always visible */}
        <div className={`mt-6 sm:mt-8 pt-5 sm:pt-6 border-t ${theme === 'dark' ? 'border-slate-700/30' : 'border-gray-200'}`}>
          <div className={`text-xs mb-3 uppercase tracking-wider font-medium ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Focus Session</div>
          <div className={`rounded-xl p-3 sm:p-4 space-y-3 ${theme === 'dark' ? 'bg-slate-800/30' : 'bg-gray-50 border border-gray-100'}`}>
            {currentSession && (currentSession.status === 'active' || currentSession.status === 'paused') ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {currentSession.status === 'active' ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className={`text-xs font-medium ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>Active</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                        <span className={`text-xs font-medium ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}>Paused</span>
                      </>
                    )}
                  </div>
                  <span className={`text-xs capitalize font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{currentSession.type}</span>
                </div>
                <div className={`text-2xl font-mono font-bold tracking-tight ${theme === 'dark' ? 'text-slate-100' : 'text-slate-900'}`}>{formatTime(timeLeft)}</div>
                <div className={`text-xs font-medium ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>
                  {currentSession.type === 'focus' ? 'Time Remaining' : 'Break Time'}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${theme === 'dark' ? 'bg-slate-600' : 'bg-gray-400'}`}></div>
                  <span className={`text-xs font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>No Active Session</span>
                </div>
                <div className={`text-2xl font-mono font-bold tracking-tight ${theme === 'dark' ? 'text-slate-400' : 'text-slate-400'}`}>00:00</div>
                <div className="flex flex-col gap-2 mt-1 w-full">
                  <Button
                    size="sm"
                    className="w-full text-xs font-medium"
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
                    className="w-full"
                  >
                    <Link to="/focus" className="flex items-center justify-center">
                      <Timer className="w-3.5 h-3.5 mr-1.5" />
                      <span className="text-xs font-medium">Custom Timer</span>
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
function NavItem({ icon: Icon, label, active, href, theme }) {
  return (
    <Button
      variant="ghost"
      asChild
      className={`w-full justify-start text-sm px-3 py-2.5 min-w-0 font-medium rounded-lg transition-all ${
        active
          ? theme === 'dark'
            ? 'bg-slate-800/60 text-cyan-400 hover:bg-slate-800/80'
            : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100'
          : theme === 'dark'
          ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
          : 'text-slate-600 hover:text-slate-900 hover:bg-gray-100'
      }`}
    >
      <Link to={href} className="flex items-center min-w-0 w-full gap-2.5">
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="truncate text-left">{label}</span>
      </Link>
    </Button>
  )
}
