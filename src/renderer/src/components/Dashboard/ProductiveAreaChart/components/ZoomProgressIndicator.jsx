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
      <span className="text-xs text-meta-gray-500">Detail Level:</span>
      <div className="flex-1 h-1 bg-meta-gray-200 dark:bg-meta-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-meta-blue-500 to-meta-blue-400 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-meta-gray-500">{Math.round(progress)}%</span>
    </div>
  )
}

export default ZoomProgressIndicator
