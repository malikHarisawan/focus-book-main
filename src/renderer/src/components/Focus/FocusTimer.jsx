import React, { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Play, Pause, Square, RotateCcw } from 'lucide-react'

const FocusTimer = () => {
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [timeLeft, setTimeLeft] = useState(25 * 60) // 25 minutes in seconds
  const [sessionType, setSessionType] = useState('focus')
  const [sessionCount, setSessionCount] = useState(0)
  const [totalTime, setTotalTime] = useState(25 * 60)
  const [currentSession, setCurrentSession] = useState(null)
  const [todayStats, setTodayStats] = useState(null)
  const [loading, setLoading] = useState(false)

  const sessionTypes = {
    focus: { duration: 25 * 60, label: 'Focus Session', color: 'text-blue-600' },
    pomodoro: { duration: 25 * 60, label: 'Pomodoro', color: 'text-blue-600' },
    shortBreak: { duration: 5 * 60, label: 'Short Break', color: 'text-green-600' },
    longBreak: { duration: 15 * 60, label: 'Long Break', color: 'text-purple-600' }
  }

  // Normalize session type from database to UI
  const normalizeSessionType = (type) => {
    if (type === 'pomodoro') return 'pomodoro'
    if (type === 'short-break') return 'shortBreak'
    if (type === 'long-break') return 'longBreak'
    return 'focus' // default fallback
  }

  // Load current session and stats on mount
  useEffect(() => {
    loadCurrentSession()
    loadTodayStats()
  }, [])

  // Timer countdown effect
  useEffect(() => {
    let interval = null
    if (isRunning && !isPaused && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1)
      }, 1000)
    } else if (timeLeft === 0) {
      handleSessionComplete()
    }
    return () => clearInterval(interval)
  }, [isRunning, isPaused, timeLeft])

  const loadCurrentSession = async () => {
    try {
      if (window.electronAPI) {
        const session = await window.electronAPI.getCurrentFocusSession()
        if (session && session.status === 'active') {
          setCurrentSession(session)
          setIsRunning(true)
          setIsPaused(false)
          setSessionType(normalizeSessionType(session.type))

          // Calculate time left based on session start time and planned duration
          const elapsed = Date.now() - new Date(session.startTime).getTime()
          const remaining = session.plannedDuration - elapsed
          setTimeLeft(Math.max(0, Math.floor(remaining / 1000)))
          setTotalTime(session.plannedDuration / 1000)
        } else if (session && session.status === 'paused') {
          setCurrentSession(session)
          setIsRunning(true)
          setIsPaused(true)
          setSessionType(normalizeSessionType(session.type))

          const elapsed = Date.now() - new Date(session.startTime).getTime()
          const remaining = session.plannedDuration - elapsed
          setTimeLeft(Math.max(0, Math.floor(remaining / 1000)))
          setTotalTime(session.plannedDuration / 1000)
        }
      }
    } catch (error) {
      console.error('Error loading current session:', error)
    }
  }

  const loadTodayStats = async () => {
    try {
      if (window.electronAPI) {
        const stats = await window.electronAPI.getFocusSessionStats()
        setTodayStats(stats)

        // Calculate session count from stats
        const totalSessions = stats.reduce((sum, stat) => sum + stat.totalSessions, 0)
        setSessionCount(totalSessions)
      }
    } catch (error) {
      console.error('Error loading today stats:', error)
    }
  }

  const handleSessionComplete = async () => {
    setIsRunning(false)
    setIsPaused(false)

    // Complete the session in the backend
    if (currentSession && window.electronAPI) {
      try {
        await window.electronAPI.stopFocusSession(currentSession._id)
        setCurrentSession(null)
        await loadTodayStats()

        // Send notification
        await window.electronAPI.showNotification({
          title: 'Focus Session Complete!',
          body: `${sessionTypes[sessionType]?.label || 'Session'} finished. Great work!`
        })
      } catch (error) {
        console.error('Error completing session:', error)
      }
    }

    // Auto-switch to appropriate break
    if (sessionType === 'focus') {
      const nextType = (sessionCount + 1) % 4 === 0 ? 'longBreak' : 'shortBreak'
      setSessionType(nextType)
      setTimeLeft(sessionTypes[nextType].duration)
      setTotalTime(sessionTypes[nextType].duration)
    }
  }

  const startSession = async () => {
    setLoading(true)
    try {
      if (window.electronAPI) {
        const session = await window.electronAPI.startFocusSession({
          type: sessionType,
          duration: totalTime * 1000, // Convert to milliseconds
          startTime: Date.now()
        })

        if (session && !session.error) {
          setCurrentSession(session)
          setIsRunning(true)
          setIsPaused(false)
        } else {
          console.error('Failed to start session:', session?.error)
        }
      }
    } catch (error) {
      console.error('Error starting session:', error)
    } finally {
      setLoading(false)
    }
  }

  const pauseSession = async () => {
    if (currentSession && window.electronAPI) {
      try {
        await window.electronAPI.pauseFocusSession(currentSession._id)
        setIsPaused(true)
      } catch (error) {
        console.error('Error pausing session:', error)
      }
    }
  }

  const resumeSession = async () => {
    if (currentSession && window.electronAPI) {
      try {
        await window.electronAPI.resumeFocusSession(currentSession._id)
        setIsPaused(false)
      } catch (error) {
        console.error('Error resuming session:', error)
      }
    }
  }

  const stopSession = async () => {
    if (currentSession && window.electronAPI) {
      try {
        await window.electronAPI.stopFocusSession(currentSession._id)
        setCurrentSession(null)
        await loadTodayStats()
      } catch (error) {
        console.error('Error stopping session:', error)
      }
    }
    setIsRunning(false)
    setIsPaused(false)
  }

  const resetSession = () => {
    setIsRunning(false)
    setIsPaused(false)
    const sessionConfig = sessionTypes[sessionType] || sessionTypes.focus
    setTimeLeft(sessionConfig.duration)
    setTotalTime(sessionConfig.duration)
  }

  const handleSessionTypeChange = (newType) => {
    if (!isRunning) {
      setSessionType(newType)
      setTimeLeft(sessionTypes[newType].duration)
      setTotalTime(sessionTypes[newType].duration)
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getProgress = () => {
    return ((totalTime - timeLeft) / totalTime) * 100
  }

  const circumference = 2 * Math.PI * 120
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (getProgress() / 100) * circumference

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Focus Timer</CardTitle>
          <p className="text-muted-foreground">
            Session #{sessionCount + 1} • {sessionTypes[sessionType]?.label || 'Focus Session'}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Session Type Selector */}
          <div className="flex justify-center">
            <Select
              value={sessionType}
              onValueChange={handleSessionTypeChange}
              disabled={isRunning}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(sessionTypes).map(([key, type]) => (
                  <SelectItem key={key} value={key}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Circular Timer */}
          <div className="flex justify-center">
            <div className="relative w-64 h-64">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 256 256">
                {/* Background circle */}
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-muted-foreground opacity-20"
                />
                {/* Progress circle */}
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  className={`transition-all duration-1000 ${sessionTypes[sessionType]?.color || 'text-blue-600'}`}
                  strokeLinecap="round"
                />
              </svg>

              {/* Timer display */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl font-bold font-mono">{formatTime(timeLeft)}</div>
                  <div className="text-sm text-muted-foreground mt-2">
                    {isRunning ? (isPaused ? 'Paused' : 'Running') : 'Ready'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Control buttons */}
          <div className="flex justify-center gap-3">
            {!isRunning ? (
              <Button
                onClick={startSession}
                size="lg"
                className="flex items-center gap-2"
                disabled={loading}
              >
                <Play className="w-5 h-5" />
                {loading ? 'Starting...' : 'Start'}
              </Button>
            ) : (
              <>
                {isPaused ? (
                  <Button
                    onClick={resumeSession}
                    size="lg"
                    variant="default"
                    className="flex items-center gap-2"
                  >
                    <Play className="w-5 h-5" />
                    Resume
                  </Button>
                ) : (
                  <Button
                    onClick={pauseSession}
                    size="lg"
                    variant="secondary"
                    className="flex items-center gap-2"
                  >
                    <Pause className="w-5 h-5" />
                    Pause
                  </Button>
                )}
                <Button
                  onClick={stopSession}
                  size="lg"
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <Square className="w-5 h-5" />
                  Stop
                </Button>
              </>
            )}
            <Button
              onClick={resetSession}
              size="lg"
              variant="outline"
              className="flex items-center gap-2"
              disabled={isRunning && !isPaused}
            >
              <RotateCcw className="w-5 h-5" />
              Reset
            </Button>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Progress</span>
              <span>{Math.round(getProgress())}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-1000 ${
                  sessionType === 'focus'
                    ? 'bg-blue-600'
                    : sessionType === 'shortBreak'
                      ? 'bg-green-600'
                      : 'bg-purple-600'
                }`}
                style={{ width: `${getProgress()}%` }}
              />
            </div>
          </div>

          {/* Session stats */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold">{sessionCount}</div>
              <div className="text-sm text-muted-foreground">Sessions Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {todayStats
                  ? (() => {
                      const totalMs = todayStats.reduce(
                        (sum, stat) => sum + (stat.totalDuration || 0),
                        0
                      )
                      const totalMinutes = Math.floor(totalMs / 60000)
                      const hours = Math.floor(totalMinutes / 60)
                      const minutes = totalMinutes % 60
                      return `${hours}h ${minutes}m`
                    })()
                  : '0h 0m'}
              </div>
              <div className="text-sm text-muted-foreground">Total Focus Time</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default FocusTimer
