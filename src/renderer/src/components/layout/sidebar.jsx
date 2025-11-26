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

  // Theme-aware glow colors
  const glowColors = {
    green: resolvedTheme === 'dark' ? 'rgba(0, 255, 0, 0.7)' : 'rgba(16, 185, 129, 0.6)',
    orange: resolvedTheme === 'dark' ? 'rgba(255, 153, 0, 0.7)' : 'rgba(249, 115, 22, 0.6)',
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
    <Card className="backdrop-blur-md w-full min-w-0 border-0 bg-light-bg-card/80 border border-neon-cyan-500/20 dark:bg-dark-bg-card/40 dark:neon-border">
      <CardContent className="p-3 sm:p-4 md:p-5 min-w-0">
        <div className="flex items-center space-x-2.5 mb-6 sm:mb-8 min-w-0 stagger-1">
          <Hexagon className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 text-neon-cyan-600 dark:text-neon-cyan-500" />
          <span className="text-sm sm:text-base font-heading font-black tracking-widest truncate min-w-0 uppercase gradient-text dark:neon-glow">
            FOCUS BOOK
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
        <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-neon-cyan-500/30 dark:border-neon-cyan-500/20">
          <div className="text-xs mb-3 uppercase tracking-widest font-heading font-bold text-neon-cyan-600 dark:text-neon-cyan-500">Focus Session</div>
          <div className="rounded-none p-3 sm:p-4 space-y-3 transition-all duration-300 bg-light-bg-secondary border border-neon-cyan-500/20 hover:border-neon-cyan-500/40 dark:bg-dark-bg-tertiary/50 dark:border-neon-cyan-500/20 dark:hover:border-neon-cyan-500/40">
            {currentSession && (currentSession.status === 'active' || currentSession.status === 'paused') ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {currentSession.status === 'active' ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-neon-green-500 animate-pulse" style={{boxShadow: `0 0 10px ${glowColors.green}`}}></div>
                        <span className="text-xs font-heading font-semibold uppercase tracking-wider text-neon-green-600 dark:text-neon-green-400">Active</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 rounded-full bg-neon-orange-500" style={{boxShadow: `0 0 10px ${glowColors.orange}`}}></div>
                        <span className="text-xs font-heading font-semibold uppercase tracking-wider text-neon-orange-600 dark:text-neon-orange-400">Paused</span>
                      </>
                    )}
                  </div>
                  <span className="text-xs capitalize font-heading font-medium tracking-wide text-neon-purple-600 dark:text-neon-purple-400">{currentSession.type}</span>
                </div>
                <div className="text-3xl font-heading font-black tracking-tight text-neon-cyan-600 dark:text-neon-cyan-400 dark:neon-glow">{formatTime(timeLeft)}</div>
                <div className="text-xs font-body font-medium tracking-wide text-slate-600 dark:text-slate-400">
                  {currentSession.type === 'focus' ? 'Time Remaining' : 'Break Time'}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-slate-600"></div>
                  <span className="text-xs font-heading font-medium uppercase tracking-wider text-slate-600 dark:text-slate-500">No Active Session</span>
                </div>
                <div className="text-3xl font-heading font-black tracking-tight text-slate-400 dark:text-slate-600">00:00</div>
                <div className="flex flex-col gap-2 mt-1 w-full">
                  <Button
                    size="sm"
                    className="w-full text-xs font-heading font-semibold tracking-wider uppercase transition-all duration-300 hover-lift bg-neon-cyan-500 text-white border border-neon-cyan-600 hover:bg-neon-cyan-600 dark:bg-neon-cyan-500/20 dark:text-neon-cyan-400 dark:border-neon-cyan-500/50 dark:hover:bg-neon-cyan-500/30 dark:hover:border-neon-cyan-500 dark:neon-border"
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
                    className="w-full font-heading font-medium tracking-wider uppercase transition-all duration-300 hover-lift border-neon-pink-500 text-neon-pink-600 hover:bg-neon-pink-50 dark:border-neon-pink-500/50 dark:text-neon-pink-400 dark:hover:bg-neon-pink-500/10 dark:hover:border-neon-pink-500"
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
      className={`w-full justify-start text-sm px-3 py-2.5 min-w-0 font-body font-medium rounded-none transition-all duration-300 hover-lift group 
        ${active 
          ? 'bg-neon-cyan-50 text-neon-cyan-700 border-l-2 border-neon-cyan-500 hover:bg-neon-cyan-100 dark:bg-neon-cyan-500/10 dark:text-neon-cyan-400 dark:border-l-2 dark:border-neon-cyan-500 dark:hover:bg-neon-cyan-500/20 dark:neon-border' 
          : 'text-slate-600 hover:text-neon-cyan-600 hover:bg-neon-cyan-50 border-l-2 border-transparent hover:border-neon-cyan-500/50 dark:text-slate-400 dark:hover:text-neon-cyan-400 dark:hover:bg-neon-cyan-500/5 dark:border-l-2 dark:border-transparent dark:hover:border-neon-cyan-500/50'
      }`}
    >
      <Link to={href} className="flex items-center min-w-0 w-full gap-2.5">
        <Icon className={`h-4 w-4 flex-shrink-0 transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`} />
        <span className="truncate text-left font-body font-medium tracking-wide">{label}</span>
      </Link>
    </Button>
  )
}
