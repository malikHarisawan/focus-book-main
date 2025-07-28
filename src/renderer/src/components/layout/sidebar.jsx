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

  useEffect(() => {
    loadCurrentSession()
    const interval = setInterval(() => {
      loadCurrentSession()
      if (currentSession && currentSession.status === 'active') {
        updateTimeLeft()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [currentSession])

  const loadCurrentSession = async () => {
    try {
      if (window.electronAPI) {
        const session = await window.electronAPI.getCurrentFocusSession()
        setCurrentSession(session)
      }
    } catch (error) {
      console.error('Error loading current session:', error)
    }
  }

  const updateTimeLeft = () => {
    if (currentSession) {
      const elapsed = Date.now() - new Date(currentSession.startTime).getTime()
      const remaining = currentSession.plannedDuration - elapsed
      setTimeLeft(Math.max(0, Math.floor(remaining / 1000)))
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm h-full w-fit">
      <CardContent className="p-2">
        <div className="flex items-center space-x-2 mb-6">
          <Hexagon className="h-6 w-6 text-cyan-500" />
          <span className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            FOCUS TRACKER
          </span>
        </div>

        <nav className="space-y-2">
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

        {/* Focus Session Status */}
        {currentSession &&
          (currentSession.status === 'active' || currentSession.status === 'paused') && (
            <div className="mt-6 pt-4 border-t border-slate-700/50">
              <div className="text-xs text-slate-500 mb-2 font-mono">FOCUS SESSION</div>
              <div className="bg-slate-800/50 rounded-lg p-3 space-y-2">
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
              </div>
            </div>
          )}

        <div className="mt-8 pt-6 border-t border-slate-700/50">
          <div className="text-xs text-slate-500 mb-2 font-mono">PRODUCTIVITY STATUS</div>
          <div className="space-y-3">
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
      className={`w-full justify-start ${active ? 'bg-slate-800/70 text-cyan-400' : 'text-slate-400 hover:text-slate-100'}`}
    >
      <Link to={href}>
        <Icon className="mr-2 h-4 w-4" />
        {label}
      </Link>
    </Button>
  )
}
