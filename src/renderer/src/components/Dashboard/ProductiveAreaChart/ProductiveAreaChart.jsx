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

  // Theme-aware colors
  const chartColors = {
    productive: resolvedTheme === 'dark' ? '#82ca9d' : '#10b981', // green
    unproductive: resolvedTheme === 'dark' ? '#ff6b6b' : '#ef4444', // red
    selection: resolvedTheme === 'dark' ? '#06b6d4' : '#0891b2', // cyan
    grid: resolvedTheme === 'dark' ? '#475569' : '#cbd5e1', // slate
    text: resolvedTheme === 'dark' ? '#ffffff' : '#1e293b', // white/slate
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
    if (!selectedRange) {
      document.addEventListener('wheel', handleWheel, { passive: false })
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('wheel', handleWheel)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleClickOutside, handleWheel, handleKeyDown, selectedRange])

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
      <div className="bg-slate-100 dark:bg-gray-800 p-4 rounded-md h-[250px] flex items-center justify-center">
        {isLoading ? (
          <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
            <div className="animate-spin w-4 h-4 border-2 border-cyan-600 dark:border-cyan-400 border-t-transparent rounded-full"></div>
            <span>Loading data...</span>
          </div>
        ) : (
          <span className="text-gray-600 dark:text-gray-500">No data available</span>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="bg-slate-100 dark:bg-gray-800 p-4 rounded-md" tabIndex={0}>
      <div className="space-y-3 mb-4">
        <ChartHeader
          zoomLevelLabel={zoomLevelDisplay.label}
          showHelp={showHelp}
          onToggleHelp={() => setShowHelp(!showHelp)}
          selectedRange={selectedRange}
          onClearSelection={clearSelection}
          zoomControls={
            <ZoomControls
              zoomLevel={zoomLevel}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onReset={resetZoom}
              canZoomIn={canZoomInValue && !isZoomDisabled}
              canZoomOut={canZoomOutValue && !isZoomDisabled}
              disabled={isZoomDisabled}
            />
          }
        />

        <BreadcrumbNavigation
          breadcrumbPath={breadcrumbPath}
          currentZoomLevel={zoomLevel}
          onZoomLevelClick={handleBreadcrumbClick}
          disabled={isZoomDisabled}
        />

        <ZoomProgressIndicator progress={zoomProgress} />

        <HelpPanel isVisible={showHelp} zoomLevelDetail={zoomLevelDisplay.detail} />
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <AreaChart
          ref={chartRef}
          data={currentData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
        >
          <defs>
            <linearGradient id="colorProductive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColors.productive} stopOpacity={0.8} />
              <stop offset="95%" stopColor={chartColors.productive} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorUnproductive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartColors.unproductive} stopOpacity={0.8} />
              <stop offset="95%" stopColor={chartColors.unproductive} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="day"
            stroke={chartColors.text}
            style={{ userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none' }}
          />
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          <Tooltip
            content={
              <CustomTooltip
                aggregatedData={aggregatedData}
                hasSelection={!!selectedRange}
                zoomLevel={zoomLevel}
                zoomLevelDetail={zoomLevelDisplay.detail}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="productive"
            name="Productive"
            stroke={chartColors.productive}
            fill="url(#colorProductive)"
          />
          <Area
            type="monotone"
            dataKey="unproductive"
            name="Unproductive"
            stroke={chartColors.unproductive}
            fill="url(#colorUnproductive)"
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
