/**
 * useZoomState Hook
 *
 * Custom hook for managing zoom state and providing zoom-related functions.
 * Handles zoom level changes, data updates, and parent component communication.
 */

import { useState, useCallback } from 'react'
import { getNextZoomLevel, getPreviousZoomLevel, canZoomIn, canZoomOut } from '../utils/zoomUtils'

const useZoomState = (initialZoomLevel = 'hour', onZoomLevelChange) => {
  const [zoomLevel, setZoomLevel] = useState(initialZoomLevel)

  const handleZoomLevelChange = useCallback(
    (newLevel) => {
      setZoomLevel(newLevel)
      onZoomLevelChange?.(newLevel)
    },
    [onZoomLevelChange]
  )

  const zoomIn = useCallback(() => {
    const nextLevel = getNextZoomLevel(zoomLevel)
    if (nextLevel) {
      handleZoomLevelChange(nextLevel)
    }
  }, [zoomLevel, handleZoomLevelChange])

  const zoomOut = useCallback(() => {
    const prevLevel = getPreviousZoomLevel(zoomLevel)
    if (prevLevel) {
      handleZoomLevelChange(prevLevel)
    }
  }, [zoomLevel, handleZoomLevelChange])

  const resetZoom = useCallback(() => {
    handleZoomLevelChange('hour')
  }, [handleZoomLevelChange])

  const setZoomLevelDirect = useCallback(
    (level) => {
      handleZoomLevelChange(level)
    },
    [handleZoomLevelChange]
  )

  return {
    zoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
    setZoomLevel: setZoomLevelDirect,
    canZoomIn: canZoomIn(zoomLevel),
    canZoomOut: canZoomOut(zoomLevel)
  }
}

export default useZoomState
