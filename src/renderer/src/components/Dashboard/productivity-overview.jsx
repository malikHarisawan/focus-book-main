import { useEffect, useState } from 'react'
import { Activity, Clock, Flame, LineChart, RefreshCw, Trophy, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { MetricCard } from './metric-card'
import { TrendingDown, TrendingUp, Calendar } from '../shared/icons'
import ProductiveAreaChart from './ProductiveAreaChart'
import StatCard from './StatCard'
import SmartDatePicker from '../shared/smart-date-picker'
import AppUsageDetails from './AppUsageDetails'
import { useDate } from '../../context/DateContext'
import {
  processUsageChartData,
  processMostUsedApps,
  getTotalFocusTime,
  getCategoryBreakdown,
  processProductiveChartData,
  getTotalScreenTime,
  formatAppsData,
  extractDomainName,
  getProductivityType
} from '../../utils/dataProcessor'
export default function ProductivityOverview() {
  const [view, setView] = useState('day')
  const [chartData, setChartData] = useState([])
  const [appsData, setAppsData] = useState([])
  const [focusTime, setFocusTime] = useState(0)
  const [totalTime, setTotalTime] = useState('')
  const [apps, setApps] = useState([])
  const [rawData, setRawData] = useState(null)
  const [currentZoomLevel, setCurrentZoomLevel] = useState('hour')
  const { selectedDate, handleDateChange } = useDate()
  const [productivityScore, setProductivityScore] = useState(85)
  const [streakDays, setStreakDays] = useState(5)
  const [productiveData, setProductiveData] = useState([])
  const [selectedApps, setSelectedApps] = useState([])
  const [selectedRange, setSelectedRange] = useState(null)
  const [showAppDetails, setShowAppDetails] = useState(false)
  const [expandedApp, setExpandedApp] = useState(null)
  const [appDetailedData, setAppDetailedData] = useState([])

  const handleDate = (e) => {
    handleDateChange(e.target.value)
  }

  const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
  useEffect(() => {
    loadAndProcessData()
    handleVisibilityChange()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Listen for category updates from Activity page
    window.activeWindow.onCategoryUpdated((data) => {
      console.log('Dashboard received category update:', data)
      loadAndProcessData()
    })
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [selectedDate])
  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      loadAndProcessData()
    }
  }
  const loadAndProcessData = async () => {
    const jsonData = await window.activeWindow.getAppUsageStats()
    setRawData(jsonData)
    const appsData = formatAppsData(jsonData, selectedDate, false) // Default to summary view
    setApps(appsData)
    const processedChartData = processUsageChartData(jsonData, selectedDate, view)
    setChartData(processedChartData)

    const processedProductiveChartData = processProductiveChartData(jsonData, selectedDate, 'hour')
    console.log('Area Chart data', processedProductiveChartData)
    setProductiveData(processedProductiveChartData)

    const processedAppsData = processMostUsedApps(jsonData, selectedDate, false) // Default to summary view
    console.log('processedAppsData', processedAppsData)
    setAppsData(processedAppsData)

    const focTime = getTotalFocusTime(jsonData, selectedDate, processedChartData, view)
    console.log('focustime', focTime)
    setFocusTime(focTime)

    const screenTime = getTotalScreenTime(jsonData, selectedDate, processedChartData, view)
    console.log('screenTime', screenTime)
    setTotalTime(screenTime)
  }
  const totalTimeSeconds = apps.reduce((total, app) => total + app.timeSpentSeconds, 0)
  const totalHours = Math.floor(totalTimeSeconds / 3600)
  const totalMinutes = Math.floor((totalTimeSeconds % 3600) / 60)
  const totalTimeFormatted = `${totalHours}h ${totalMinutes}m`

  const productiveTime = apps
    .filter((app) => getProductivityType(app.category) === 'productive')
    .reduce((total, app) => total + app.timeSpentSeconds, 0)

  const neutralTime = apps
    .filter((app) => getProductivityType(app.category) === 'neutral')
    .reduce((total, app) => total + app.timeSpentSeconds, 0)

  const distractingTime = apps
    .filter((app) => getProductivityType(app.category) === 'distracted')
    .reduce((total, app) => total + app.timeSpentSeconds, 0)
  const productivePercentage = Math.round((productiveTime / totalTimeSeconds) * 100)
  const neutralPercentage = Math.round((neutralTime / totalTimeSeconds) * 100)
  const distractingPercentage = Math.round((distractingTime / totalTimeSeconds) * 100)

  // Handle selection changes from ProductiveAreaChart
  const handleSelectionChange = (apps, range) => {
    setSelectedApps(apps || [])
    setSelectedRange(range)
    // Show app details when a selection is made
    if (apps && apps.length > 0) {
      setShowAppDetails(true)
    }
  }

  // Handle category change for selected apps
  const handleCategoryChange = (appIds, newCategory) => {
    // This would integrate with the category change system
    // For now, just log the change
    console.log('Category change requested:', { appIds, newCategory })
    // TODO: Implement actual category change logic
  }

  // Handle app detail expansion
  const handleAppDetailToggle = async (appName) => {
    if (expandedApp === appName) {
      // Collapse if already expanded
      setExpandedApp(null)
      setAppDetailedData([])
    } else {
      // Expand new app
      setExpandedApp(appName)

      // Load detailed data for this specific app by going directly to raw data
      const jsonData = await window.activeWindow.getAppUsageStats()
      const rawApps = jsonData[selectedDate]?.apps || {}

      console.log('🔍 Expanding details for:', appName)
      console.log('📅 Selected date:', selectedDate)
      console.log('📊 Raw apps data:', Object.keys(rawApps).length, 'entries')

      const thisAppDetails = []

      // Filter raw app data to find entries that match this service
      for (const [originalAppName, data] of Object.entries(rawApps)) {
        // Use the same logic as formatAppsData: prefer description, fallback to domain name
        let serviceName
        if (data.description && data.description.trim()) {
          serviceName = data.description
        } else {
          serviceName = extractDomainName(data.domain, originalAppName)
        }
        
        // Debug: log first few comparisons
        if (thisAppDetails.length < 3) {
          console.log(`  Comparing: "${serviceName}" === "${appName}"?`, serviceName === appName)
          console.log(`    Original: "${originalAppName}", Description: "${data.description}", Domain: "${data.domain}"`)
        }
        
        if (serviceName === appName) {
          thisAppDetails.push({
            name: originalAppName,
            time: Math.floor(data.time / 1000 / 60), // Convert to minutes
            category: data.category,
            domain: data.domain
          })
        }
      }

      console.log(`✅ Found ${thisAppDetails.length} matching entries for "${appName}"`)

      // Sort by time spent (descending)
      thisAppDetails.sort((a, b) => b.time - a.time)

      setAppDetailedData(thisAppDetails)
    }
  }

  return (
    <Card className="bg-white border-meta-gray-200 shadow-sm dark:bg-dark-bg-secondary dark:border-dark-border-primary backdrop-blur-sm overflow-hidden transition-colors h-full">
      <CardHeader className="border-b bg-meta-gray-50 border-meta-gray-200 dark:bg-dark-bg-tertiary dark:border-dark-border-primary py-5 px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <CardTitle className="text-meta-gray-900 dark:text-dark-text-primary flex items-center text-xl font-semibold tracking-tight">
            <Activity className="mr-3 h-6 w-6 text-meta-blue-500 flex-shrink-0" />
            <span>Productivity Overview</span>
          </CardTitle>
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <SmartDatePicker zoomLevel={currentZoomLevel} onDateChange={loadAndProcessData} />
            <Button
              onClick={loadAndProcessData}
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-meta-gray-500 hover:text-meta-gray-900 hover:bg-meta-gray-100 dark:text-dark-text-secondary dark:hover:text-dark-text-primary dark:hover:bg-meta-gray-700 flex-shrink-0 transition-colors"
              title="Refresh data"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4">
        {/* Daily Summary */}
        <div className="mb-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            {/* Productivity Score Circle */}
            <div className="rounded-xl p-4 border bg-white border-meta-gray-200 shadow-sm dark:bg-dark-bg-tertiary dark:border-dark-border-primary">
              <div className="text-xs uppercase tracking-wide font-semibold mb-3 text-meta-gray-500 dark:text-dark-text-tertiary">
                Today
              </div>
              <div className="relative w-32 h-32 mx-auto mb-3">
                <svg className="transform -rotate-90 w-32 h-32">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="10"
                    fill="transparent"
                    className="text-meta-gray-200 dark:text-meta-gray-700"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - (isNaN(productivePercentage) ? 0 : productivePercentage / 100))}`}
                    className={`transition-all duration-1000 ${
                      productivePercentage >= 70 ? 'text-meta-green-600 dark:text-meta-green-400' :
                      productivePercentage >= 40 ? 'text-meta-orange-600 dark:text-meta-orange-400' :
                      'text-meta-red-600 dark:text-meta-red-400'
                    }`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`text-4xl font-bold ${
                    productivePercentage >= 70 ? 'text-meta-green-700 dark:text-meta-green-300' :
                    productivePercentage >= 40 ? 'text-meta-orange-700 dark:text-meta-orange-300' :
                    'text-meta-red-700 dark:text-meta-red-300'
                  }`}>
                    {isNaN(productivePercentage) ? '0' : productivePercentage}%
                  </div>
                </div>
              </div>
              <div className="text-sm text-center font-medium text-meta-gray-600 dark:text-dark-text-secondary">
                {productivePercentage >= 70 ? 'Excellent' :
                 productivePercentage >= 40 ? 'Good' :
                 'Needs Work'}
              </div>
            </div>

            {/* Time Breakdown */}
            <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Productive */}
              <div className="rounded-xl p-4 border bg-white border-meta-green-100 shadow-sm dark:bg-dark-bg-tertiary dark:border-meta-green-900/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs uppercase tracking-wide font-semibold text-meta-green-700 dark:text-meta-green-300">
                    Productive
                  </div>
                  <div className="h-2 w-2 rounded-full bg-meta-green-600 dark:bg-meta-green-400"></div>
                </div>
                <div className="text-2xl font-bold mb-2 text-meta-gray-900 dark:text-dark-text-primary">
                  {Math.floor(productiveTime / 3600)}h {Math.floor((productiveTime % 3600) / 60)}m
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-full h-2 overflow-hidden bg-meta-gray-200 dark:bg-meta-gray-700">
                    <div
                      className="bg-meta-green-600 dark:bg-meta-green-400 h-full transition-all duration-500"
                      style={{ width: `${isNaN(productivePercentage) ? 0 : productivePercentage}%` }}
                    ></div>
                  </div>
                  <span className="font-semibold text-sm text-meta-green-700 dark:text-meta-green-300">
                    {isNaN(productivePercentage) ? 0 : productivePercentage}%
                  </span>
                </div>
              </div>

              {/* Neutral */}
              <div className="rounded-xl p-4 border bg-white border-meta-orange-100 shadow-sm dark:bg-dark-bg-tertiary dark:border-meta-orange-900/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs uppercase tracking-wide font-semibold text-meta-orange-700 dark:text-meta-orange-300">
                    Neutral
                  </div>
                  <div className="h-2 w-2 rounded-full bg-meta-orange-600 dark:bg-meta-orange-400"></div>
                </div>
                <div className="text-2xl font-bold mb-2 text-meta-gray-900 dark:text-dark-text-primary">
                  {Math.floor(neutralTime / 3600)}h {Math.floor((neutralTime % 3600) / 60)}m
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-full h-2 overflow-hidden bg-meta-gray-200 dark:bg-meta-gray-700">
                    <div
                      className="bg-meta-orange-600 dark:bg-meta-orange-400 h-full transition-all duration-500"
                      style={{ width: `${isNaN(neutralPercentage) ? 0 : neutralPercentage}%` }}
                    ></div>
                  </div>
                  <span className="font-semibold text-sm text-meta-orange-700 dark:text-meta-orange-300">
                    {isNaN(neutralPercentage) ? 0 : neutralPercentage}%
                  </span>
                </div>
              </div>

              {/* Distracting */}
              <div className="rounded-xl p-4 border bg-white border-meta-red-100 shadow-sm dark:bg-dark-bg-tertiary dark:border-meta-red-900/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs uppercase tracking-wide font-semibold text-meta-red-700 dark:text-meta-red-300">
                    Distracting
                  </div>
                  <div className="h-2 w-2 rounded-full bg-meta-red-600 dark:bg-meta-red-400"></div>
                </div>
                <div className="text-2xl font-bold mb-2 text-meta-gray-900 dark:text-dark-text-primary">
                  {Math.floor(distractingTime / 3600)}h {Math.floor((distractingTime % 3600) / 60)}m
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-full h-2 overflow-hidden bg-meta-gray-200 dark:bg-meta-gray-700">
                    <div
                      className="bg-meta-red-600 dark:bg-meta-red-400 h-full transition-all duration-500"
                      style={{ width: `${isNaN(distractingPercentage) ? 0 : distractingPercentage}%` }}
                    ></div>
                  </div>
                  <span className="font-semibold text-sm text-meta-red-700 dark:text-meta-red-300">
                    {isNaN(distractingPercentage) ? 0 : distractingPercentage}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Total Screen Time Bar */}
          <div className="mt-3 p-4 rounded-xl border bg-meta-gray-50 border-meta-gray-200 dark:bg-dark-bg-tertiary dark:border-dark-border-primary">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-meta-gray-500 dark:text-dark-text-tertiary">
                Total Screen Time
              </span>
              <span className="text-xl font-bold text-meta-blue-600 dark:text-meta-blue-400">
                {totalTimeFormatted}
              </span>
            </div>
            <div className="relative w-full rounded-full h-2 overflow-hidden bg-meta-gray-200 dark:bg-meta-gray-700">
              <div
                className="absolute top-0 left-0 h-full bg-meta-green-600 dark:bg-meta-green-400 transition-all duration-500"
                style={{ width: `${isNaN(productivePercentage) ? 0 : productivePercentage}%` }}
              ></div>
              <div
                className="absolute top-0 h-full bg-meta-orange-600 dark:bg-meta-orange-400 transition-all duration-500"
                style={{
                  left: `${isNaN(productivePercentage) ? 0 : productivePercentage}%`,
                  width: `${isNaN(neutralPercentage) ? 0 : neutralPercentage}%`
                }}
              ></div>
              <div
                className="absolute top-0 h-full bg-meta-red-600 dark:bg-meta-red-400 transition-all duration-500"
                style={{
                  left: `${(isNaN(productivePercentage) ? 0 : productivePercentage) + (isNaN(neutralPercentage) ? 0 : neutralPercentage)}%`,
                  width: `${isNaN(distractingPercentage) ? 0 : distractingPercentage}%`
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Charts Section - Extra Compact */}
        <div className="mt-5">
          <Tabs defaultValue="categories" className="w-full">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-3 gap-3">
              <TabsList className="p-0.5 w-full lg:w-auto bg-meta-gray-100 border border-meta-gray-200 dark:bg-dark-bg-tertiary dark:border-dark-border-primary rounded-lg">
                <TabsTrigger
                  value="applications"
                  className="text-xs px-3 py-1.5 rounded-md font-medium transition-all text-meta-gray-600 data-[state=active]:bg-meta-blue-500 data-[state=active]:text-white dark:text-dark-text-secondary dark:data-[state=active]:bg-meta-blue-600 dark:data-[state=active]:text-white"
                >
                  Apps
                </TabsTrigger>
                <TabsTrigger
                  value="categories"
                  className="text-xs px-3 py-1.5 rounded-md font-medium transition-all text-meta-gray-600 data-[state=active]:bg-meta-blue-500 data-[state=active]:text-white dark:text-dark-text-secondary dark:data-[state=active]:bg-meta-blue-600 dark:data-[state=active]:text-white"
                >
                  Timeline
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2 text-[10px] font-medium w-full lg:w-auto justify-center lg:justify-end text-meta-gray-600 dark:text-dark-text-secondary">
                <div className="flex items-center gap-1">
                  <div className="h-1 w-1 rounded-full bg-meta-green-500"></div>
                  <span>Productive</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-1 w-1 rounded-full bg-meta-orange-500"></div>
                  <span>Neutral</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-1 w-1 rounded-full bg-meta-red-500"></div>
                  <span>Distracting</span>
                </div>
              </div>
            </div>

            <TabsContent value="applications" className="mt-0">
              <div className="rounded-xl border overflow-hidden h-56 sm:h-64 lg:h-72 flex flex-col bg-white border-meta-gray-200 dark:bg-dark-bg-tertiary dark:border-dark-border-primary">
                <div className="grid grid-cols-12 text-xs p-2 sm:p-3 border-b flex-shrink-0 text-meta-gray-600 border-meta-gray-200 bg-meta-gray-50 dark:text-dark-text-secondary dark:border-dark-border-primary dark:bg-dark-bg-secondary">
                  <div className="col-span-4 sm:col-span-5">Application</div>
                  <div className="col-span-2 hidden sm:block">Category</div>
                  <div className="col-span-3 sm:col-span-2">Time Spent</div>
                  <div className="col-span-3 sm:col-span-2">Productivity</div>
                  <div className="col-span-2 sm:col-span-1">Details</div>
                </div>

                <div className="divide-y divide-meta-gray-200 dark:divide-dark-border-primary overflow-y-auto flex-1 custom-scrollbar">
                  {appsData.map((app) => {
                    const maxAppTime = Math.max(...appsData.map(a => a.time), 1)
                    const timePercent = (app.time / maxAppTime) * 100
                    const isExpanded = expandedApp === app.name
                    const detailsForThisApp = isExpanded ? appDetailedData : []

                    return (
                      <AppUsageRow
                        key={app.name}
                        name={capitalize(app.name)}
                        category={app.category}
                        timeSpent={
                          app.time >= 60
                            ? `${Math.floor(app.time / 60)}h ${app.time % 60}m`
                            : `${app.time}m`
                        }
                        timePercent={timePercent}
                        productivity={app.productivity}
                        isExpanded={isExpanded}
                        detailedData={detailsForThisApp}
                        onToggleDetails={() => handleAppDetailToggle(app.name)}
                      />
                    )
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="categories" className="mt-0">
              <div className="h-80 lg:h-96 w-full relative rounded-xl overflow-hidden border bg-white shadow-sm border-meta-gray-200 dark:bg-dark-bg-tertiary dark:border-dark-border-primary">
                <ProductiveAreaChart
                  data={productiveData}
                  rawData={rawData}
                  selectedDate={selectedDate}
                  onZoomLevelChange={setCurrentZoomLevel}
                  onSelectionChange={handleSelectionChange}
                />
              </div>

              {/* Selected Range Breakdown */}
              <AppUsageDetails
                selectedApps={selectedApps}
                selectedRange={selectedRange}
                zoomLevel={currentZoomLevel}
                isVisible={showAppDetails}
                onCategoryChange={handleCategoryChange}
                onClose={() => setShowAppDetails(false)}
              />

            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  )
}

// App usage row component
function AppUsageRow({ name, category, timeSpent, timePercent = 100, productivity, isExpanded, detailedData = [], onToggleDetails }) {
  const getProductivityColor = () => {
    switch (productivity) {
      case 'Productive':
        return 'bg-meta-green-50 text-meta-green-600 border-meta-green-200 dark:bg-meta-green-500/10 dark:text-meta-green-400 dark:border-meta-green-500/30'
      case 'Neutral':
        return 'bg-meta-orange-50 text-meta-orange-600 border-meta-orange-200 dark:bg-meta-orange-500/10 dark:text-meta-orange-400 dark:border-meta-orange-500/30'
      case 'Distracting':
        return 'bg-meta-red-50 text-meta-red-600 border-meta-red-200 dark:bg-meta-red-500/10 dark:text-meta-red-400 dark:border-meta-red-500/30'
      default:
        return 'bg-meta-gray-50 text-meta-gray-600 border-meta-gray-200 dark:bg-meta-gray-500/10 dark:text-meta-gray-400 dark:border-meta-gray-500/30'
    }
  }

  // Prefer showing domain names in breakdown when available
  const formatDomain = (domain) => {
    if (!domain || typeof domain !== 'string') return ''
    try {
      let d = domain.trim()
      
      // Handle special schemes
      if (d.startsWith('chrome://') || d.startsWith('edge://') || d.startsWith('brave://')) {
        return d.split('://')[1].split('/')[0] || d
      }
      
      // Remove protocol
      d = d.replace(/^https?:\/\//i, '')
      d = d.replace(/^ftp:\/\//i, '')
      
      // Remove www prefix
      d = d.replace(/^www\./i, '')
      
      // Remove path, query, and hash
      d = d.split('/')[0]
      d = d.split('?')[0]
      d = d.split('#')[0]
      
      // Remove port if present
      d = d.split(':')[0]
      
      return d || domain
    } catch (e) {
      return domain
    }
  }

  return (
    <div>
      {/* Main Row */}
      <div className="grid grid-cols-12 py-2 px-2 sm:px-3 text-xs sm:text-sm hover:bg-meta-gray-50 dark:hover:bg-dark-bg-hover">
        <div className="col-span-4 sm:col-span-5 text-meta-gray-800 dark:text-dark-text-primary truncate pr-1">{name}</div>
        <div className="col-span-2 text-meta-gray-600 dark:text-dark-text-secondary hidden sm:block truncate">{category}</div>
        <div className="col-span-3 sm:col-span-2 text-meta-blue-600 dark:text-meta-blue-400">{timeSpent}</div>
        <div className="col-span-3 sm:col-span-2">
          <Badge variant="outline" className={`${getProductivityColor()} text-xs`}>
            <span className="hidden sm:inline">{productivity}</span>
            <span className="sm:hidden">
              {productivity === 'Productive' ? 'P' : productivity === 'Neutral' ? 'N' : 'D'}
            </span>
          </Badge>
        </div>
        <div className="col-span-2 sm:col-span-1 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-meta-gray-500 dark:text-dark-text-secondary hover:text-meta-blue-600 dark:hover:text-meta-blue-400"
            onClick={onToggleDetails}
            title={isExpanded ? 'Hide details' : 'Show details'}
          >
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Inline Breakdown - Minimalistic */}
      {isExpanded && detailedData.length > 0 && (
        <div className="bg-meta-gray-50 dark:bg-dark-bg-secondary px-4 sm:px-6 py-2 border-t border-meta-gray-200 dark:border-dark-border-primary">
          <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
            {detailedData.map((detail, index) => (
              <div key={index} className="flex items-center justify-between py-1.5 text-xs">
                <div className="flex-1 text-meta-gray-700 dark:text-dark-text-secondary truncate pr-3 pl-4">
                  <span className="text-meta-gray-400 dark:text-meta-gray-600 mr-2">└</span>
                  {formatDomain(detail.domain) || detail.name}
                </div>
                <div className="text-meta-blue-600 dark:text-meta-blue-400 font-mono text-xs">
                  {detail.time >= 60
                    ? `${Math.floor(detail.time / 60)}h ${detail.time % 60}m`
                    : `${detail.time}m`
                  }
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-meta-gray-500 mt-2 pl-4">
            {detailedData.length} {detailedData.length === 1 ? 'entry' : 'entries'}
          </div>
        </div>
      )}
    </div>
  )
}

// Category chart component
function CategoryChart() {
  return (
    <div className="h-full w-full flex items-center justify-center p-4">
      <div className="w-full h-full flex items-center justify-center">
        <div className="relative w-48 h-48">
          {/* Development - 45% */}
          <div className="absolute inset-0 bg-meta-blue-500/20 rounded-full"></div>
          <div
            className="absolute inset-0 bg-meta-blue-500 rounded-full"
            style={{ clipPath: 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 50% 100%)' }}
          ></div>

          {/* Office - 20% */}
          <div
            className="absolute inset-0 bg-meta-blue-400 rounded-full"
            style={{ clipPath: 'polygon(50% 50%, 100% 100%, 50% 100%)' }}
          ></div>

          {/* Communication - 15% */}
          <div
            className="absolute inset-0 bg-meta-blue-600 rounded-full"
            style={{ clipPath: 'polygon(50% 50%, 50% 100%, 0% 100%, 0% 70%)' }}
          ></div>

          {/* Entertainment - 10% */}
          <div
            className="absolute inset-0 bg-meta-red-500 rounded-full"
            style={{ clipPath: 'polygon(50% 50%, 0% 70%, 0% 30%)' }}
          ></div>

          {/* Social Media - 5% */}
          <div
            className="absolute inset-0 bg-meta-orange-500 rounded-full"
            style={{ clipPath: 'polygon(50% 50%, 0% 30%, 0% 0%, 20% 0%)' }}
          ></div>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white dark:bg-dark-bg-primary rounded-full w-24 h-24 flex flex-col items-center justify-center">
              <div className="text-xs text-meta-gray-500 dark:text-dark-text-tertiary">Total Time</div>
              <div className="text-lg font-mono text-meta-blue-600 dark:text-meta-blue-400">6h 05m</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Timeline chart component
function TimelineChart() {
  return (
    <div className="h-full w-full flex items-end justify-between px-4 pt-4 pb-8 relative">
      {/* Y-axis labels */}
      <div className="absolute left-2 top-0 h-full flex flex-col justify-between py-4">
        <div className="text-xs text-meta-gray-500">High</div>
        <div className="text-xs text-meta-gray-500">Medium</div>
        <div className="text-xs text-meta-gray-500">Low</div>
      </div>

      {/* X-axis grid lines */}
      <div className="absolute left-0 right-0 top-0 h-full flex flex-col justify-between py-4 px-10">
        <div className="border-b border-meta-gray-200 dark:border-dark-border-primary w-full"></div>
        <div className="border-b border-meta-gray-200 dark:border-dark-border-primary w-full"></div>
        <div className="border-b border-meta-gray-200 dark:border-dark-border-primary w-full"></div>
      </div>

      {/* Chart bars */}
      <div className="flex-1 h-full flex items-end justify-between px-2 z-10">
        {[
          { time: '08:00', height: 30, color: 'orange' },
          { time: '09:00', height: 50, color: 'blue' },
          { time: '10:00', height: 90, color: 'blue' },
          { time: '11:00', height: 85, color: 'blue' },
          { time: '12:00', height: 40, color: 'orange' },
          { time: '13:00', height: 30, color: 'orange' },
          { time: '14:00', height: 70, color: 'blue' },
          { time: '15:00', height: 75, color: 'blue' },
          { time: '16:00', height: 60, color: 'blue' },
          { time: '17:00', height: 40, color: 'orange' },
          { time: '18:00', height: 20, color: 'red' },
          { time: '19:00', height: 10, color: 'red' }
        ].map((item, i) => (
          <div key={i} className="flex flex-col items-center">
            <div
              className={`w-6 rounded-t-sm ${
                item.color === 'blue' ? 'bg-meta-blue-500' :
                item.color === 'orange' ? 'bg-meta-orange-500' :
                'bg-meta-red-500'
              }`}
              style={{ height: `${item.height}%` }}
            ></div>
            <div className="text-xs text-meta-gray-500 mt-2">{item.time}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
