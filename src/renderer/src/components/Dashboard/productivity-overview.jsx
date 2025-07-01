import { useEffect, useState } from 'react'
import { Activity, Clock, Flame, LineChart, RefreshCw, Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { MetricCard } from './metric-card'
import { TrendingDown, TrendingUp, Calendar } from '../shared/icons'
import ProductiveAreaChart from './ProductiveAreaChart '
import StatCard from './StatCard'
import { useDate } from '../../context/DateContext'
import {
  processUsageChartData,
  processMostUsedApps,
  getTotalFocusTime,
  getCategoryBreakdown,
  processProductiveChartData,
  getTotalScreenTime,
  formatAppsData
} from '../../utils/dataProcessor'
export default function ProductivityOverview() {
  const [view, setView] = useState('day')
  const [chartData, setChartData] = useState([])
  const [appsData, setAppsData] = useState([])
  const [focusTime, setFocusTime] = useState(0)
  const [totalTime, setTotalTime] = useState('')
  const [apps, setApps] = useState([])
  const { selectedDate, handleDateChange } = useDate()
  const [productivityScore, setProductivityScore] = useState(85)
  const [streakDays, setStreakDays] = useState(5)
  const [productiveData, setProductiveData] = useState([])

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
  }, [selectedDate])
  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      loadAndProcessData()
    }
  }
  const loadAndProcessData = async () => {
    const jsonData = await window.activeWindow.getAppUsageStats()
    const appsData = formatAppsData(jsonData, selectedDate)
    setApps(appsData)
    const processedChartData = processUsageChartData(jsonData, selectedDate, view)
    setChartData(processedChartData)

    const processedProductiveChartData = processProductiveChartData(jsonData, selectedDate, view)
    console.log('Area Chart data', processedProductiveChartData)
    setProductiveData(processedProductiveChartData)

    const processedAppsData = processMostUsedApps(jsonData, selectedDate)
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
    .filter((app) => app.productivity === 'Productive')
    .reduce((total, app) => total + app.timeSpentSeconds, 0)

  const neutralTime = apps
    .filter((app) => app.productivity === 'Neutral' || app.productivity === 'Un-Productive')
    .reduce((total, app) => total + app.timeSpentSeconds, 0)

  const distractingTime = apps
    .filter((app) => app.productivity === 'Distracting')
    .reduce((total, app) => total + app.timeSpentSeconds, 0)
  const productivePercentage = Math.round((productiveTime / totalTimeSeconds) * 100)
  const neutralPercentage = Math.round((neutralTime / totalTimeSeconds) * 100)
  const distractingPercentage = Math.round((distractingTime / totalTimeSeconds) * 100)

  return (
    <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm overflow-hidden">
      <CardHeader className="border-b border-slate-700/50 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 flex items-center">
            <Activity className="mr-2 h-5 w-5 text-cyan-500" />
            Productivity Overview
          </CardTitle>
          <div className="flex items-center space-x-2">
            <div className="relative inline-flex items-center bg-slate-800/50 text-cyan-400 border border-cyan-500/50 text-xs px-2 py-1 rounded-md">
              <input
                type="date"
                value={selectedDate}
                onChange={handleDate}
                className="bg-transparent text-cyan-400 outline-none text-xs"
              />

              <Calendar className="absolute right-2 w-4 h-4 text-cyan-400 pointer-events-none" />
            </div>
            <Button
              onClick={loadAndProcessData}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Productive Time"
            value={`${Math.floor(productiveTime / 3600)}h ${Math.floor((productiveTime % 3600) / 60)}m`}
            percentage={productivePercentage}
            color="green"
          />
          <StatCard
            title="Neutral Time"
            value={`${Math.floor(neutralTime / 3600)}h ${Math.floor((neutralTime % 3600) / 60)}m`}
            percentage={neutralPercentage}
            color="blue"
          />
          <StatCard title="Total Time" value={totalTimeFormatted} />
          {/* <MetricCard
            title="Streak"
            value={streakDays}
            icon={Trophy}
            trend="up"
            color="blue"
            detail="Consecutive productive days"
            suffix="days"
          /> */}
        </div>

        <div className=" mt-8">
          <Tabs defaultValue="categories" className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList className="bg-slate-800/50 p-1">
                <TabsTrigger
                  value="categories"
                  className="data-[state=active]:bg-slate-700 data-[state=active]:text-cyan-400"
                >
                  Productivity
                </TabsTrigger>
                <TabsTrigger
                  value="applications"
                  className="data-[state=active]:bg-slate-700 data-[state=active]:text-cyan-400"
                >
                  Applications
                </TabsTrigger>

                {/* <TabsTrigger
                  value="timeline"
                  className="data-[state=active]:bg-slate-700 data-[state=active]:text-cyan-400"
                >
                  Timeline
                </TabsTrigger> */}
              </TabsList>

              <div className="flex items-center space-x-2 text-xs text-slate-400">
                <div className="flex items-center">
                  <div className="h-2 w-2 rounded-full bg-green-500 mr-1"></div>
                  Productive
                </div>
                <div className="flex items-center">
                  <div className="h-2 w-2 rounded-full bg-amber-500 mr-1"></div>
                  Neutral
                </div>
                <div className="flex items-center">
                  <div className="h-2 w-2 rounded-full bg-red-500 mr-1"></div>
                  Distracting
                </div>
              </div>
            </div>

            <TabsContent value="categories" className="mt-0">
              <div className="h-full w-full relative bg-slate-800/30 rounded-lg border border-slate-700/50 overflow-hidden">
                <ProductiveAreaChart data={productiveData} />
              </div>
            </TabsContent>
            <TabsContent value="applications" className=" mt-0">
              <div className="bg-slate-800/30 rounded-lg border border-slate-700/50 overflow-hidden">
                <div className="grid grid-cols-12 text-xs text-slate-400 p-3 border-b border-slate-700/50 bg-slate-800/50">
                  <div className="col-span-5">Application</div>
                  <div className="col-span-2">Category</div>
                  <div className="col-span-2">Time Spent</div>
                  <div className="col-span-2">Productivity</div>
                  <div className="col-span-1">Trend</div>
                </div>

                <div className="divide-y divide-slate-700/30">
                  {appsData.map((app) => (
                    <AppUsageRow
                      key={app.name}
                      name={capitalize(app.name)}
                      category={app.category}
                      timeSpent={
                        app.time >= 60
                          ? `${Math.floor(app.time / 60)}h ${app.time % 60}m`
                          : `${app.time}m`
                      }
                      productivity={app.productivity}
                      trend={app.productivity == 'Productive' ? 'up' : 'down'}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="timeline" className="mt-0">
              <div className="h-64 w-full relative bg-slate-800/30 rounded-lg border border-slate-700/50 overflow-hidden">
                <TimelineChart />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  )
}

// App usage row component
function AppUsageRow({ name, category, timeSpent, productivity, trend }) {
  const getProductivityColor = () => {
    switch (productivity) {
      case 'Productive':
        return 'bg-green-500/10 text-green-400 border-green-500/30'
      case 'Neutral':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      case 'Distracting':
        return 'bg-red-500/10 text-red-400 border-red-500/30'
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30'
    }
  }

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      case 'stable':
        return <LineChart className="h-4 w-4 text-blue-500" />
      default:
        return null
    }
  }

  return (
    <div className="grid grid-cols-12 py-2 px-3 text-sm hover:bg-slate-800/50">
      <div className="col-span-5 text-slate-300">{name}</div>
      <div className="col-span-2 text-slate-400">{category}</div>
      <div className="col-span-2 text-cyan-400">{timeSpent}</div>
      <div className="col-span-2">
        <Badge variant="outline" className={`${getProductivityColor()} text-xs`}>
          {productivity}
        </Badge>
      </div>
      <div className="col-span-1 flex justify-center">{getTrendIcon()}</div>
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
          <div className="absolute inset-0 bg-cyan-500/20 rounded-full"></div>
          <div
            className="absolute inset-0 bg-cyan-500 rounded-full"
            style={{ clipPath: 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 50% 100%)' }}
          ></div>

          {/* Office - 20% */}
          <div
            className="absolute inset-0 bg-blue-500 rounded-full"
            style={{ clipPath: 'polygon(50% 50%, 100% 100%, 50% 100%)' }}
          ></div>

          {/* Communication - 15% */}
          <div
            className="absolute inset-0 bg-purple-500 rounded-full"
            style={{ clipPath: 'polygon(50% 50%, 50% 100%, 0% 100%, 0% 70%)' }}
          ></div>

          {/* Entertainment - 10% */}
          <div
            className="absolute inset-0 bg-red-500 rounded-full"
            style={{ clipPath: 'polygon(50% 50%, 0% 70%, 0% 30%)' }}
          ></div>

          {/* Social Media - 5% */}
          <div
            className="absolute inset-0 bg-amber-500 rounded-full"
            style={{ clipPath: 'polygon(50% 50%, 0% 30%, 0% 0%, 20% 0%)' }}
          ></div>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-slate-900/80 rounded-full w-24 h-24 flex flex-col items-center justify-center">
              <div className="text-xs text-slate-400">Total Time</div>
              <div className="text-lg font-mono text-cyan-400">6h 05m</div>
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
        <div className="text-xs text-slate-500">High</div>
        <div className="text-xs text-slate-500">Medium</div>
        <div className="text-xs text-slate-500">Low</div>
      </div>

      {/* X-axis grid lines */}
      <div className="absolute left-0 right-0 top-0 h-full flex flex-col justify-between py-4 px-10">
        <div className="border-b border-slate-700/30 w-full"></div>
        <div className="border-b border-slate-700/30 w-full"></div>
        <div className="border-b border-slate-700/30 w-full"></div>
      </div>

      {/* Chart bars */}
      <div className="flex-1 h-full flex items-end justify-between px-2 z-10">
        {[
          { time: '08:00', height: 30, color: 'amber' },
          { time: '09:00', height: 50, color: 'blue' },
          { time: '10:00', height: 90, color: 'cyan' },
          { time: '11:00', height: 85, color: 'cyan' },
          { time: '12:00', height: 40, color: 'amber' },
          { time: '13:00', height: 30, color: 'amber' },
          { time: '14:00', height: 70, color: 'blue' },
          { time: '15:00', height: 75, color: 'blue' },
          { time: '16:00', height: 60, color: 'blue' },
          { time: '17:00', height: 40, color: 'amber' },
          { time: '18:00', height: 20, color: 'red' },
          { time: '19:00', height: 10, color: 'red' }
        ].map((item, i) => (
          <div key={i} className="flex flex-col items-center">
            <div
              className={`w-6 bg-gradient-to-t from-${item.color}-500 to-${item.color}-400 rounded-t-sm`}
              style={{ height: `${item.height}%` }}
            ></div>
            <div className="text-xs text-slate-500 mt-2">{item.time}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
