import React, { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Timer, Target, TrendingUp, Calendar } from 'lucide-react'

const FocusSessionChart = () => {
  const [weeklyData, setWeeklyData] = useState([])
  const [todayStats, setTodayStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFocusSessionData()
  }, [])

  const loadFocusSessionData = async () => {
    try {
      if (window.electronAPI) {
        // Load today's stats
        const today = await window.electronAPI.getFocusSessionStats()
        setTodayStats(today)

        // Load weekly data
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - 6) // Last 7 days

        const weekly = await window.electronAPI.getFocusSessionsByDate(
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        )

        // Process weekly data for charts
        const processedWeekly = processWeeklyData(weekly)
        setWeeklyData(processedWeekly)
      }
    } catch (error) {
      console.error('Error loading focus session data:', error)
    } finally {
      setLoading(false)
    }
  }

  const processWeeklyData = (sessions) => {
    const dailyData = {}
    const today = new Date()

    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })

      dailyData[dateStr] = {
        date: dateStr,
        day: dayName,
        focus: 0,
        shortBreak: 0,
        longBreak: 0,
        totalSessions: 0,
        totalTime: 0
      }
    }

    // Process sessions
    sessions.forEach((session) => {
      if (session.status === 'completed') {
        const sessionDate = new Date(session.date).toISOString().split('T')[0]
        if (dailyData[sessionDate]) {
          dailyData[sessionDate][session.type] += 1
          dailyData[sessionDate].totalSessions += 1
          dailyData[sessionDate].totalTime += session.actualDuration || 0
        }
      }
    })

    return Object.values(dailyData)
  }

  const formatDuration = (milliseconds) => {
    const minutes = Math.floor(milliseconds / 60000)
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`
    }
    return `${remainingMinutes}m`
  }

  const getTotalStats = () => {
    const totalSessions = todayStats.reduce((sum, stat) => sum + stat.totalSessions, 0)
    const totalTime = todayStats.reduce((sum, stat) => sum + (stat.totalDuration || 0), 0)
    const focusSessions = todayStats.find((stat) => stat._id === 'focus')?.totalSessions || 0

    return { totalSessions, totalTime, focusSessions }
  }

  const pieColors = ['#3b82f6', '#10b981', '#8b5cf6']

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Focus Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { totalSessions, totalTime, focusSessions } = getTotalStats()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5" />
          Focus Sessions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{totalSessions}</div>
                <div className="text-sm text-muted-foreground">Total Sessions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{focusSessions}</div>
                <div className="text-sm text-muted-foreground">Focus Sessions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {formatDuration(totalTime)}
                </div>
                <div className="text-sm text-muted-foreground">Total Time</div>
              </div>
            </div>

            {todayStats.length > 0 && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={todayStats}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ _id, totalSessions }) => `${_id} (${totalSessions})`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="totalSessions"
                    >
                      {todayStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>

          <TabsContent value="weekly" className="space-y-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip
                    formatter={(value, name) => [value, name.replace(/([A-Z])/g, ' $1').trim()]}
                    labelFormatter={(label) => `Day: ${label}`}
                  />
                  <Bar dataKey="focus" stackId="a" fill="#3b82f6" name="Focus" />
                  <Bar dataKey="shortBreak" stackId="a" fill="#10b981" name="Short Break" />
                  <Bar dataKey="longBreak" stackId="a" fill="#8b5cf6" name="Long Break" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-xl font-bold">
                  {weeklyData.reduce((sum, day) => sum + day.totalSessions, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Weekly Sessions</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold">
                  {formatDuration(weeklyData.reduce((sum, day) => sum + day.totalTime, 0))}
                </div>
                <div className="text-sm text-muted-foreground">Weekly Time</div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="breakdown" className="space-y-4">
            <div className="space-y-3">
              {todayStats.map((stat, index) => (
                <div
                  key={stat._id}
                  className="flex justify-between items-center p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: pieColors[index % pieColors.length] }}
                    />
                    <div>
                      <div className="font-medium capitalize">
                        {stat._id.replace(/([A-Z])/g, ' $1').trim()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Avg: {formatDuration(stat.avgDuration || 0)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{stat.totalSessions}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDuration(stat.totalDuration || 0)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {todayStats.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Timer className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No focus sessions today yet.</p>
                <p className="text-sm">Start a focus session to see your progress!</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export default FocusSessionChart
