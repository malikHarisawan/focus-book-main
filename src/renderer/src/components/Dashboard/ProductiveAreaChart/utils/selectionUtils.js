/**
 * Selection Utilities for ProductiveAreaChart
 *
 * This module handles all selection-related logic including:
 * - Selection range calculations
 * - Drag state management
 * - Data aggregation for selected ranges
 * - Selection validation
 */

/**
 * Calculate aggregated data for a given range or entire dataset
 * @param {Array} data - Chart data array
 * @param {Object|null} selectedRange - Selected range with startIndex and endIndex
 * @returns {Object} Aggregated productive, unproductive, and total time
 */
export const calculateAggregatedData = (data, selectedRange = null) => {
  if (!data || data.length === 0) {
    return { productive: 0, unproductive: 0, total: 0 }
  }

  let startIndex = 0
  let endIndex = data.length - 1

  if (selectedRange) {
    startIndex = selectedRange.startIndex
    endIndex = selectedRange.endIndex
  }

  let totalProductive = 0
  let totalUnproductive = 0

  for (let i = startIndex; i <= endIndex; i++) {
    if (data[i]) {
      totalProductive += data[i].productive || 0
      totalUnproductive += data[i].unproductive || 0
    }
  }

  return {
    productive: totalProductive,
    unproductive: totalUnproductive,
    total: totalProductive + totalUnproductive
  }
}

/**
 * Create selection range from drag coordinates
 * @param {Array} data - Chart data array
 * @param {string} dragStart - Start label from drag
 * @param {string} dragEnd - End label from drag
 * @returns {Object|null} Selection range object or null if invalid
 */
export const createSelectionRange = (data, dragStart, dragEnd) => {
  if (!data || !dragStart || !dragEnd) {
    return null
  }

  console.log('Creating selection range:', { dragStart, dragEnd, dataLength: data.length })

  const startIndex = data.findIndex((item) => item.day === dragStart)
  const endIndex = data.findIndex((item) => item.day === dragEnd)

  console.log('Found indices:', { startIndex, endIndex })

  if (startIndex === -1 || endIndex === -1) {
    console.warn('Could not find matching indices for selection')
    return null
  }

  const minIndex = Math.min(startIndex, endIndex)
  const maxIndex = Math.max(startIndex, endIndex)

  console.log('Created selection range:', { minIndex, maxIndex })

  return {
    startIndex: minIndex,
    endIndex: maxIndex
  }
}

/**
 * Format time value for display
 * @param {number} value - Time value in seconds
 * @returns {string} Formatted time string (e.g., "2h 30m", "45m")
 */
export const formatTooltipValue = (value) => {
  if (value === 0) return '0m'
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

/**
 * Get tooltip title based on selection state and zoom level
 * @param {boolean} hasSelection - Whether there's an active selection
 * @param {string} zoomLevel - Current zoom level
 * @returns {string} Appropriate tooltip title
 */
export const getTooltipTitle = (hasSelection, zoomLevel) => {
  if (hasSelection) return 'Selected Range'

  const titles = {
    hour: 'Current Period Total',
    day: 'Current Day Total',
    week: 'Current Week Total',
    month: 'Current Month Total'
  }
  return titles[zoomLevel] || 'Total'
}
