/**
 * ZoomControls Component
 *
 * Renders the zoom control buttons and indicators for the ProductiveAreaChart.
 * Includes zoom in/out buttons, reset button, and progress indicator.
 *
 * Props:
 * - zoomLevel: Current zoom level string
 * - onZoomIn: Function called when zoom in button is clicked
 * - onZoomOut: Function called when zoom out button is clicked
 * - onReset: Function called when reset button is clicked
 * - canZoomIn: Boolean indicating if zoom in is possible
 * - canZoomOut: Boolean indicating if zoom out is possible
 */

import React from 'react'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

const ZoomControls = ({
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onReset,
  canZoomIn,
  canZoomOut,
  disabled = false
}) => {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onZoomIn}
        disabled={!canZoomIn || disabled}
        className="text-meta-blue-500 hover:text-meta-blue-600 disabled:text-meta-gray-400 disabled:cursor-not-allowed text-xs p-2 rounded-lg border border-meta-blue-500 hover:border-meta-blue-600 disabled:border-meta-gray-300 dark:disabled:border-meta-gray-600 transition-all duration-200 hover:bg-meta-blue-50 dark:hover:bg-meta-blue-500/10"
        title={
          disabled ? 'Zoom disabled when range is selected' : 'Zoom In (+) - More detailed view'
        }
      >
        <ZoomIn size={12} />
      </button>

      <button
        onClick={onZoomOut}
        disabled={!canZoomOut || disabled}
        className="text-meta-blue-500 hover:text-meta-blue-600 disabled:text-meta-gray-400 disabled:cursor-not-allowed text-xs p-2 rounded-lg border border-meta-blue-500 hover:border-meta-blue-600 disabled:border-meta-gray-300 dark:disabled:border-meta-gray-600 transition-all duration-200 hover:bg-meta-blue-50 dark:hover:bg-meta-blue-500/10"
        title={
          disabled ? 'Zoom disabled when range is selected' : 'Zoom Out (-) - Broader time view'
        }
      >
        <ZoomOut size={12} />
      </button>

      <button
        onClick={onReset}
        disabled={disabled}
        className="text-meta-blue-500 hover:text-meta-blue-600 disabled:text-meta-gray-400 disabled:cursor-not-allowed text-xs p-2 rounded-lg border border-meta-blue-500 hover:border-meta-blue-600 disabled:border-meta-gray-300 dark:disabled:border-meta-gray-600 transition-all duration-200 hover:bg-meta-blue-50 dark:hover:bg-meta-blue-500/10"
        title={disabled ? 'Zoom disabled when range is selected' : 'Reset to default view (0)'}
      >
        <RotateCcw size={12} />
      </button>
    </div>
  )
}

export default ZoomControls
