/**
 * CustomTooltip Component
 *
 * Custom tooltip for the productivity chart that shows aggregated data
 * and productivity metrics for the current selection or entire dataset.
 *
 * Props:
 * - active: Boolean indicating if tooltip should be shown
 * - aggregatedData: Object with productive, unproductive, and total time
 * - hasSelection: Boolean indicating if there's an active selection
 * - zoomLevel: Current zoom level for contextual title
 * - zoomLevelDetail: Detailed description of current zoom level
 */

import React from 'react'
import { formatTooltipValue, getTooltipTitle } from '../utils/selectionUtils'

const CustomTooltip = ({ active, aggregatedData, hasSelection, zoomLevel, zoomLevelDetail }) => {
  if (!active) return null

  const productiveTime = formatTooltipValue(aggregatedData.productive)
  const unproductiveTime = formatTooltipValue(aggregatedData.unproductive)
  const totalTime = formatTooltipValue(aggregatedData.total)
  const productivePercentage =
    aggregatedData.total > 0
      ? Math.round((aggregatedData.productive / aggregatedData.total) * 100)
      : 0

  return (
    <div className="bg-gray-800 p-3 rounded border border-gray-700">
      <p className="text-gray-200 font-medium mb-2">{getTooltipTitle(hasSelection, zoomLevel)}</p>
      <div className="text-xs text-gray-400 mb-2">{zoomLevelDetail}</div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-gray-300">Productive: </span>
          <span className="text-white">{productiveTime}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-gray-300">Unproductive: </span>
          <span className="text-white">{unproductiveTime}</span>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-gray-600">
          <span className="text-gray-300">Total: </span>
          <span className="text-cyan-400 font-medium">{totalTime}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-300">Productivity: </span>
          <span className="text-green-400 font-medium">{productivePercentage}%</span>
        </div>
      </div>
    </div>
  )
}

export default CustomTooltip
