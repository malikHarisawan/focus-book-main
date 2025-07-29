import React, { useState, useEffect } from 'react'
import UsageChart from './UsageChart'
import MostUsedList from './MostUsedList'
import ProductiveAreaChart from './Dashboard/ProductiveAreaChart '
import {
  processUsageChartData,
  processMostUsedApps,
  getTotalScreenTime,
  getCategoryBreakdown,
  processProductiveChartData
} from '../utils/dataProcessor'

const ScreenTimePage = () => {
  const [view, setView] = useState('day')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [chartData, setChartData] = useState([])
  const [appsData, setAppsData] = useState([])
  const [totalTime, setTotalTime] = useState('0h 0m')
  const [categories, setCategories] = useState([])
  const [showProductiveChart, setShowProductiveChart] = useState(false)
  const [productiveData, setProductiveData] = useState([])

  useEffect(() => {
    loadAndProcessData()
  }, [selectedDate, view])

  const loadAndProcessData = async () => {
    try {
      const jsonData = await window.activeWindow.getAppUsageStats()
      const processedChartData = processUsageChartData(jsonData, selectedDate, view)
      setChartData(processedChartData)

      const processedProductiveChartData = processProductiveChartData(jsonData, selectedDate, view)
      setProductiveData(processedProductiveChartData)

      const processedAppsData = processMostUsedApps(jsonData, selectedDate)
      setAppsData(processedAppsData)
      const screenTime = getTotalScreenTime(jsonData, selectedDate, processedChartData, view)
      setTotalTime(screenTime)

      const categoryData = getCategoryBreakdown(jsonData, selectedDate)
      setCategories(categoryData)

      console.log('Data loaded for date:', selectedDate)
    } catch (error) {
      console.error('Error processing app usage data:', error)
    }
  }

  const handleDateChange = (change) => {
    const currentDate = new Date(selectedDate)
    const increment = view === 'week' ? change * 7 : change
    currentDate.setDate(currentDate.getDate() + increment)
    setSelectedDate(currentDate.toISOString().split('T')[0])
  }

  const dateString = new Date(selectedDate).toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex space-x-4">
          <button
            onClick={() => setView('week')}
            className={`${view === 'week' ? 'text-blue-400 border-b border-blue-400' : ''} pb-1`}
          >
            Weekly
          </button>
          <button
            onClick={() => setView('day')}
            className={`${view === 'day' ? 'text-blue-400 border-b border-blue-400' : ''} pb-1`}
          >
            Daily
          </button>
        </div>
        <div className="flex space-x-2">
          <button onClick={() => handleDateChange(-1)} className="text-gray-400">
            ←
          </button>
          <button className="text-blue-400">{view === 'week' ? 'Weekly' : 'Daily'}</button>
          <button onClick={() => handleDateChange(1)} className="text-gray-400">
            →
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold">{dateString}</h2>
        {view == 'week' ? (
          <div className="flex items-center gap-2">
            <p className="text-xl font-bold mt-1">Daily Average </p>
            <p className="text-xl font-bold mt-1">{totalTime}</p>
          </div>
        ) : (
          <p className="text-3xl font-bold mt-1">{totalTime}</p>
        )}

        <button
          onClick={() => setShowProductiveChart(!showProductiveChart)}
          className={'text-blue-400 mt-3'}
        >
          {showProductiveChart ? 'Show Hourly Bar Chart' : 'Show Productive Chart'}
        </button>
      </div>

      <div>
        {showProductiveChart ? (
          <ProductiveAreaChart data={productiveData} />
        ) : (
          <UsageChart data={chartData} /> // your current bar chart component
        )}
      </div>

      <div className="flex flex-wrap gap-4 mt-4">
        {categories.map((cat) => (
          <div key={cat.name} className="text-sm">
            <p className={`${cat.color} font-semibold`}>{cat.name}</p>
            <p>{cat.time}</p>
          </div>
        ))}
      </div>
      {console.log('appsData', appsData)}
      <MostUsedList apps={appsData} />

      <p className="text-xs text-gray-400 mt-4">
        Updated today at {new Date().toLocaleTimeString()}
      </p>
    </div>
  )
}

export default ScreenTimePage
