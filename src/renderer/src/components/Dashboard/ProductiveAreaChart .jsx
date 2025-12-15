import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea
} from 'recharts'
import { ZoomIn, ZoomOut, RotateCcw, Info, ChevronRight, HelpCircle } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

const ProductiveAreaChart = ({ data, rawData, selectedDate, onZoomLevelChange }) => {
  // Get current theme
  const { resolvedTheme } = useTheme()

  // Theme-aware colors - Exact Figma color palette
  const chartColors = {
    productive: '#5051F9', // Primary purple - for productive time
    unproductive: '#FF6B6B', // Red/Salmon - for unproductive/distracting time
    neutral: '#1EA7FF', // Cyan blue - for neutral
    selection: '#5051F9', // Selection same as primary
    grid: resolvedTheme === 'dark' ? '#282932' : '#E8EDF1',
    text: resolvedTheme === 'dark' ? '#898999' : '#768396',
    bg: resolvedTheme === 'dark' ? '#212329' : '#ffffff',
    bgSecondary: resolvedTheme === 'dark' ? '#282932' : '#F4F7FE',
    border: resolvedTheme === 'dark' ? '#282932' : '#E8EDF1',
  }
  const [selectedRange, setSelectedRange] = useState(null)
  const [aggregatedData, setAggregatedData] = useState({ productive: 0, unproductive: 0, total: 0 })
  const [dragStart, setDragStart] = useState(null)
  const [dragEnd, setDragEnd] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [zoomLevel, setZoomLevel] = useState('hour')
  const [currentData, setCurrentData] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const chartRef = useRef(null)
  const containerRef = useRef(null)

  // Function declarations first
  const updateDataForZoomLevel = async () => {
    if (!rawData || !selectedDate) return

    setIsLoading(true)
    try {
      const { processProductiveChartData } = await import('../../utils/dataProcessor')
      const newData = processProductiveChartData(rawData, selectedDate, zoomLevel)
      setCurrentData(newData)
    } catch (error) {
      console.error('Error updating zoom data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const calculateAggregatedData = () => {
    let startIndex = 0
    let endIndex = currentData.length - 1

    if (selectedRange) {
      startIndex = selectedRange.startIndex
      endIndex = selectedRange.endIndex
    }

    let totalProductive = 0
    let totalUnproductive = 0

    for (let i = startIndex; i <= endIndex; i++) {
      if (currentData[i]) {
        totalProductive += currentData[i].productive || 0
        totalUnproductive += currentData[i].unproductive || 0
      }
    }

    setAggregatedData({
      productive: totalProductive,
      unproductive: totalUnproductive,
      total: totalProductive + totalUnproductive
    })
  }

  const clearSelection = () => {
    setSelectedRange(null)
    setDragStart(null)
    setDragEnd(null)
    setIsDragging(false)
  }

  const zoomIn = () => {
    const levels = ['month', 'week', 'day', 'hour']
    const currentIndex = levels.indexOf(zoomLevel)
    if (currentIndex < levels.length - 1) {
      const newLevel = levels[currentIndex + 1]
      setZoomLevel(newLevel)
      onZoomLevelChange?.(newLevel)
      clearSelection()
    }
  }

  const zoomOut = () => {
    const levels = ['month', 'week', 'day', 'hour']
    const currentIndex = levels.indexOf(zoomLevel)
    if (currentIndex > 0) {
      const newLevel = levels[currentIndex - 1]
      setZoomLevel(newLevel)
      onZoomLevelChange?.(newLevel)
      clearSelection()
    }
  }

  const resetZoom = () => {
    setZoomLevel('hour')
    onZoomLevelChange?.('hour')
    clearSelection()
  }

  const getZoomLevelDisplay = () => {
    const displays = {
      hour: { label: '9AM - 9PM', detail: 'Hourly view (12 hours)' },
      day: { label: '24 Hours', detail: 'Full day view (24 hours)' },
      week: { label: '7 Days', detail: 'Weekly view (7 days)' },
      month: { label: '30 Days', detail: 'Monthly view (30 days)' }
    }
    return displays[zoomLevel] || { label: '', detail: '' }
  }

  const getZoomProgress = () => {
    const levels = ['month', 'week', 'day', 'hour']
    const currentIndex = levels.indexOf(zoomLevel)
    return ((currentIndex + 1) / levels.length) * 100
  }

  const getBreadcrumbPath = () => {
    const levels = ['month', 'week', 'day', 'hour']
    const currentIndex = levels.indexOf(zoomLevel)
    return levels.slice(0, currentIndex + 1)
  }

  // Effects after function declarations
  useEffect(() => {
    if (data && data.length > 0) {
      setCurrentData(data)
    }
  }, [data])

  useEffect(() => {
    // Notify parent of initial zoom level
    onZoomLevelChange?.(zoomLevel)
  }, [])

  useEffect(() => {
    if (rawData && selectedDate) {
      updateDataForZoomLevel()
    }
  }, [zoomLevel, rawData, selectedDate])

  useEffect(() => {
    if (currentData && currentData.length > 0) {
      calculateAggregatedData()
    }
  }, [currentData, selectedRange])

  const handleClickOutside = useCallback(
    (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target) && selectedRange) {
        clearSelection()
      }
    },
    [selectedRange]
  )

  const handleWheel = useCallback(
    (e) => {
      if (containerRef.current && containerRef.current.contains(e.target)) {
        e.preventDefault()
        if (e.deltaY < 0) {
          zoomIn()
        } else {
          zoomOut()
        }
      }
    },
    [zoomLevel]
  )

  const handleKeyDown = useCallback(
    (e) => {
      if (containerRef.current && containerRef.current.contains(document.activeElement)) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault()
          zoomIn()
        } else if (e.key === '-') {
          e.preventDefault()
          zoomOut()
        } else if (e.key === '0') {
          e.preventDefault()
          resetZoom()
        }
      }
    },
    [zoomLevel]
  )

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('wheel', handleWheel, { passive: false })
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('wheel', handleWheel)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleClickOutside, handleWheel, handleKeyDown])

  const handleMouseDown = (e) => {
    if (e && e.activeLabel) {
      setDragStart(e.activeLabel)
      setIsDragging(true)
      setDragEnd(null)
    }
  }

  const handleMouseMove = (e) => {
    if (isDragging && e && e.activeLabel) {
      setDragEnd(e.activeLabel)
    }
  }

  const handleMouseUp = () => {
    if (isDragging && dragStart && dragEnd) {
      console.log('Selection attempt:', {
        dragStart,
        dragEnd,
        zoomLevel,
        dataLength: currentData.length
      })
      const startIndex = currentData.findIndex((item) => item.day === dragStart)
      const endIndex = currentData.findIndex((item) => item.day === dragEnd)
      console.log('Found indices:', { startIndex, endIndex })

      if (startIndex !== -1 && endIndex !== -1) {
        const minIndex = Math.min(startIndex, endIndex)
        const maxIndex = Math.max(startIndex, endIndex)

        setSelectedRange({
          startIndex: minIndex,
          endIndex: maxIndex
        })
        console.log('Selected range set:', { minIndex, maxIndex })
      } else {
        console.warn('Could not find matching indices for selection')
      }
    }

    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
  }

  const formatTooltipValue = (value) => {
    if (value === 0) return '0m'
    const hours = Math.floor(value / 3600)
    const minutes = Math.floor((value % 3600) / 60)
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  }

  const getTooltipTitle = () => {
    if (selectedRange) return 'Selected Range'

    const titles = {
      hour: 'Current Period Total',
      day: 'Current Day Total',
      week: 'Current Week Total',
      month: 'Current Month Total'
    }
    return titles[zoomLevel] || 'Total'
  }

  const CustomTooltip = ({ active }) => {
    if (active) {
      const productiveTime = formatTooltipValue(aggregatedData.productive)
      const unproductiveTime = formatTooltipValue(aggregatedData.unproductive)
      const totalTime = formatTooltipValue(aggregatedData.total)
      const productivePercentage =
        aggregatedData.total > 0
          ? Math.round((aggregatedData.productive / aggregatedData.total) * 100)
          : 0

      return (
        <div className="bg-white dark:bg-[#252630] p-3 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-lg backdrop-blur-sm">
          <p className="text-slate-900 dark:text-white font-medium mb-2">{getTooltipTitle()}</p>
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">{getZoomLevelDisplay().detail}</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-cyan-400 to-cyan-500" />
              <span className="text-slate-600 dark:text-slate-300">Productive: </span>
              <span className="text-slate-900 dark:text-white">{productiveTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-violet-400 to-purple-500" />
              <span className="text-slate-600 dark:text-slate-300">Unproductive: </span>
              <span className="text-slate-900 dark:text-white">{unproductiveTime}</span>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-600 dark:text-slate-300">Total: </span>
              <span className="text-cyan-600 dark:text-cyan-400 font-medium">{totalTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-600 dark:text-slate-300">Productivity: </span>
              <span className="text-cyan-600 dark:text-cyan-400 font-medium">{productivePercentage}%</span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  if (!currentData || currentData.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1a1b23] p-4 rounded-xl h-[250px] flex items-center justify-center border border-slate-200 dark:border-slate-700/50">
        {isLoading ? (
          <div className="flex items-center gap-2 text-cyan-500">
            <div className="animate-spin w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full"></div>
            <span>Loading data...</span>
          </div>
        ) : (
          <span className="text-slate-500">No data available</span>
        )}
      </div>
    )
  }

  return (
    
    <div ref={containerRef} className="bg-white dark:bg-[#1a1b23] p-4 rounded-xl border border-slate-200 dark:border-slate-700/50" tabIndex={0}>
      <div className="space-y-3 mb-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h3 className="text-slate-900 dark:text-white text-sm font-medium">Productivity Over Time</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-md">
                {getZoomLevelDisplay().label}
              </span>
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="text-slate-400 hover:text-cyan-500 transition-colors"
                title="Help & Controls"
              >
                <HelpCircle size={14} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={zoomIn}
              disabled={zoomLevel === 'hour'}
              className="text-[#5051F9] hover:text-[#6B6CFA] disabled:text-[#768396] dark:disabled:text-[#898999] disabled:cursor-not-allowed text-xs p-2 rounded-lg border border-[#5051F9]/50 hover:border-[#5051F9] disabled:border-[#E8EDF1] dark:disabled:border-[#282932] transition-all duration-200 hover:bg-[#5051F9]/10"
              title="Zoom In (+) - More detailed view"
            >
              <ZoomIn size={12} />
            </button>
            <button
              onClick={zoomOut}
              disabled={zoomLevel === 'month'}
              className="text-[#5051F9] hover:text-[#6B6CFA] disabled:text-[#768396] dark:disabled:text-[#898999] disabled:cursor-not-allowed text-xs p-2 rounded-lg border border-[#5051F9]/50 hover:border-[#5051F9] disabled:border-[#E8EDF1] dark:disabled:border-[#282932] transition-all duration-200 hover:bg-[#5051F9]/10"
              title="Zoom Out (-) - Broader time view"
            >
              <ZoomOut size={12} />
            </button>
            <button
              onClick={resetZoom}
              className="text-[#5051F9] hover:text-[#6B6CFA] text-xs p-2 rounded-lg border border-[#5051F9]/50 hover:border-[#5051F9] transition-all duration-200 hover:bg-[#5051F9]/10"
              title="Reset to default view (0)"
            >
              <RotateCcw size={12} />
            </button>
            {selectedRange && (
              <button
                onClick={clearSelection}
                className="text-[#5051F9] hover:text-[#6B6CFA] text-xs px-3 py-1 rounded-lg border border-[#5051F9]/50 hover:border-[#5051F9] transition-colors"
              >
                Clear Selection
              </button>
            )}
          </div>
        </div>

        {/* Breadcrumb navigation */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#768396] dark:text-[#898999]">View:</span>
          {getBreadcrumbPath().map((level, index) => (
            <div key={level} className="flex items-center gap-1">
              <button
                onClick={() => {
                  setZoomLevel(level)
                  onZoomLevelChange?.(level)
                  clearSelection()
                }}
                className={`text-xs px-2 py-1 rounded-md transition-colors ${
                  level === zoomLevel
                    ? 'bg-gradient-to-r from-[#5051F9] to-[#6B6CFA] text-white'
                    : 'text-[#768396] dark:text-[#898999] hover:text-[#5051F9] hover:bg-[#F4F7FE] dark:hover:bg-[#282932]'
                }`}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
              {index < getBreadcrumbPath().length - 1 && (
                <ChevronRight size={12} className="text-[#768396] dark:text-[#898999]" />
              )}
            </div>
          ))}
        </div>

        {/* Zoom progress indicator */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#768396] dark:text-[#898999]">Detail Level:</span>
          <div className="flex-1 h-1 bg-[#E8EDF1] dark:bg-[#282932] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#5051F9] to-[#6B6CFA] transition-all duration-300 ease-out"
              style={{ width: `${getZoomProgress()}%` }}
            />
          </div>
          <span className="text-xs text-[#768396] dark:text-[#898999]">{Math.round(getZoomProgress())}%</span>
        </div>

        {/* Help panel */}
        {showHelp && (
          <div className="bg-[#F4F7FE] dark:bg-[#282932] border border-[#E8EDF1] dark:border-[#282932] rounded-lg p-3 text-xs space-y-2">
            <div className="text-[#5051F9] font-medium">Chart Controls:</div>
            <div className="text-[#232360] dark:text-white space-y-1">
              <div>
                • <kbd className="bg-[#E8EDF1] dark:bg-[#1E1F25] px-1 rounded">Mouse Wheel</kbd> - Zoom in/out
              </div>
              <div>
                • <kbd className="bg-[#E8EDF1] dark:bg-[#1E1F25] px-1 rounded">+/-</kbd> keys - Zoom in/out
              </div>
              <div>
                • <kbd className="bg-[#E8EDF1] dark:bg-[#1E1F25] px-1 rounded">0</kbd> key - Reset to default
              </div>
              <div>
                • <strong>Click & Drag</strong> on chart to select time range
              </div>
              <div>• Click breadcrumb buttons to jump between views</div>
              <div>• Hover chart for detailed tooltip information</div>
            </div>
            <div className="text-[#5051F9] font-medium mt-2">
              Current View: {getZoomLevelDisplay().detail}
            </div>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart
          ref={chartRef}
          data={currentData}
          margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ backgroundColor: 'transparent' }}
        >
          <defs>
            {/* Productive gradient - Primary Purple #5051F9 */}
            <linearGradient id="colorProductive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5051F9" stopOpacity={0.8} />
              <stop offset="40%" stopColor="#5051F9" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#5051F9" stopOpacity={0.1} />
            </linearGradient>
            {/* Unproductive gradient - Red/Salmon #FF6B6B */}
            <linearGradient id="colorUnproductive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF6B6B" stopOpacity={0.7} />
              <stop offset="40%" stopColor="#FF6B6B" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#FF6B6B" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="day"
            stroke="transparent"
            tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
            dy={10}
            style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none' }}
          />
          <YAxis 
            stroke="transparent"
            tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
            dx={-5}
            tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value}
          />
          <CartesianGrid strokeDasharray="0" stroke="rgba(100, 116, 139, 0.1)" vertical={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotoneX"
            dataKey="productive"
            name="Productive"
            stroke="#5051F9"
            strokeWidth={3}
            fill="url(#colorProductive)"
            dot={{ fill: '#5051F9', stroke: '#fff', strokeWidth: 2, r: 4 }}
            activeDot={{ fill: '#6B6CFA', stroke: '#fff', strokeWidth: 2, r: 6 }}
          />
          <Area
            type="monotoneX"
            dataKey="unproductive"
            name="Unproductive"
            stroke="#FF6B6B"
            strokeWidth={3}
            fill="url(#colorUnproductive)"
            dot={{ fill: '#FF6B6B', stroke: '#fff', strokeWidth: 2, r: 4 }}
            activeDot={{ fill: '#FF8A8A', stroke: '#fff', strokeWidth: 2, r: 6 }}
          />
          {isDragging && dragStart && dragEnd && (
            <ReferenceArea
              x1={dragStart}
              x2={dragEnd}
              fill={chartColors.selection}
              fillOpacity={0.4}
              stroke={chartColors.selection}
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          )}
          {selectedRange && !isDragging && (
            <ReferenceArea
              x1={currentData[selectedRange.startIndex]?.day}
              x2={currentData[selectedRange.endIndex]?.day}
              fill={chartColors.selection}
              fillOpacity={0.25}
              stroke={chartColors.selection}
              strokeWidth={2}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
    
  )
}

export default ProductiveAreaChart
