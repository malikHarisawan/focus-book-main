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
  onSelectionChange,
  // Custom range support: when customData is passed, the chart renders it
  // directly (one point per day) and skips zoom-driven data loading. hideTabs
  // suppresses the Daily/Weekly/Monthly header tabs. initialZoom sets the
  // starting zoom level for the normal (non-custom) path.
  customData = null,
  hideTabs = false,
  initialZoom = 'day'
}) => {
  // Get current theme
  const { resolvedTheme } = useTheme()

  // Theme-aware colors — violet accent (both themes), salmon for distraction.
  // Values match the design tokens (--c-* / --fb-*) for the two themes.
  const isDark = resolvedTheme === 'dark'
  const accent = '#5B5BD6' // Violet accent — productive (both themes)
  const chartColors = {
    productive: accent,
    distracting: isDark ? '#F5788A' : '#F0596E', // Salmon — distracting
    selection: accent,
    grid: isDark ? '#272730' : '#ECECEA',
    text: isDark ? '#8B8B99' : '#75757F',
    bg: isDark ? '#15151D' : '#ffffff',
    bgSecondary: isDark ? '#1E1E28' : '#F5F5F3',
    border: isDark ? '#272730' : '#ECECEA',
  }
  const distractColor = chartColors.distracting

  // State management using custom hooks
  const {
    zoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
    setZoomLevel,
    canZoomIn: canZoomInValue,
    canZoomOut: canZoomOutValue
  } = useZoomState(initialZoom, onZoomLevelChange)

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
  const [isLoading, setIsLoading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  // Refs
  const chartRef = useRef(null)
  const containerRef = useRef(null)

  // Data processing function
  const updateDataForZoomLevel = async () => {
    // In custom-range mode the parent supplies the series directly.
    if (customData) return
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

  // Custom-range mode: mirror the parent-supplied series into currentData.
  useEffect(() => {
    if (customData) {
      setCurrentData(customData)
    }
  }, [customData])

  // Handle initial data load
  useEffect(() => {
    if (!customData && data && data.length > 0) {
      setCurrentData(data)
    }
  }, [data, customData])

  // Handle zoom level changes
  useEffect(() => {
    if (!customData && rawData && selectedDate) {
      updateDataForZoomLevel()
    }
  }, [zoomLevel, rawData, selectedDate, customData])

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

  // --- Bucket-aware display shape (see docs/BUCKET_AGGREGATION_ENGINE.md) ---
  // The series are drawn in MILLISECONDS (focusedMs stacked on distractedMs). The
  // axis is already fitted to the active window, so an empty bucket inside it is a
  // genuine lull — we plot it as 0 (not null) so the smooth line flows continuously
  // through it to the baseline instead of breaking into a gap.
  const isHourScale = zoomLevel === 'hour' || zoomLevel === 'day'
  const bucketCeilingMs = isHourScale ? 60 * 60 * 1000 : null // hour buckets pin to 60m

  const displayData = (currentData || []).map((p) => ({
    ...p,
    focusedMs: p.focusedMs ?? 0,
    distractedMs: p.distractedMs ?? 0
  }))

  // Y-axis: pin the ceiling to the bucket's known maximum so bars mean the same thing
  // every day (§4). Hour buckets hold 60 min exactly. Day buckets (week/month view)
  // have no natural "full", so nice-number the observed max instead.
  const niceCeil = (maxMs) => {
    if (!maxMs || maxMs <= 0) return 60 * 60 * 1000
    const hours = Math.ceil(maxMs / (60 * 60 * 1000))
    return hours * 60 * 60 * 1000
  }
  const observedMaxMs = displayData.reduce(
    (m, p) => Math.max(m, (p.focusedMs || 0) + (p.distractedMs || 0)),
    0
  )
  const yMaxMs = bucketCeilingMs || niceCeil(observedMaxMs)
  // Nice ticks: quarters of the hour ceiling (0/15/30/45/60); quarters of the day cap.
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMaxMs * f))

  // Loading state
  if (!currentData || currentData.length === 0) {
    return (
      <div className="bg-fb-surface p-4 rounded-[18px] h-[250px] flex items-center justify-center border border-fb-border">
        {isLoading ? (
          <div className="flex items-center gap-2 text-fb-accent">
            <div className="animate-spin w-4 h-4 border-2 border-fb-accent border-t-transparent rounded-full"></div>
            <span>Loading data...</span>
          </div>
        ) : (
          <span className="text-fb-muted">No data available</span>
        )}
      </div>
    )
  }

  const tabClass = (active) =>
    `px-3 py-1 text-xs font-semibold transition-all border-b-2 ${
      active
        ? 'text-fb-accent border-fb-accent'
        : 'text-fb-muted hover:text-fb-text border-transparent'
    }`

  return (
    <div
      ref={containerRef}
      className={hideTabs ? 'px-5 pb-4 h-full flex flex-col' : 'bg-fb-surface p-4 rounded-[18px] h-full flex flex-col'}
      tabIndex={0}
    >
      {/* Header with Tabs + legend */}
      <div className="flex items-center justify-between mb-3">
        <div>
          {!hideTabs && (
            <h3 className="font-display text-fb-text text-base font-semibold leading-tight">Focus over time</h3>
          )}
          <div className={`flex items-center gap-4 ${hideTabs ? '' : 'mt-1'}`}>
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-fb-muted">
              <span className="w-3.5 h-[3px] rounded-sm" style={{ background: chartColors.productive }} />
              Focused
            </span>
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-fb-muted">
              <span className="w-3.5 h-[3px] rounded-sm" style={{ background: distractColor }} />
              Distracted
            </span>
          </div>
        </div>

        {/* Tab Navigation - Daily/Weekly/Monthly (hidden in custom-range mode,
            where the parent's granularity control drives the view) */}
        {!hideTabs && (
          <div className="flex items-center gap-1">
            <button onClick={() => handleBreadcrumbClick('hour')} className={tabClass(zoomLevel === 'hour' || zoomLevel === 'day')}>
              Daily
            </button>
            <button onClick={() => handleBreadcrumbClick('week')} className={tabClass(zoomLevel === 'week')}>
              Weekly
            </button>
            <button onClick={() => handleBreadcrumbClick('month')} className={tabClass(zoomLevel === 'month')}>
              Monthly
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            ref={chartRef}
            data={displayData}
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
            {/* Distracting gradient - salmon */}
            <linearGradient id="colorDistracting" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={distractColor} stopOpacity={0.5} />
              <stop offset="40%" stopColor={distractColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={distractColor} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="day"
            stroke="transparent"
            tick={{ fill: chartColors.text, fontSize: 11, fontWeight: 500 }}
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
            // Pinned domain + nice ticks (§4): the ceiling is the bucket's known max, so
            // bar height means the same thing across days. Values are milliseconds.
            domain={[0, yMaxMs]}
            ticks={yTicks}
            tickFormatter={(ms) => {
              const minutes = Math.round(ms / 60000)
              return minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}` : `${minutes}m`
            }}
            allowDecimals={false}
            style={{ userSelect: 'none' }}
          />
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(139, 139, 153, 0.12)' : 'rgba(117, 117, 127, 0.12)'} vertical={false} />
          {/* Tooltip follows the cursor and Recharts auto-flips it to the opposite
              side near the right edge, so it stops parking over the day's single peak
              (§7). allowEscapeViewBox lets it rise above the plot rather than overlap
              the bars. */}
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'rgba(91, 91, 214, 0.3)', strokeWidth: 1 }}
            offset={16}
            allowEscapeViewBox={{ x: false, y: true }}
            wrapperStyle={{ outline: 'none' }}
          />
          {/* BINARY model: two stacked areas, Focused + Distracted, in milliseconds.
              stackId keeps them parts-of-a-whole (stack height == tracked time).
              type="monotoneX": smooth spline for a clean, continuous curve.
              connectNulls={true}: bridge untracked buckets so the line stays
              continuous across empty hours instead of breaking into gaps.
              Draw order: distracted at the bottom (baseline), focused on top — the
              series anchored to the axis is the one you compare across buckets. */}
          <Area
            type="monotoneX"
            dataKey="distractedMs"
            name="Distracted"
            stackId="1"
            stroke={distractColor}
            strokeWidth={2}
            fill="url(#colorDistracting)"
            dot={false}
            activeDot={false}
            connectNulls={true}
          />
          <Area
            type="monotoneX"
            dataKey="focusedMs"
            name="Focused"
            stackId="1"
            stroke={chartColors.productive}
            strokeWidth={2}
            fill="url(#colorProductive)"
            dot={false}
            activeDot={false}
            connectNulls={true}
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
