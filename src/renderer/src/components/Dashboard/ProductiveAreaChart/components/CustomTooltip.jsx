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
 * - aggregatedData: Object with productive, neutral, distracting, and total time
 * - hasSelection: Boolean indicating if there's an active selection
 * - zoomLevel: Current zoom level for contextual title
 * - zoomLevelDetail: Detailed description of current zoom level
 */

import React from 'react'
import { formatTooltipValue, getTooltipTitle } from '../utils/selectionUtils'

const CustomTooltip = ({ active, payload, label, aggregatedData, hasSelection, zoomLevel, zoomLevelDetail }) => {
  if (!active || !payload || payload.length === 0) return null

  // Get the data for the hovered point. The chart shows only productive and
  // distracting (neutral is intentionally omitted), so the tooltip total is the
  // sum of those two to stay consistent with what's drawn.
  const pointData = payload[0]?.payload || {}
  const productiveSeconds = pointData.productive || 0
  const distractingSeconds = pointData.distracting || 0
  const totalSeconds = productiveSeconds + distractingSeconds

  const productiveTime = formatTooltipValue(productiveSeconds)
  const distractingTime = formatTooltipValue(distractingSeconds)
  const totalTime = formatTooltipValue(totalSeconds)
  const productivePercentage =
    totalSeconds > 0
      ? Math.round((productiveSeconds / totalSeconds) * 100)
      : 0

  return (
    <div className="bg-white dark:bg-[#05070D] p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg min-w-[180px]">
      <p className="text-slate-900 dark:text-white font-medium mb-2">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#5051F9] dark:bg-[#22D3EE]" />
            <span className="text-slate-600 dark:text-slate-300 text-sm">Productive:</span>
          </div>
          <span className="text-slate-900 dark:text-white text-sm font-medium">{productiveTime}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#FF6B6B' }} />
            <span className="text-slate-600 dark:text-slate-300 text-sm">Distracting:</span>
          </div>
          <span className="text-slate-900 dark:text-white text-sm font-medium">{distractingTime}</span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-1.5 mt-1.5 border-t border-slate-200 dark:border-slate-700">
          <span className="text-slate-600 dark:text-slate-300 text-sm">Total:</span>
          <span className="text-[#5051F9] dark:text-[#22D3EE] text-sm font-medium">{totalTime}</span>
        </div>
        {totalSeconds > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-600 dark:text-slate-300 text-sm">Productivity:</span>
            <span className={`text-sm font-medium ${productivePercentage >= 50 ? 'text-[#5051F9] dark:text-[#22D3EE]' : 'text-[#FF6B6B]'}`}>
              {productivePercentage}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default CustomTooltip
