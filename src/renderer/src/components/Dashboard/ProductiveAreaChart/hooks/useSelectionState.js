/**
 * useSelectionState Hook
 *
 * Custom hook for managing selection state including drag operations
 * and selection range calculations.
 */

import { useState, useCallback } from 'react'
import { createSelectionRange } from '../utils/selectionUtils'

const useSelectionState = () => {
  const [selectedRange, setSelectedRange] = useState(null)
  const [dragStart, setDragStart] = useState(null)
  const [dragEnd, setDragEnd] = useState(null)
  const [isDragging, setIsDragging] = useState(false)

  const clearSelection = useCallback(() => {
    setSelectedRange(null)
    setDragStart(null)
    setDragEnd(null)
    setIsDragging(false)
  }, [])

  const startDrag = useCallback((label) => {
    setDragStart(label)
    setIsDragging(true)
    setDragEnd(null)
  }, [])

  const updateDrag = useCallback(
    (label) => {
      if (isDragging) {
        setDragEnd(label)
      }
    },
    [isDragging]
  )

  const endDrag = useCallback(
    (currentData, zoomLevel) => {
      if (isDragging && dragStart && dragEnd) {
        const range = createSelectionRange(currentData, dragStart, dragEnd)
        if (range) {
          setSelectedRange(range)
        }
      }
      setIsDragging(false)
      setDragStart(null)
      setDragEnd(null)
    },
    [isDragging, dragStart, dragEnd]
  )

  return {
    selectedRange,
    dragStart,
    dragEnd,
    isDragging,
    clearSelection,
    startDrag,
    updateDrag,
    endDrag,
    setSelectedRange
  }
}

export default useSelectionState
