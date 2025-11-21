/**
 * Event Handlers for ProductiveAreaChart
 *
 * This module contains all event handling logic including:
 * - Mouse event handlers for chart interaction
 * - Keyboard event handlers for shortcuts
 * - Wheel event handlers for zooming
 * - Click outside handlers
 */

/**
 * Create mouse down handler for chart selection
 * @param {Function} setDragStart - Function to set drag start position
 * @param {Function} setIsDragging - Function to set dragging state
 * @param {Function} setDragEnd - Function to set drag end position
 * @returns {Function} Mouse down event handler
 */
export const createMouseDownHandler = (setDragStart, setIsDragging, setDragEnd) => {
  return (e) => {
    if (e && e.activeLabel) {
      setDragStart(e.activeLabel)
      setIsDragging(true)
      setDragEnd(null)
    }
  }
}

/**
 * Create mouse move handler for chart selection
 * @param {boolean} isDragging - Current dragging state
 * @param {Function} setDragEnd - Function to set drag end position
 * @returns {Function} Mouse move event handler
 */
export const createMouseMoveHandler = (isDragging, setDragEnd) => {
  return (e) => {
    if (isDragging && e && e.activeLabel) {
      setDragEnd(e.activeLabel)
    }
  }
}

/**
 * Create mouse up handler for chart selection
 * @param {boolean} isDragging - Current dragging state
 * @param {string} dragStart - Current drag start position
 * @param {string} dragEnd - Current drag end position
 * @param {Array} currentData - Chart data array
 * @param {Function} setSelectedRange - Function to set selected range
 * @param {Function} setIsDragging - Function to set dragging state
 * @param {Function} setDragStart - Function to set drag start position
 * @param {Function} setDragEnd - Function to set drag end position
 * @param {string} zoomLevel - Current zoom level for logging
 * @returns {Function} Mouse up event handler
 */
export const createMouseUpHandler = (
  isDragging,
  dragStart,
  dragEnd,
  currentData,
  setSelectedRange,
  setIsDragging,
  setDragStart,
  setDragEnd,
  zoomLevel
) => {
  return () => {
    if (isDragging && dragStart && dragEnd) {
      console.log('Selection attempt:', {
        dragStart,
        dragEnd,
        zoomLevel,
        dataLength: currentData.length
      })
      const startIndex = currentData.findIndex((item) => item.day === dragStart)
      const endIndex = currentData.findIndex((item) => item.day === dragEnd)
      console.log('Found indices:', { startIndex, endIndex })

      if (startIndex !== -1 && endIndex !== -1) {
        const minIndex = Math.min(startIndex, endIndex)
        const maxIndex = Math.max(startIndex, endIndex)

        setSelectedRange({
          startIndex: minIndex,
          endIndex: maxIndex
        })
        console.log('Selected range set:', { minIndex, maxIndex })
      } else {
        console.warn('Could not find matching indices for selection')
      }
    }

    setIsDragging(false)
    setDragStart(null)
    setDragEnd(null)
  }
}

/**
 * Create wheel handler for zoom functionality
 * @param {Object} containerRef - Container reference
 * @param {Function} zoomIn - Zoom in function
 * @param {Function} zoomOut - Zoom out function
 * @returns {Function} Wheel event handler
 */
export const createWheelHandler = (containerRef, zoomIn, zoomOut) => {
  return (e) => {
    if (containerRef.current && containerRef.current.contains(e.target)) {
      e.preventDefault()
      if (e.deltaY < 0) {
        zoomIn()
      } else {
        zoomOut()
      }
    }
  }
}

/**
 * Create keyboard handler for chart shortcuts
 * @param {Object} containerRef - Container reference
 * @param {Function} zoomIn - Zoom in function
 * @param {Function} zoomOut - Zoom out function
 * @param {Function} resetZoom - Reset zoom function
 * @returns {Function} Keyboard event handler
 */
export const createKeyboardHandler = (containerRef, zoomIn, zoomOut, resetZoom) => {
  return (e) => {
    if (containerRef.current && containerRef.current.contains(document.activeElement)) {
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        zoomIn()
      } else if (e.key === '-') {
        e.preventDefault()
        zoomOut()
      } else if (e.key === '0') {
        e.preventDefault()
        resetZoom()
      }
    }
  }
}

/**
 * Create click outside handler for clearing selection
 * @param {Object} containerRef - Container reference
 * @param {Object} selectedRange - Current selected range
 * @param {Function} clearSelection - Clear selection function
 * @returns {Function} Click outside event handler
 */
export const createClickOutsideHandler = (containerRef, selectedRange, clearSelection) => {
  return (event) => {
    if (containerRef.current && !containerRef.current.contains(event.target) && selectedRange) {
      clearSelection()
    }
  }
}
