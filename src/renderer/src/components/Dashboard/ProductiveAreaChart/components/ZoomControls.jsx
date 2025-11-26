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
        className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed text-xs p-2 rounded border border-cyan-600 dark:border-cyan-400 hover:border-cyan-700 dark:hover:border-cyan-300 disabled:border-gray-400 dark:disabled:border-gray-500 transition-all duration-200 hover:bg-cyan-600 dark:hover:bg-cyan-400 hover:bg-opacity-10"
        title={
          disabled ? 'Zoom disabled when range is selected' : 'Zoom In (+) - More detailed view'
        }
      >
        <ZoomIn size={12} />
      </button>

      <button
        onClick={onZoomOut}
        disabled={!canZoomOut || disabled}
        className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed text-xs p-2 rounded border border-cyan-600 dark:border-cyan-400 hover:border-cyan-700 dark:hover:border-cyan-300 disabled:border-gray-400 dark:disabled:border-gray-500 transition-all duration-200 hover:bg-cyan-600 dark:hover:bg-cyan-400 hover:bg-opacity-10"
        title={
          disabled ? 'Zoom disabled when range is selected' : 'Zoom Out (-) - Broader time view'
        }
      >
        <ZoomOut size={12} />
      </button>

      <button
        onClick={onReset}
        disabled={disabled}
        className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 disabled:text-gray-400 dark:disabled:text-gray-500 disabled:cursor-not-allowed text-xs p-2 rounded border border-cyan-600 dark:border-cyan-400 hover:border-cyan-700 dark:hover:border-cyan-300 disabled:border-gray-400 dark:disabled:border-gray-500 transition-all duration-200 hover:bg-cyan-600 dark:hover:bg-cyan-400 hover:bg-opacity-10"
        title={disabled ? 'Zoom disabled when range is selected' : 'Reset to default view (0)'}
      >
        <RotateCcw size={12} />
      </button>
    </div>
  )
}

export default ZoomControls
