/**
 * Zoom Utilities for ProductiveAreaChart
 *
 * This module handles all zoom-related logic including:
 * - Zoom level management
 * - Zoom navigation functions
 * - Display labels and progress calculations
 * - Breadcrumb path generation
 */

export const ZOOM_LEVELS = ['month', 'week', 'day', 'hour']

/**
 * Get the display information for a given zoom level
 * @param {string} zoomLevel - Current zoom level ('hour', 'day', 'week', 'month')
 * @returns {Object} Object containing label and detail for the zoom level
 */
export const getZoomLevelDisplay = (zoomLevel) => {
  const displays = {
    hour: { label: '9AM - 9PM', detail: 'Hourly view (12 hours)' },
    day: { label: '24 Hours', detail: 'Full day view (24 hours)' },
    week: { label: '7 Days', detail: 'Weekly view (7 days)' },
    month: { label: '30 Days', detail: 'Monthly view (30 days)' }
  }
  return displays[zoomLevel] || { label: '', detail: '' }
}

/**
 * Calculate zoom progress as a percentage
 * @param {string} zoomLevel - Current zoom level
 * @returns {number} Progress percentage (0-100)
 */
export const getZoomProgress = (zoomLevel) => {
  const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel)
  return ((currentIndex + 1) / ZOOM_LEVELS.length) * 100
}

/**
 * Get breadcrumb path for navigation
 * @param {string} zoomLevel - Current zoom level
 * @returns {Array} Array of zoom levels from most general to current
 */
export const getBreadcrumbPath = (zoomLevel) => {
  const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel)
  return ZOOM_LEVELS.slice(0, currentIndex + 1)
}

/**
 * Get next zoom level (more detailed)
 * @param {string} currentLevel - Current zoom level
 * @returns {string|null} Next zoom level or null if at maximum detail
 */
export const getNextZoomLevel = (currentLevel) => {
  const currentIndex = ZOOM_LEVELS.indexOf(currentLevel)
  if (currentIndex < ZOOM_LEVELS.length - 1) {
    return ZOOM_LEVELS[currentIndex + 1]
  }
  return null
}

/**
 * Get previous zoom level (more general)
 * @param {string} currentLevel - Current zoom level
 * @returns {string|null} Previous zoom level or null if at minimum detail
 */
export const getPreviousZoomLevel = (currentLevel) => {
  const currentIndex = ZOOM_LEVELS.indexOf(currentLevel)
  if (currentIndex > 0) {
    return ZOOM_LEVELS[currentIndex - 1]
  }
  return null
}

/**
 * Check if zoom in is possible
 * @param {string} zoomLevel - Current zoom level
 * @returns {boolean} True if can zoom in
 */
export const canZoomIn = (zoomLevel) => {
  return getNextZoomLevel(zoomLevel) !== null
}

/**
 * Check if zoom out is possible
 * @param {string} zoomLevel - Current zoom level
 * @returns {boolean} True if can zoom out
 */
export const canZoomOut = (zoomLevel) => {
  return getPreviousZoomLevel(zoomLevel) !== null
}
