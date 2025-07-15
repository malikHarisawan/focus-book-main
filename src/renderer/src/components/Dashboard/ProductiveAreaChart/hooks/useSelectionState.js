/**
 * useSelectionState Hook
 *
 * Custom hook for managing selection state including drag operations,
 * selection range calculations, and selected app data.
 */

import { useState, useCallback, useEffect } from 'react'
import { createSelectionRange } from '../utils/selectionUtils'

const useSelectionState = () => {
  const [selectedRange, setSelectedRange] = useState(null)
  const [dragStart, setDragStart] = useState(null)
  const [dragEnd, setDragEnd] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedApps, setSelectedApps] = useState([])
  const [isLoadingApps, setIsLoadingApps] = useState(false)

  const clearSelection = useCallback(() => {
    setSelectedRange(null)
    setDragStart(null)
    setDragEnd(null)
    setIsDragging(false)
    setSelectedApps([])
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
    (currentData, zoomLevel, rawData, selectedDate, onAppsExtracted) => {
      if (isDragging && dragStart && dragEnd) {
        const range = createSelectionRange(currentData, dragStart, dragEnd)
        if (range) {
          setSelectedRange(range)

          // Extract apps for the selected range
          if (rawData && selectedDate && onAppsExtracted) {
            setIsLoadingApps(true)

            // Use dynamic import to avoid circular dependency
            import('../../../../utils/dataProcessor')
              .then(({ getAppsForSelectedRange }) => {
                try {
                  const apps = getAppsForSelectedRange(
                    rawData,
                    selectedDate,
                    range,
                    currentData,
                    zoomLevel
                  )
                  setSelectedApps(apps)
                  onAppsExtracted(apps)
                } catch (error) {
                  console.error('Error extracting apps:', error)
                  setSelectedApps([])
                } finally {
                  setIsLoadingApps(false)
                }
              })
              .catch((error) => {
                console.error('Error loading dataProcessor:', error)
                setSelectedApps([])
                setIsLoadingApps(false)
              })
          }
        }
      }
      setIsDragging(false)
      setDragStart(null)
      setDragEnd(null)
    },
    [isDragging, dragStart, dragEnd]
  )

  // Update selected apps when range changes externally
  const updateSelectedApps = useCallback(
    (rawData, selectedDate, currentData, zoomLevel) => {
      if (selectedRange && rawData && selectedDate) {
        setIsLoadingApps(true)

        import('../../../../utils/dataProcessor')
          .then(({ getAppsForSelectedRange }) => {
            try {
              const apps = getAppsForSelectedRange(
                rawData,
                selectedDate,
                selectedRange,
                currentData,
                zoomLevel
              )
              setSelectedApps(apps)
            } catch (error) {
              console.error('Error updating selected apps:', error)
              setSelectedApps([])
            } finally {
              setIsLoadingApps(false)
            }
          })
          .catch((error) => {
            console.error('Error loading dataProcessor:', error)
            setSelectedApps([])
            setIsLoadingApps(false)
          })
      }
    },
    [selectedRange]
  )

  // Clear selected apps when range is cleared
  useEffect(() => {
    if (!selectedRange) {
      setSelectedApps([])
    }
  }, [selectedRange])

  return {
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
    setSelectedRange,
    updateSelectedApps
  }
}

export default useSelectionState
