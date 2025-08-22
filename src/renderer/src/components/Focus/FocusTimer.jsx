import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Badge } from '../ui/badge'
import { Slider } from '../ui/slider'
import { Play, Pause, Square, RotateCcw, Settings, Target, Clock, TrendingUp } from 'lucide-react'

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
  const [customDurations, setCustomDurations] = useState({
    focus: 25,
    shortBreak: 5,
    longBreak: 15
  })
  const [showSettings, setShowSettings] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState(null)
  const [pausedTime, setPausedTime] = useState(0)
  const [timerMode, setTimerMode] = useState('circular') // 'circular', 'digital', 'minimal'
  const [sessionGoal, setSessionGoal] = useState(4)
  const [productivity, setProductivity] = useState(null)
  const [sessionNotes, setSessionNotes] = useState('')
  const [sessionTemplates, setSessionTemplates] = useState([
    { id: 1, name: 'Deep Work', focus: 90, shortBreak: 15, longBreak: 30, description: 'Extended focus for complex tasks' },
    { id: 2, name: 'Classic Pomodoro', focus: 25, shortBreak: 5, longBreak: 15, description: 'Traditional 25-minute sessions' },
    { id: 3, name: 'Power Sessions', focus: 45, shortBreak: 10, longBreak: 20, description: 'Balanced productivity sessions' },
    { id: 4, name: 'Quick Sprints', focus: 15, shortBreak: 3, longBreak: 10, description: 'Short bursts for quick tasks' }
  ])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [breakSuggestion, setBreakSuggestion] = useState(null)
  const [showBreakModal, setShowBreakModal] = useState(false)
  const [focusStreak, setFocusStreak] = useState(0)
  const [lastBreakTime, setLastBreakTime] = useState(null)
  
  const intervalRef = useRef(null)
  const lastUpdateRef = useRef(Date.now())

  const getSessionTypes = useCallback(() => ({
    focus: { duration: customDurations.focus * 60, label: 'Focus Session', color: 'text-cyan-600' },
    pomodoro: { duration: customDurations.focus * 60, label: 'Pomodoro', color: 'text-cyan-600' },
    shortBreak: { duration: customDurations.shortBreak * 60, label: 'Short Break', color: 'text-emerald-600' },
    longBreak: { duration: customDurations.longBreak * 60, label: 'Long Break', color: 'text-indigo-600' }
  }), [customDurations])
  
  const sessionTypes = getSessionTypes()

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

  // Enhanced timer countdown effect with better precision
  useEffect(() => {
    if (isRunning && !isPaused && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        const now = Date.now()
        const elapsed = Math.floor((now - lastUpdateRef.current) / 1000)
        
        if (elapsed >= 1) {
          setTimeLeft((prevTime) => {
            const newTime = Math.max(0, prevTime - elapsed)
            if (newTime === 0) {
              handleSessionComplete()
            }
            return newTime
          })
          lastUpdateRef.current = now
        }
      }, 100) // More frequent updates for smoother UI
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isRunning, isPaused, timeLeft])

  const loadCurrentSession = async () => {
    try {
      if (window.electronAPI) {
        const session = await window.electronAPI.getCurrentFocusSession()
        if (session && (session.status === 'active' || session.status === 'paused')) {
          setCurrentSession(session)
          setIsRunning(true)
          setIsPaused(session.status === 'paused')
          setSessionType(normalizeSessionType(session.type))
          setSessionStartTime(new Date(session.start_time))
          
          // Improved time calculation with pause handling
          const sessionStart = new Date(session.start_time).getTime()
          const now = Date.now()
          const plannedDurationMs = session.planned_duration || session.plannedDuration
          
          // Calculate elapsed time (excluding paused periods)
          let elapsed = 0
          if (session.status === 'active') {
            elapsed = now - sessionStart - (session.paused_duration || 0)
          } else {
            // For paused sessions, use the time when it was paused
            elapsed = (session.paused_at ? new Date(session.paused_at).getTime() : now) - sessionStart - (session.paused_duration || 0)
          }
          
          const remaining = Math.max(0, plannedDurationMs - elapsed)
          setTimeLeft(Math.floor(remaining / 1000))
          setTotalTime(Math.floor(plannedDurationMs / 1000))
          lastUpdateRef.current = Date.now()
          
          // Load session notes if available
          if (session.notes) {
            setSessionNotes(session.notes)
          }
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
    
    // Calculate actual duration
    const actualDuration = sessionStartTime ? Date.now() - sessionStartTime.getTime() - pausedTime : totalTime * 1000

    // Complete the session in the backend
    if (currentSession && window.electronAPI) {
      try {
        const sessionId = currentSession._id
        await window.electronAPI.stopFocusSession(sessionId, 'completed', actualDuration)
        setLastCompletedSessionId(sessionId)
        setCurrentSession(null)
        await loadTodayStats()

        // Send notification with more details
        const completedSession = sessionTypes[sessionType]?.label || 'Session'
        const duration = Math.floor(actualDuration / 60000)
        await window.electronAPI.showNotification({
          title: 'Focus Session Complete! 🎉',
          body: `${completedSession} (${duration}m) finished. Rate your productivity!`
        })
        
        // Show productivity rating prompt for focus sessions only
        if (sessionType === 'focus' || sessionType === 'pomodoro') {
          setTimeout(() => {
            setShowProductivityRating(true)
          }, 1000)
        }
      } catch (error) {
        console.error('Error completing session:', error)
      }
    }

    // Update focus streak and last break time tracking
    if (sessionType === 'focus' || sessionType === 'pomodoro') {
      setFocusStreak(prev => prev + 1)
      
      // Smart break suggestion after focus sessions
      setTimeout(() => {
        suggestBreak()
      }, 3000) // Show suggestion 3 seconds after completion
    } else {
      // Reset focus streak and update last break time for break sessions
      setFocusStreak(0)
      setLastBreakTime(Date.now())
    }
  }

  const startSession = async () => {
    setLoading(true)
    try {
      if (window.electronAPI) {
        const startTime = Date.now()
        const session = await window.electronAPI.startFocusSession({
          type: sessionType,
          duration: totalTime * 1000, // Convert to milliseconds
          startTime: startTime
        })

        if (session && !session.error) {
          setCurrentSession(session)
          setIsRunning(true)
          setIsPaused(false)
          setSessionStartTime(new Date(startTime))
          setPausedTime(0)
          lastUpdateRef.current = startTime
          
          // Reset session state
          setProductivity(null)
          setSessionNotes('')
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
        const pauseTime = Date.now()
        await window.electronAPI.pauseFocusSession(currentSession._id)
        setIsPaused(true)
        
        // Update the session to track pause time
        setCurrentSession(prev => ({
          ...prev,
          paused_at: new Date(pauseTime).toISOString(),
          status: 'paused'
        }))
      } catch (error) {
        console.error('Error pausing session:', error)
      }
    }
  }

  const resumeSession = async () => {
    if (currentSession && window.electronAPI) {
      try {
        const resumeTime = Date.now()
        await window.electronAPI.resumeFocusSession(currentSession._id)
        setIsPaused(false)
        lastUpdateRef.current = resumeTime
        
        // Calculate pause duration and update session
        if (currentSession.paused_at) {
          const pauseDuration = resumeTime - new Date(currentSession.paused_at).getTime()
          setPausedTime(prev => prev + pauseDuration)
          
          setCurrentSession(prev => ({
            ...prev,
            paused_duration: (prev.paused_duration || 0) + pauseDuration,
            paused_at: null,
            status: 'active'
          }))
        }
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
    setSessionStartTime(null)
    setPausedTime(0)
    const sessionConfig = sessionTypes[sessionType] || sessionTypes.focus
    setTimeLeft(sessionConfig.duration)
    setTotalTime(sessionConfig.duration)
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const handleSessionTypeChange = (newType) => {
    if (!isRunning) {
      setSessionType(newType)
      const duration = sessionTypes[newType].duration
      setTimeLeft(duration)
      setTotalTime(duration)
    }
  }
  
  const updateCustomDuration = (type, minutes) => {
    setCustomDurations(prev => ({
      ...prev,
      [type]: minutes
    }))
    
    // Update current session if it matches the type being changed
    if (sessionType === type && !isRunning) {
      const newDuration = minutes * 60
      setTimeLeft(newDuration)
      setTotalTime(newDuration)
    }
  }
  
  const [showProductivityRating, setShowProductivityRating] = useState(false)
  
  const [lastCompletedSessionId, setLastCompletedSessionId] = useState(null)
  
  const submitProductivityRating = async () => {
    if (lastCompletedSessionId && productivity !== null) {
      try {
        await window.electronAPI.rateFocusSession(lastCompletedSessionId, productivity, sessionNotes)
        setShowProductivityRating(false)
        setProductivity(null)
        setSessionNotes('')
        setLastCompletedSessionId(null)
      } catch (error) {
        console.error('Error rating session:', error)
      }
    }
  }
  
  const applyTemplate = (template) => {
    if (!isRunning) {
      setCustomDurations({
        focus: template.focus,
        shortBreak: template.shortBreak,
        longBreak: template.longBreak
      })
      setSelectedTemplate(template.id)
      
      // Update current session if timer is reset
      const sessionConfig = sessionTypes[sessionType] || sessionTypes.focus
      setTimeLeft(sessionConfig.duration)
      setTotalTime(sessionConfig.duration)
    }
  }
  
  const saveCustomTemplate = () => {
    const newTemplate = {
      id: Date.now(),
      name: `Custom Template ${sessionTemplates.length + 1}`,
      focus: customDurations.focus,
      shortBreak: customDurations.shortBreak,
      longBreak: customDurations.longBreak,
      description: 'Custom user template'
    }
    setSessionTemplates(prev => [...prev, newTemplate])
    setSelectedTemplate(newTemplate.id)
  }
  
  const deleteTemplate = (templateId) => {
    if (sessionTemplates.find(t => t.id === templateId && t.id <= 4)) {
      // Don't allow deleting default templates
      return
    }
    setSessionTemplates(prev => prev.filter(t => t.id !== templateId))
    if (selectedTemplate === templateId) {
      setSelectedTemplate(null)
    }
  }
  
  // Smart break suggestion logic
  const suggestBreak = useCallback(() => {
    const now = Date.now()
    const timeSinceLastBreak = lastBreakTime ? now - lastBreakTime : 0
    const hoursSinceLastBreak = timeSinceLastBreak / (1000 * 60 * 60)
    
    // Suggest break based on various factors
    let suggestion = null
    
    if (focusStreak >= 3 && hoursSinceLastBreak >= 1.5) {
      suggestion = {
        type: 'longBreak',
        reason: 'You\'ve completed 3+ focus sessions. Time for a longer break!',
        urgency: 'high',
        benefits: ['Prevent mental fatigue', 'Improve creativity', 'Better retention']
      }
    } else if (focusStreak >= 2 && hoursSinceLastBreak >= 0.5) {
      suggestion = {
        type: 'shortBreak',
        reason: 'Great progress! A short break will help you maintain focus.',
        urgency: 'medium',
        benefits: ['Refresh your mind', 'Maintain productivity', 'Reduce eye strain']
      }
    } else if (hoursSinceLastBreak >= 2) {
      suggestion = {
        type: 'longBreak',
        reason: 'You\'ve been working for over 2 hours without a break.',
        urgency: 'high',
        benefits: ['Prevent burnout', 'Restore energy', 'Improve well-being']
      }
    }
    
    if (suggestion) {
      setBreakSuggestion(suggestion)
      setShowBreakModal(true)
    }
  }, [focusStreak, lastBreakTime])
  
  const acceptBreakSuggestion = () => {
    if (breakSuggestion) {
      setSessionType(breakSuggestion.type)
      const duration = sessionTypes[breakSuggestion.type].duration
      setTimeLeft(duration)
      setTotalTime(duration)
      setShowBreakModal(false)
      setBreakSuggestion(null)
      
      // Start the break session automatically
      setTimeout(() => {
        if (!isRunning) {
          startSession()
        }
      }, 1000)
    }
  }
  
  const dismissBreakSuggestion = () => {
    setShowBreakModal(false)
    setBreakSuggestion(null)
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

  // Render different timer views
  const renderTimerView = () => {
    switch (timerMode) {
      case 'digital':
        return (
          <div className="text-center py-8">
            <div className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-mono font-bold tracking-wider">
              {formatTime(timeLeft)}
            </div>
            <div className="text-lg text-gray-400 mt-4">
              {isRunning ? (isPaused ? 'Paused' : 'Running') : 'Ready'}
            </div>
          </div>
        )
      case 'minimal':
        return (
          <div className="text-center py-4">
            <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-2">{formatTime(timeLeft)}</div>
            <div className="w-full bg-gray-700 rounded-full h-1">
              <div
                className={`h-1 rounded-full transition-all duration-1000 ${
                  sessionType === 'focus' || sessionType === 'pomodoro'
                    ? 'bg-cyan-500'
                    : sessionType === 'shortBreak'
                      ? 'bg-emerald-500'
                      : 'bg-indigo-500'
                }`}
                style={{ width: `${getProgress()}%` }}
              />
            </div>
          </div>
        )
      default:
        return (
          <div className="flex justify-center">
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 mx-auto">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 256 256">
                {/* Background circle */}
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-600 opacity-20"
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
                  <div className="text-sm text-gray-400 mt-2">
                    {isRunning ? (isPaused ? 'Paused' : 'Running') : 'Ready'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="w-full p-2 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 lg:space-y-6 text-white">
      <Tabs defaultValue="timer" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="timer" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
            <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Timer</span>
            <span className="sm:hidden">Time</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
            <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Settings</span>
            <span className="sm:hidden">Set</span>
          </TabsTrigger>
          <TabsTrigger value="goals" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
            <Target className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Goals</span>
            <span className="sm:hidden">Goal</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
            <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Analytics</span>
            <span className="sm:hidden">Stats</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timer" className="space-y-4 md:space-y-6">
          <Card>
            <CardHeader className="text-center">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-gray-700 border-gray-300">
                    Session #{sessionCount + 1}
                  </Badge>
                  <Badge variant="secondary" className="text-gray-700 bg-gray-100">
                    {sessionTypes[sessionType]?.label || 'Focus Session'}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTimerMode('circular')}
                    className={timerMode === 'circular' ? 'bg-accent' : ''}
                  >
                    ○
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTimerMode('digital')}
                    className={timerMode === 'digital' ? 'bg-accent' : ''}
                  >
                    123
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTimerMode('minimal')}
                    className={timerMode === 'minimal' ? 'bg-accent' : ''}
                  >
                    —
                  </Button>
                </div>
              </div>
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

              {/* Dynamic Timer View */}
              {renderTimerView()}

              {/* Control buttons */}
              <div className="flex flex-wrap justify-center gap-2 md:gap-3">
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
              {timerMode !== 'minimal' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Progress</span>
                    <span>{Math.round(getProgress())}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-1000 ${
                        sessionType === 'focus' || sessionType === 'pomodoro'
                          ? 'bg-cyan-500'
                          : sessionType === 'shortBreak'
                            ? 'bg-emerald-500'
                            : 'bg-indigo-500'
                      }`}
                      style={{ width: `${getProgress()}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Session stats */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold">{sessionCount}</div>
                  <div className="text-sm text-gray-500">Sessions Today</div>
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
                  <div className="text-sm text-gray-500">Total Focus Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{sessionGoal}</div>
                  <div className="text-sm text-gray-500">Daily Goal</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Custom Session Durations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="focus-duration">Focus Session (minutes)</Label>
                  <div className="flex items-center space-x-2">
                    <Slider
                      id="focus-duration"
                      min={5}
                      max={120}
                      step={5}
                      value={[customDurations.focus]}
                      onValueChange={([value]) => updateCustomDuration('focus', value)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={customDurations.focus}
                      onChange={(e) => updateCustomDuration('focus', parseInt(e.target.value) || 25)}
                      className="w-20"
                      min={5}
                      max={120}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="short-break-duration">Short Break (minutes)</Label>
                  <div className="flex items-center space-x-2">
                    <Slider
                      id="short-break-duration"
                      min={1}
                      max={30}
                      step={1}
                      value={[customDurations.shortBreak]}
                      onValueChange={([value]) => updateCustomDuration('shortBreak', value)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={customDurations.shortBreak}
                      onChange={(e) => updateCustomDuration('shortBreak', parseInt(e.target.value) || 5)}
                      className="w-20"
                      min={1}
                      max={30}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="long-break-duration">Long Break (minutes)</Label>
                  <div className="flex items-center space-x-2">
                    <Slider
                      id="long-break-duration"
                      min={5}
                      max={60}
                      step={5}
                      value={[customDurations.longBreak]}
                      onValueChange={([value]) => updateCustomDuration('longBreak', value)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={customDurations.longBreak}
                      onChange={(e) => updateCustomDuration('longBreak', parseInt(e.target.value) || 15)}
                      className="w-20"
                      min={5}
                      max={60}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Session Templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sessionTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedTemplate === template.id
                        ? 'border-cyan-500 bg-cyan-50'
                        : 'border-gray-200 hover:border-cyan-300'
                    }`}
                    onClick={() => applyTemplate(template)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{template.name}</h3>
                      {template.id > 4 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteTemplate(template.id)
                          }}
                          className="h-6 w-6 p-0"
                        >
                          ×
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                    <div className="flex gap-2 text-xs">
                      <Badge variant="outline">Focus: {template.focus}m</Badge>
                      <Badge variant="outline">Short: {template.shortBreak}m</Badge>
                      <Badge variant="outline">Long: {template.longBreak}m</Badge>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={saveCustomTemplate} variant="outline" className="flex-1">
                  Save Current as Template
                </Button>
                <Button 
                  onClick={() => {
                    setCustomDurations({ focus: 25, shortBreak: 5, longBreak: 15 })
                    setSelectedTemplate(2) // Classic Pomodoro
                  }}
                  variant="outline"
                >
                  Reset to Default
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goals" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Goals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="session-goal">Daily Session Goal</Label>
                <div className="flex items-center space-x-2">
                  <Slider
                    id="session-goal"
                    min={1}
                    max={20}
                    step={1}
                    value={[sessionGoal]}
                    onValueChange={([value]) => setSessionGoal(value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={sessionGoal}
                    onChange={(e) => setSessionGoal(parseInt(e.target.value) || 4)}
                    className="w-20"
                    min={1}
                    max={20}
                  />
                </div>
              </div>
              <div className="pt-4">
                <div className="text-sm text-gray-600 mb-2">
                  Progress: {sessionCount} / {sessionGoal} sessions
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 bg-cyan-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((sessionCount / sessionGoal) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Today's Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {todayStats?.map((stat, index) => (
                  <div key={stat._id} className="text-center p-4 bg-gray-100 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{stat.totalSessions}</div>
                    <div className="text-sm text-gray-600 capitalize">
                      {stat._id.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {Math.floor((stat.totalDuration || 0) / 60000)}m total
                    </div>
                  </div>
                )) || (
                  <div className="col-span-full text-center text-gray-500 py-8">
                    No sessions completed today
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Smart Break Suggestion Modal */}
      {showBreakModal && breakSuggestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                ☕ Break Time Suggestion
                <Badge variant={breakSuggestion.urgency === 'high' ? 'destructive' : 'secondary'}>
                  {breakSuggestion.urgency}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">{breakSuggestion.reason}</p>
              
              <div className="space-y-2">
                <h4 className="font-medium">Benefits of taking this break:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {breakSuggestion.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <span className="w-1 h-1 bg-current rounded-full" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button onClick={acceptBreakSuggestion} className="flex-1">
                  Take {sessionTypes[breakSuggestion.type]?.label}
                </Button>
                <Button onClick={dismissBreakSuggestion} variant="outline">
                  Continue Working
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Productivity Rating Modal */}
      {showProductivityRating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-lg mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🎯 Rate Your Session
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>How productive was this session?</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <Button
                      key={rating}
                      variant={productivity === rating ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setProductivity(rating)}
                      className="flex-1"
                    >
                      {rating} ⭐
                    </Button>
                  ))}
                </div>
                <div className="text-xs text-gray-500 text-center">
                  1 = Poor • 2 = Below Average • 3 = Average • 4 = Good • 5 = Excellent
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="session-notes">Session Reflection (Optional)</Label>
                <textarea
                  id="session-notes"
                  placeholder="What went well? What could be improved? Any insights..."
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  className="w-full p-3 text-sm border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 rounded-md resize-none h-24 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={submitProductivityRating} 
                  className="flex-1"
                  disabled={productivity === null}
                >
                  Save Rating
                </Button>
                <Button 
                  onClick={() => {
                    setShowProductivityRating(false)
                    setProductivity(null)
                    setSessionNotes('')
                  }} 
                  variant="outline"
                >
                  Skip
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default FocusTimer
