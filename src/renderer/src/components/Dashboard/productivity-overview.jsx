import { useEffect, useState } from 'react'
import { Activity, Clock, Flame, LineChart, RefreshCw, Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { MetricCard } from './metric-card'
import { TrendingDown, TrendingUp, Calendar } from '../shared/icons'
import ProductiveAreaChart from './ProductiveAreaChart'
import StatCard from './StatCard'
import SmartDatePicker from '../shared/smart-date-picker'
import AppUsageDetails from './AppUsageDetails'
import GettingStartedCard from '../Onboarding/GettingStartedCard'
import { useDate } from '../../context/DateContext'
import {
  processUsageChartData,
  getTotalFocusTime,
  getCategoryBreakdown,
  processProductiveChartData,
  getTotalScreenTime,
  getProductivityTotals,
  refreshCategoryMapping
} from '../../utils/dataProcessor'
export default function ProductivityOverview() {
  // These hour-resolution chart helpers take a legacy per-hour 'day' view; the
  // real day/week/month switching is driven by the chart's zoom (currentZoomLevel).
  const view = 'day'
  const [chartData, setChartData] = useState([])
  const [focusTime, setFocusTime] = useState(0)
  const [totalTime, setTotalTime] = useState('')
  const [rawData, setRawData] = useState(null)
  const [currentZoomLevel, setCurrentZoomLevel] = useState('hour')
  const { selectedDate, handleDateChange } = useDate()
  const [productivityScore, setProductivityScore] = useState(85)
  const [streakDays, setStreakDays] = useState(5)
  const [productiveData, setProductiveData] = useState([])
  const [selectedApps, setSelectedApps] = useState([])
  const [selectedRange, setSelectedRange] = useState(null)
  const [showAppDetails, setShowAppDetails] = useState(false)

  const handleDate = (e) => {
    handleDateChange(e.target.value)
  }

  useEffect(() => {
    loadAndProcessData()
    handleVisibilityChange()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Listen for category updates from Activity page
    const removeCategoryListener = window.activeWindow.onCategoryUpdated((data) => {
      console.log('Dashboard received category update:', data)
      loadAndProcessData()
    })
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      // Clean up the category update listener
      if (removeCategoryListener) {
        removeCategoryListener()
      }
    }
  }, [selectedDate])
  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      loadAndProcessData()
    }
  }
  const loadAndProcessData = async () => {
    // Ensure the DB-driven category productivity map is populated before any
    // processing function reads it, otherwise the first render races the
    // import-time load and shows everything as Neutral.
    await refreshCategoryMapping()
    const jsonData = await window.activeWindow.getAppUsageStats()
    console.log('📊 Raw JSON Data:', jsonData)
    console.log('📅 Selected Date:', selectedDate)
    console.log('📅 Available dates in data:', jsonData ? Object.keys(jsonData) : 'No data')
    setRawData(jsonData)
    const processedChartData = processUsageChartData(jsonData, selectedDate, view)
    setChartData(processedChartData)

    const processedProductiveChartData = processProductiveChartData(jsonData, selectedDate, 'hour')
    console.log('📈 Area Chart data:', processedProductiveChartData)
    console.log('📈 Data length:', processedProductiveChartData ? processedProductiveChartData.length : 0)
    setProductiveData(processedProductiveChartData)

    const focTime = getTotalFocusTime(jsonData, selectedDate, processedChartData, view)
    console.log('focustime', focTime)
    setFocusTime(focTime)

    const screenTime = getTotalScreenTime(jsonData, selectedDate, processedChartData, view)
    console.log('screenTime', screenTime)
    setTotalTime(screenTime)
  }
  // Summary cards reflect the CURRENT view (day/week/month) via the chart's zoom
  // level, not just the selected day. getProductivityTotals aggregates over the
  // same date window the area chart draws, so the numbers always agree.
  const { productiveSeconds, neutralSeconds, distractingSeconds, totalSeconds } =
    getProductivityTotals(rawData, selectedDate, currentZoomLevel)

  const totalTimeSeconds = totalSeconds
  const productiveTime = productiveSeconds
  const neutralTime = neutralSeconds
  const distractingTime = distractingSeconds

  const totalHours = Math.floor(totalTimeSeconds / 3600)
  const totalMinutes = Math.floor((totalTimeSeconds % 3600) / 60)
  const totalTimeFormatted = `${totalHours}h ${totalMinutes}m`

  // Round the three shares with the largest-remainder method so they always add
  // up to exactly 100% (independent Math.round calls can drift to 99% or 101%).
  const [productivePercentage, neutralPercentage, distractingPercentage] = (() => {
    if (!totalTimeSeconds) return [0, 0, 0]
    const raw = [productiveTime, neutralTime, distractingTime].map((t) => (t / totalTimeSeconds) * 100)
    const floors = raw.map((v) => Math.floor(v))
    let remainder = 100 - floors.reduce((a, b) => a + b, 0)
    // Hand the leftover points to the largest fractional parts first.
    const order = raw
      .map((v, i) => ({ i, frac: v - floors[i] }))
      .sort((a, b) => b.frac - a.frac)
    for (let k = 0; k < order.length && remainder > 0; k++, remainder--) {
      floors[order[k].i] += 1
    }
    return floors
  })()

  // Handle selection changes from ProductiveAreaChart
  const handleSelectionChange = (apps, range) => {
    setSelectedApps(apps || [])
    setSelectedRange(range)
    // Show app details when a selection is made
    if (apps && apps.length > 0) {
      setShowAppDetails(true)
    }
  }

  // Persist a category change for an app from the timeline breakdown panel.
  // Creates/updates a classification rule and retags matching history (same
  // rule-based flow as the Activity page), so the change persists instead of
  // being overwritten by the next tracking tick. Then reloads the view.
  const handleCategoryChange = async (app, newCategory) => {
    try {
      if (!app || !newCategory) return
      const result = await window.activeWindow.retagAppCategory(app, newCategory)
      if (!result?.success) throw new Error(result?.error || 'Retag failed')
      await refreshCategoryMapping()
      await loadAndProcessData()
    } catch (error) {
      console.error('Error changing category from dashboard:', error)
    }
  }

  return (
    <Card className="bg-white border-[#E8EDF1] shadow-sm dark:bg-[#0B1220] dark:border-[#1E293B] backdrop-blur-sm overflow-hidden transition-colors">
      <CardHeader className="border-b bg-white border-[#E8EDF1] dark:bg-[#0B1220] dark:border-[#1E293B] py-2 px-3">
        <div className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-[#232360] dark:text-white flex items-center font-medium tracking-tight">
            <Activity className="mr-2 h-5 w-5 text-[#5051F9] flex-shrink-0" />
            <span>Productivity Overview</span>
          </CardTitle>
          <div className="flex items-center gap-2 flex-shrink-0">
            <SmartDatePicker zoomLevel={currentZoomLevel} onDateChange={loadAndProcessData} />
            <Button
              onClick={loadAndProcessData}
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-[#768396] hover:text-[#232360] hover:bg-[#F4F7FE] dark:text-[#94A3B8] dark:hover:text-white dark:hover:bg-[#1E293B] flex-shrink-0 transition-colors"
              title="Refresh data"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2 dark:bg-[#05070D] bg-[#F4F7FE]">
        {/* First-run getting-started checklist (self-hides when dismissed/done) */}
        <GettingStartedCard />

        {/* Summary Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <StatCard
            title="Productive Time"
            value={`${Math.floor(productiveTime / 3600)}h ${Math.floor((productiveTime % 3600) / 60)}m`}
            percentage={isNaN(productivePercentage) ? 0 : productivePercentage}
            color="green"
          />
          <StatCard
            title="Neutral Time"
            value={`${Math.floor(neutralTime / 3600)}h ${Math.floor((neutralTime % 3600) / 60)}m`}
            percentage={isNaN(neutralPercentage) ? 0 : neutralPercentage}
            color="blue"
          />
          <StatCard
            title="Distracting Time"
            value={`${Math.floor(distractingTime / 3600)}h ${Math.floor((distractingTime % 3600) / 60)}m`}
            percentage={isNaN(distractingPercentage) ? 0 : distractingPercentage}
            color="red"
          />
          <StatCard title="Total Time" value={totalTimeFormatted} />
        </div>

        {/* Charts Section */}
        <div className="mt-2">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-2 gap-2">
            <h3 className="text-sm font-medium text-[#232360] dark:text-white">Timeline</h3>

            <div className="flex items-center gap-3 text-xs font-normal w-full lg:w-auto justify-center lg:justify-end text-[#768396] dark:text-[#94A3B8]">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-[#5051F9] dark:bg-[#22D3EE]"></div>
                <span>Productive</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-[#FF6B6B]"></div>
                <span>Distracting</span>
              </div>
            </div>
          </div>

          <div className="h-[280px] w-full relative rounded-2xl overflow-hidden bg-white dark:bg-[#0B1220] border border-[#E8EDF1] dark:border-[#1E293B]">
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
        </div>
      </CardContent>
    </Card>
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
