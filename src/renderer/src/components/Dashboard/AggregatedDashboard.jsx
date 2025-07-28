import React, { useState, useEffect } from 'react'
import { Calendar, TrendingUp, Clock, Target } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import AppUsageDetails from './AppUsageDetails'
import DatabaseManager from './DatabaseManager'
import { useDataAggregation } from '../../hooks/useDataAggregation'

const AggregatedDashboard = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [dateRange, setDateRange] = useState('today')
  const [selectedApps, setSelectedApps] = useState([])

  const { 
    getFormattedData, 
    getDataByDate, 
    getProductivitySummary,
    loading,
    error 
  } = useDataAggregation()

  const [dashboardData, setDashboardData] = useState({
    dayData: null,
    productivitySummary: null,
    rangeData: []
  })

  // Load data when date changes
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        let startDate, endDate

        switch (dateRange) {
          case 'today':
            startDate = endDate = selectedDate
            break
          case 'week':
            const weekStart = new Date(selectedDate)
            weekStart.setDate(weekStart.getDate() - weekStart.getDay())
            startDate = weekStart.toISOString().split('T')[0]
            
            const weekEnd = new Date(weekStart)
            weekEnd.setDate(weekEnd.getDate() + 6)
            endDate = weekEnd.toISOString().split('T')[0]
            break
          case 'month':
            const monthStart = new Date(selectedDate)
            monthStart.setDate(1)
            startDate = monthStart.toISOString().split('T')[0]
            
            const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
            endDate = monthEnd.toISOString().split('T')[0]
            break
          default:
            startDate = endDate = selectedDate
        }

        // Get formatted data for the range
        const rangeData = await getFormattedData(startDate, endDate)
        
        // Get specific day data
        const dayData = await getDataByDate(selectedDate)
        
        // Get productivity summary
        const productivitySummary = await getProductivitySummary(selectedDate)

        setDashboardData({
          dayData,
          productivitySummary,
          rangeData: rangeData || []
        })

        // Update selected apps for AppUsageDetails component
        if (dayData && dayData.applications) {
          const apps = Object.entries(dayData.applications).map(([name, appData]) => ({
            name,
            timeSpentSeconds: Math.floor(appData.timeSpent / 1000),
            category: appData.category,
            description: appData.description,
            domain: appData.domain,
            productivity: getProductivityLevel(appData.category)
          }))
          setSelectedApps(apps)
        } else {
          setSelectedApps([])
        }

      } catch (err) {
        console.error('Error loading dashboard data:', err)
      }
    }

    loadDashboardData()
  }, [selectedDate, dateRange, getFormattedData, getDataByDate, getProductivitySummary])

  const getProductivityLevel = (category) => {
    switch (category) {
      case 'Code':
      case 'Productivity':
      case 'Learning':
      case 'Documenting':
        return 'Productive'
      case 'Entertainment':
      case 'Browsing':
      case 'Personal':
        return 'Un-Productive'
      default:
        return 'Neutral'
    }
  }

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  const getProductivityColor = (productivity) => {
    switch (productivity) {
      case 'Productive':
        return 'text-green-400'
      case 'Neutral':
        return 'text-amber-400'
      case 'Un-Productive':
        return 'text-red-400'
      default:
        return 'text-slate-400'
    }
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-400">Error loading dashboard: {error}</div>
        <Button onClick={() => window.location.reload()} className="mt-4">
          Reload
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-6 w-6 text-cyan-500" />
          <h1 className="text-2xl font-bold text-slate-100">Usage Dashboard</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32 bg-slate-800 border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-md text-slate-100"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Time</CardTitle>
            <Clock className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">
              {dashboardData.productivitySummary ? 
                formatTime(dashboardData.productivitySummary.totalTime / 1000) : 
                '0m'
              }
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Productive</CardTitle>
            <Target className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              {dashboardData.productivitySummary ? 
                formatTime(dashboardData.productivitySummary.productive / 1000) : 
                '0m'
              }
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Neutral</CardTitle>
            <Calendar className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">
              {dashboardData.productivitySummary ? 
                formatTime(dashboardData.productivitySummary.neutral / 1000) : 
                '0m'
              }
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Un-Productive</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">
              {dashboardData.productivitySummary ? 
                formatTime(dashboardData.productivitySummary.unproductive / 1000) : 
                '0m'
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categories Overview */}
      {dashboardData.productivitySummary?.categories && 
       Object.keys(dashboardData.productivitySummary.categories).length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-slate-100">Categories Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(dashboardData.productivitySummary.categories).map(([category, time]) => (
                <div key={category} className="bg-slate-800/30 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">{category}</div>
                  <div className={`text-lg font-semibold ${getProductivityColor(getProductivityLevel(category))}`}>
                    {formatTime(time / 1000)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* App Usage Details */}
      {selectedApps.length > 0 && (
        <AppUsageDetails
          selectedApps={selectedApps}
          selectedRange={{ startIndex: 0, endIndex: 23 }}
          zoomLevel="hour"
          isVisible={true}
          onCategoryChange={(appIds, newCategory) => {
            console.log('Category change:', appIds, newCategory)
            // Handle category change
          }}
        />
      )}

      {/* Database Management */}
      <DatabaseManager />

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="text-slate-400">Loading dashboard data...</div>
        </div>
      )}
    </div>
  )
}

export default AggregatedDashboard
