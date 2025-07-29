/**
 * ZoomProgressIndicator Component
 *
 * Shows a visual progress bar indicating the current zoom level detail.
 * Ranges from 0% (month view) to 100% (hour view).
 *
 * Props:
 * - progress: Progress percentage (0-100)
 */

import React from 'react'

const ZoomProgressIndicator = ({ progress }) => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">Detail Level:</span>
      <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-gray-400">{Math.round(progress)}%</span>
    </div>
  )
}

export default ZoomProgressIndicator
