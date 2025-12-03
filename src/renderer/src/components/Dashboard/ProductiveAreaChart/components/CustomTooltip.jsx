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
    <div className="bg-white dark:bg-meta-gray-800 p-3 rounded-lg border border-meta-gray-200 dark:border-meta-gray-700 shadow-lg">
      <p className="text-meta-gray-900 dark:text-meta-gray-100 font-medium mb-2">{getTooltipTitle(hasSelection, zoomLevel)}</p>
      <div className="text-xs text-meta-gray-500 dark:text-meta-gray-400 mb-2">{zoomLevelDetail}</div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-meta-green-500" />
          <span className="text-meta-gray-600 dark:text-meta-gray-300">Productive: </span>
          <span className="text-meta-gray-900 dark:text-white">{productiveTime}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-meta-red-500" />
          <span className="text-meta-gray-600 dark:text-meta-gray-300">Unproductive: </span>
          <span className="text-meta-gray-900 dark:text-white">{unproductiveTime}</span>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-meta-gray-200 dark:border-meta-gray-600">
          <span className="text-meta-gray-600 dark:text-meta-gray-300">Total: </span>
          <span className="text-meta-blue-600 dark:text-meta-blue-400 font-medium">{totalTime}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-meta-gray-600 dark:text-meta-gray-300">Productivity: </span>
          <span className="text-meta-green-600 dark:text-meta-green-400 font-medium">{productivePercentage}%</span>
        </div>
      </div>
    </div>
  )
}

export default CustomTooltip
