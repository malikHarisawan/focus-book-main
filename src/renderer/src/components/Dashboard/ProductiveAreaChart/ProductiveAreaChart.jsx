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

  // Theme-aware colors - Exact Figma color palette
  const chartColors = {
    productive: '#5051F9', // Primary purple - for productive time
    unproductive: '#FF6B6B', // Red/Salmon - for unproductive/distracting time
    neutral: '#1EA7FF', // Cyan blue - for neutral
    selection: '#5051F9', // Selection same as productive
    grid: resolvedTheme === 'dark' ? '#282932' : '#E8EDF1',
    text: resolvedTheme === 'dark' ? '#898999' : '#768396',
    bg: resolvedTheme === 'dark' ? '#212329' : '#ffffff',
    bgSecondary: resolvedTheme === 'dark' ? '#282932' : '#F4F7FE',
    border: resolvedTheme === 'dark' ? '#282932' : '#E8EDF1',
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
  const [aggregatedData, setAggregatedData] = useState({ productive: 0, unproductive: 0, total: 0 })
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
      <div className="bg-white dark:bg-[#1a1b23] p-4 rounded-xl h-[250px] flex items-center justify-center border border-slate-200 dark:border-slate-700/30">
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
    <div ref={containerRef} className="bg-white dark:bg-[#1a1b23] p-4 rounded-xl border border-slate-200 dark:border-slate-700/30" tabIndex={0}>
      {/* Clean Header with Tabs */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-slate-700 dark:text-white text-base font-medium">Productivity Over Time</h3>
        
        {/* Tab Navigation - Daily/Weekly/Monthly */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleBreadcrumbClick('hour')}
            className={`px-4 py-1.5 text-sm font-medium transition-all ${
              zoomLevel === 'hour' || zoomLevel === 'day'
                ? 'text-[#5051F9] border-b-2 border-[#5051F9]'
                : 'text-[#768396] dark:text-[#898999] hover:text-[#232360] dark:hover:text-white border-b-2 border-transparent'
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => handleBreadcrumbClick('week')}
            className={`px-4 py-1.5 text-sm font-medium transition-all ${
              zoomLevel === 'week'
                ? 'text-[#5051F9] border-b-2 border-[#5051F9]'
                : 'text-[#768396] dark:text-[#898999] hover:text-[#232360] dark:hover:text-white border-b-2 border-transparent'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => handleBreadcrumbClick('month')}
            className={`px-4 py-1.5 text-sm font-medium transition-all ${
              zoomLevel === 'month'
                ? 'text-[#5051F9] border-b-2 border-[#5051F9]'
                : 'text-[#768396] dark:text-[#898999] hover:text-[#232360] dark:hover:text-white border-b-2 border-transparent'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart
          ref={chartRef}
          data={currentData}
          margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          style={{ backgroundColor: 'transparent' }}
        >
          <defs>
            {/* Productive gradient - Primary Purple #5051F9 */}
            <linearGradient id="colorProductive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5051F9" stopOpacity={0.6} />
              <stop offset="40%" stopColor="#5051F9" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#5051F9" stopOpacity={0.05} />
            </linearGradient>
            {/* Unproductive gradient - Red/Salmon #FF6B6B */}
            <linearGradient id="colorUnproductive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF6B6B" stopOpacity={0.5} />
              <stop offset="40%" stopColor="#FF6B6B" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#FF6B6B" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="day"
            stroke="transparent"
            tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 400 }}
            tickLine={false}
            axisLine={false}
            dy={10}
            style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none' }}
          />
          <YAxis 
            stroke="transparent"
            tick={false}
            tickLine={false}
            axisLine={false}
            width={0}
          />
          <CartesianGrid strokeDasharray="0" stroke="rgba(100, 116, 139, 0.06)" vertical={false} />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'rgba(80, 81, 249, 0.3)', strokeWidth: 1 }}
          />
          <Area
            type="monotoneX"
            dataKey="productive"
            name="Productive"
            stroke="#5051F9"
            strokeWidth={2.5}
            fill="url(#colorProductive)"
            dot={{ fill: '#5051F9', stroke: '#fff', strokeWidth: 2, r: 4 }}
            activeDot={{ fill: '#6B6CFA', stroke: '#fff', strokeWidth: 2, r: 6 }}
          />
          <Area
            type="monotoneX"
            dataKey="unproductive"
            name="Unproductive"
            stroke="#FF6B6B"
            strokeWidth={2.5}
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
