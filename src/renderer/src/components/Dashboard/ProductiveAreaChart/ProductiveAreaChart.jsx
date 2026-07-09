/**
 * ProductiveAreaChart Component
 *
 * A comprehensive productivity visualization chart with interactive zoom and selection features.
 * This is the main component that orchestrates all sub-components and state management.
 *
 * Features:
 * - Multi-level zoom (hour, day, week, month views)
 * - Interactive selection with drag functionality
 * - Mouse wheel and keyboard shortcuts for zoom
 * - Visual progress indicators and breadcrumb navigation
 * - Context-aware tooltips and help system
 *
 * Props:
 * - data: Initial chart data array
 * - rawData: Raw data object for zoom level processing
 * - selectedDate: Currently selected date string
 * - onZoomLevelChange: Callback function when zoom level changes
 */

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

// Import modular components
import ChartHeader from './components/ChartHeader'
import ZoomControls from './components/ZoomControls'
import BreadcrumbNavigation from './components/BreadcrumbNavigation'
import ZoomProgressIndicator from './components/ZoomProgressIndicator'
import HelpPanel from './components/HelpPanel'
import CustomTooltip from './components/CustomTooltip'

// Import theme hook
import { useTheme } from '../../../context/ThemeContext'

// Import custom hooks
import useZoomState from './hooks/useZoomState'
import useSelectionState from './hooks/useSelectionState'

// Import utilities
import { getZoomLevelDisplay, getZoomProgress, getBreadcrumbPath } from './utils/zoomUtils'
import { calculateAggregatedData } from './utils/selectionUtils'
import {
  createMouseDownHandler,
  createMouseMoveHandler,
  createMouseUpHandler,
  createWheelHandler,
  createKeyboardHandler,
  createClickOutsideHandler
} from './utils/eventHandlers'

const ProductiveAreaChart = ({
  data,
  rawData,
  selectedDate,
  onZoomLevelChange,
  onSelectionChange
}) => {
  // Get current theme
  const { resolvedTheme } = useTheme()

  // Theme-aware colors - cyan accent in dark mode, purple in light
  const isDark = resolvedTheme === 'dark'
  const accent = isDark ? '#22D3EE' : '#5051F9' // Cyan (dark) / Purple (light)
  const chartColors = {
    productive: accent, // Cyan (dark) / Purple (light) - for productive time
    neutral: isDark ? '#64748B' : '#22D3EE', // Slate (dark) / Cyan (light) - matches legend
    distracting: '#FF6B6B', // Red/Salmon - for distracting time
    selection: accent, // Selection same as productive
    grid: isDark ? '#1E293B' : '#E8EDF1',
    text: isDark ? '#94A3B8' : '#768396',
    bg: isDark ? '#0B1220' : '#ffffff',
    bgSecondary: isDark ? '#1E293B' : '#F4F7FE',
    border: isDark ? '#1E293B' : '#E8EDF1',
  }

  // State management using custom hooks
  const {
    zoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
    setZoomLevel,
    canZoomIn: canZoomInValue,
    canZoomOut: canZoomOutValue
  } = useZoomState('hour', onZoomLevelChange)

  const {
    selectedRange,
    dragStart,
    dragEnd,
    isDragging,
    selectedApps,
    isLoadingApps,
    clearSelection,
    startDrag,
    updateDrag,
    endDrag,
    updateSelectedApps
  } = useSelectionState()

  // Local state
  const [currentData, setCurrentData] = useState([])
  const [aggregatedData, setAggregatedData] = useState({ productive: 0, neutral: 0, distracting: 0, total: 0 })
  const [isLoading, setIsLoading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  // Refs
  const chartRef = useRef(null)
  const containerRef = useRef(null)

  // Data processing function
  const updateDataForZoomLevel = async () => {
    if (!rawData || !selectedDate) return

    setIsLoading(true)
    try {
      const { processProductiveChartData } = await import('../../../utils/dataProcessor')
      const newData = processProductiveChartData(rawData, selectedDate, zoomLevel)
      setCurrentData(newData)
    } catch (error) {
      console.error('Error updating zoom data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate aggregated data when current data or selection changes
  useEffect(() => {
    if (currentData && currentData.length > 0) {
      const newAggregatedData = calculateAggregatedData(currentData, selectedRange)
      setAggregatedData(newAggregatedData)
    }
  }, [currentData, selectedRange])

  // Handle initial data load
  useEffect(() => {
    if (data && data.length > 0) {
      setCurrentData(data)
    }
  }, [data])

  // Handle zoom level changes
  useEffect(() => {
    if (rawData && selectedDate) {
      updateDataForZoomLevel()
    }
  }, [zoomLevel, rawData, selectedDate])

  // Update selected apps when data changes
  useEffect(() => {
    if (selectedRange && rawData && selectedDate && currentData) {
      updateSelectedApps(rawData, selectedDate, currentData, zoomLevel)
    }
  }, [selectedRange, rawData, selectedDate, currentData, zoomLevel, updateSelectedApps])

  // Notify parent component of selection changes
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedApps, selectedRange)
    }
  }, [selectedApps, selectedRange, onSelectionChange])

  // Event handlers using utility functions
  const handleMouseDown = useCallback(
    createMouseDownHandler(
      startDrag,
      () => {},
      () => {}
    ),
    [startDrag]
  )

  const handleMouseMove = useCallback(createMouseMoveHandler(isDragging, updateDrag), [
    isDragging,
    updateDrag
  ])

  const handleMouseUp = useCallback(
    createMouseUpHandler(
      isDragging,
      dragStart,
      dragEnd,
      currentData,
      () => {},
      () => {},
      () => {},
      () => {},
      zoomLevel
    ),
    [isDragging, dragStart, dragEnd, currentData, zoomLevel]
  )

  // Simplified event handlers for the actual component
  const onMouseDown = (e) => {
    if (e && e.activeLabel) {
      startDrag(e.activeLabel)
    }
  }

  const onMouseMove = (e) => {
    if (isDragging && e && e.activeLabel) {
      updateDrag(e.activeLabel)
    }
  }

  const onMouseUp = () => {
    endDrag(currentData, zoomLevel, rawData, selectedDate, (apps) => {
      console.log('Apps extracted for selection:', apps)
      if (onSelectionChange) {
        onSelectionChange(apps, selectedRange)
      }
    })
  }

  const handleWheel = useCallback(
    (e) => {
      if (!selectedRange) {
        createWheelHandler(containerRef, zoomIn, zoomOut)(e)
      }
    },
    [zoomIn, zoomOut, selectedRange]
  )

  const handleKeyDown = useCallback(
    (e) => {
      if (!selectedRange) {
        createKeyboardHandler(containerRef, zoomIn, zoomOut, resetZoom)(e)
      }
    },
    [zoomIn, zoomOut, resetZoom, selectedRange]
  )

  const handleClickOutside = useCallback(
    createClickOutsideHandler(containerRef, selectedRange, clearSelection),
    [selectedRange, clearSelection]
  )

  // Event listeners setup
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    // Wheel zoom disabled - no wheel event listener added
    if (!selectedRange) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleClickOutside, handleKeyDown, selectedRange])

  // Zoom level change handler for breadcrumbs
  const handleBreadcrumbClick = useCallback(
    (level) => {
      if (!selectedRange) {
        setZoomLevel(level)
        clearSelection()
      }
    },
    [setZoomLevel, clearSelection, selectedRange]
  )

  // Derived values
  const zoomLevelDisplay = getZoomLevelDisplay(zoomLevel)
  const zoomProgress = getZoomProgress(zoomLevel)
  const breadcrumbPath = getBreadcrumbPath(zoomLevel)
  const isZoomDisabled = !!selectedRange // Disable zoom when range is selected

  // Loading state
  if (!currentData || currentData.length === 0) {
    return (
      <div className="bg-white dark:bg-[#05070D] p-4 rounded-xl h-[250px] flex items-center justify-center border border-slate-200 dark:border-slate-700/30">
        {isLoading ? (
          <div className="flex items-center gap-2 text-teal-500">
            <div className="animate-spin w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full"></div>
            <span>Loading data...</span>
          </div>
        ) : (
          <span className="text-slate-500">No data available</span>
        )}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="bg-white dark:bg-[#05070D] p-3 rounded-xl border border-slate-200 dark:border-slate-700/30 h-full flex flex-col"
      tabIndex={0}
    >
      {/* Compact Header with Tabs */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-slate-700 dark:text-white text-sm font-medium leading-tight">Productivity Over Time</h3>

        {/* Tab Navigation - Daily/Weekly/Monthly */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleBreadcrumbClick('hour')}
            className={`px-3 py-1 text-xs font-medium transition-all ${
              zoomLevel === 'hour' || zoomLevel === 'day'
                ? 'text-[#5051F9] border-b-2 border-[#5051F9] dark:text-[#22D3EE] dark:border-[#22D3EE]'
                : 'text-[#768396] dark:text-[#94A3B8] hover:text-[#232360] dark:hover:text-white border-b-2 border-transparent'
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => handleBreadcrumbClick('week')}
            className={`px-3 py-1 text-xs font-medium transition-all ${
              zoomLevel === 'week'
                ? 'text-[#5051F9] border-b-2 border-[#5051F9] dark:text-[#22D3EE] dark:border-[#22D3EE]'
                : 'text-[#768396] dark:text-[#94A3B8] hover:text-[#232360] dark:hover:text-white border-b-2 border-transparent'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => handleBreadcrumbClick('month')}
            className={`px-3 py-1 text-xs font-medium transition-all ${
              zoomLevel === 'month'
                ? 'text-[#5051F9] border-b-2 border-[#5051F9] dark:text-[#22D3EE] dark:border-[#22D3EE]'
                : 'text-[#768396] dark:text-[#94A3B8] hover:text-[#232360] dark:hover:text-white border-b-2 border-transparent'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            ref={chartRef}
            data={currentData}
            margin={{ top: 8, right: 16, left: 8, bottom: 20 }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            style={{ backgroundColor: 'transparent' }}
          >
          <defs>
            {/* Productive gradient - Cyan (dark) / Purple (light) */}
            <linearGradient id="colorProductive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColors.productive} stopOpacity={0.6} />
              <stop offset="40%" stopColor={chartColors.productive} stopOpacity={0.35} />
              <stop offset="100%" stopColor={chartColors.productive} stopOpacity={0.05} />
            </linearGradient>
            {/* Neutral gradient - Slate (dark) / Cyan (light) */}
            <linearGradient id="colorNeutral" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColors.neutral} stopOpacity={0.5} />
              <stop offset="40%" stopColor={chartColors.neutral} stopOpacity={0.3} />
              <stop offset="100%" stopColor={chartColors.neutral} stopOpacity={0.05} />
            </linearGradient>
            {/* Distracting gradient - Red/Salmon #FF6B6B */}
            <linearGradient id="colorDistracting" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF6B6B" stopOpacity={0.5} />
              <stop offset="40%" stopColor="#FF6B6B" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#FF6B6B" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="day"
            stroke="transparent"
            tick={{ fill: '#FFFFFF', fontSize: 11, fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
            dy={2}
            interval={Math.max(0, Math.floor((currentData?.length || 24) / 8))}
            style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none' }}
          />
          <YAxis
            stroke="transparent"
            tick={{ fill: chartColors.text, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={38}
            tickFormatter={(seconds) => {
              const minutes = Math.round(seconds / 60)
              return minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}` : `${minutes}m`
            }}
            allowDecimals={false}
            style={{ userSelect: 'none' }}
          />
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(100, 116, 139, 0.12)'} vertical={false} />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: isDark ? 'rgba(34, 211, 238, 0.35)' : 'rgba(80, 81, 249, 0.3)', strokeWidth: 1 }}
            position={{ y: -30 }}
            wrapperStyle={{ outline: 'none' }}
          />
          {/* Only Productive (cyan) and Distracting (red) are charted; neutral
              time is intentionally omitted here (still shown in the stat cards).
              Draw order matters for stacked areas: distracting is drawn first so
              it sits at the BOTTOM, and productive is drawn last so it renders on
              TOP — the dominant type visually dominates the chart. */}
          <Area
            type="monotoneX"
            dataKey="distracting"
            name="Distracting"
            stackId="1"
            stroke="#FF6B6B"
            strokeWidth={2}
            fill="url(#colorDistracting)"
            dot={false}
            activeDot={false}
          />
          <Area
            type="monotoneX"
            dataKey="productive"
            name="Productive"
            stackId="1"
            stroke={chartColors.productive}
            strokeWidth={2}
            fill="url(#colorProductive)"
            dot={false}
            activeDot={false}
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
    </div>
  )
}

export default ProductiveAreaChart
