'use client'

import { useLocation } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Activity, Command, Hexagon, ListTodo, Settings, Timer, Play, Pause, MessageSquare } from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent } from '..//ui/card'
import { StatusItem } from '../Dashboard/status-item'
import { useEffect, useState } from 'react'

export function Sidebar({ productivityScore, dailyGoalProgress, weeklyGoalProgress }) {
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
    <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm w-full min-w-0">
      <CardContent className="p-2 sm:p-3 md:p-4 min-w-0">
        <div className="flex items-center space-x-2 mb-4 sm:mb-6 min-w-0">
          <Hexagon className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-500 flex-shrink-0" />
          <span className="text-sm sm:text-base lg:text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent truncate min-w-0">
            FOCUS TRACKER
          </span>
        </div>

        <nav className="space-y-1 sm:space-y-2">
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
        <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-slate-700/50">
          <div className="text-xs text-slate-500 mb-2 font-mono">FOCUS SESSION</div>
          <div className="bg-slate-800/50 rounded-lg p-2 sm:p-3 space-y-2">
            {currentSession && (currentSession.status === 'active' || currentSession.status === 'paused') ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  {currentSession.status === 'active' ? (
                    <>
                      <Play className="w-4 h-4 text-green-500" />
                      <span className="text-green-400">Active</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4 text-yellow-500" />
                      <span className="text-yellow-400">Paused</span>
                    </>
                  )}
                  <span className="text-slate-400 capitalize">{currentSession.type}</span>
                </div>
                <div className="text-lg font-mono text-white">{formatTime(timeLeft)}</div>
                <div className="text-xs text-slate-400">
                  {currentSession.type === 'focus' ? 'Focus Time' : 'Break Time'}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <Timer className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-400">Inactive</span>
                </div>
                <div className="text-base sm:text-lg font-mono text-slate-400">00:00</div>
                <div className="flex flex-col gap-1 mt-2 w-full">
                  <Button 
                    size="sm" 
                    className="w-full text-xs px-2" 
                    onClick={startQuickFocusSession}
                    disabled={isStarting}
                  >
                    <Play className="w-3 h-3 mr-1 flex-shrink-0" />
                    <span className="truncate">{isStarting ? 'Starting...' : 'Quick Start'}</span>
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    asChild
                    className="w-full"
                  >
                    <Link to="/focus" className="flex items-center justify-center">
                      <Timer className="w-3 h-3 mr-1" />
                      <span className="text-xs">Timer</span>
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 sm:mt-8 pt-4 sm:pt-6 border-t border-slate-700/50">
          <div className="text-xs text-slate-500 mb-2 font-mono">PRODUCTIVITY STATUS</div>
          <div className="space-y-2 sm:space-y-3">
            <StatusItem label="Today's Score" value={productivityScore} color="cyan" />
            <StatusItem label="Daily Goal" value={dailyGoalProgress} color="green" />
            <StatusItem label="Weekly Goal" value={weeklyGoalProgress} color="blue" />
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
      className={`w-full justify-start text-xs sm:text-sm px-2 py-1.5 sm:px-3 sm:py-2 min-w-0 ${active ? 'bg-slate-800/70 text-cyan-400' : 'text-slate-400 hover:text-slate-100'}`}
    >
      <Link to={href} className="flex items-center min-w-0 w-full">
        <Icon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
        <span className="truncate text-left">{label}</span>
      </Link>
    </Button>
  )
}
