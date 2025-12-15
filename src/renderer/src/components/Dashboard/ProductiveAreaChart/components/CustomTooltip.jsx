/**
 * CustomTooltip Component
 *
 * Custom tooltip for the productivity chart that shows aggregated data
 * and productivity metrics for the current selection or entire dataset.
 *
 * Props:
 * - active: Boolean indicating if tooltip should be shown
 * - payload: Data from Recharts for the hovered point
 * - label: The label of the hovered point
 * - aggregatedData: Object with productive, unproductive, and total time
 * - hasSelection: Boolean indicating if there's an active selection
 * - zoomLevel: Current zoom level for contextual title
 * - zoomLevelDetail: Detailed description of current zoom level
 */

import React from 'react'
import { formatTooltipValue, getTooltipTitle } from '../utils/selectionUtils'

const CustomTooltip = ({ active, payload, label, aggregatedData, hasSelection, zoomLevel, zoomLevelDetail }) => {
  if (!active || !payload || payload.length === 0) return null

  // Get the data for the hovered point
  const pointData = payload[0]?.payload || {}
  const productiveSeconds = pointData.productive || 0
  const unproductiveSeconds = pointData.unproductive || 0
  const totalSeconds = productiveSeconds + unproductiveSeconds

  const productiveTime = formatTooltipValue(productiveSeconds)
  const unproductiveTime = formatTooltipValue(unproductiveSeconds)
  const totalTime = formatTooltipValue(totalSeconds)
  const productivePercentage =
    totalSeconds > 0
      ? Math.round((productiveSeconds / totalSeconds) * 100)
      : 0

  return (
    <div className="bg-white dark:bg-[#1a1b23] p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg min-w-[180px]">
      <p className="text-slate-900 dark:text-white font-medium mb-2">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#5051F9' }} />
            <span className="text-slate-500 dark:text-slate-400 text-sm">Productive:</span>
          </div>
          <span className="text-slate-900 dark:text-white text-sm font-medium">{productiveTime}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#FF6B6B' }} />
            <span className="text-slate-500 dark:text-slate-400 text-sm">Unproductive:</span>
          </div>
          <span className="text-slate-900 dark:text-white text-sm font-medium">{unproductiveTime}</span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-1.5 mt-1.5 border-t border-slate-200 dark:border-slate-700">
          <span className="text-slate-500 dark:text-slate-400 text-sm">Total:</span>
          <span className="text-[#5051F9] text-sm font-medium">{totalTime}</span>
        </div>
        {totalSeconds > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500 dark:text-slate-400 text-sm">Productivity:</span>
            <span className={`text-sm font-medium ${productivePercentage >= 50 ? 'text-[#5051F9]' : 'text-[#FF6B6B]'}`}>
              {productivePercentage}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default CustomTooltip
