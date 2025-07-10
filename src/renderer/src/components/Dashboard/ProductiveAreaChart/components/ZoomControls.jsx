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

const ZoomControls = ({ zoomLevel, onZoomIn, onZoomOut, onReset, canZoomIn, canZoomOut }) => {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onZoomIn}
        disabled={!canZoomIn}
        className="text-cyan-400 hover:text-cyan-300 disabled:text-gray-500 disabled:cursor-not-allowed text-xs p-2 rounded border border-cyan-400 hover:border-cyan-300 disabled:border-gray-500 transition-all duration-200 hover:bg-cyan-400 hover:bg-opacity-10"
        title="Zoom In (+) - More detailed view"
      >
        <ZoomIn size={12} />
      </button>

      <button
        onClick={onZoomOut}
        disabled={!canZoomOut}
        className="text-cyan-400 hover:text-cyan-300 disabled:text-gray-500 disabled:cursor-not-allowed text-xs p-2 rounded border border-cyan-400 hover:border-cyan-300 disabled:border-gray-500 transition-all duration-200 hover:bg-cyan-400 hover:bg-opacity-10"
        title="Zoom Out (-) - Broader time view"
      >
        <ZoomOut size={12} />
      </button>

      <button
        onClick={onReset}
        className="text-cyan-400 hover:text-cyan-300 text-xs p-2 rounded border border-cyan-400 hover:border-cyan-300 transition-all duration-200 hover:bg-cyan-400 hover:bg-opacity-10"
        title="Reset to default view (0)"
      >
        <RotateCcw size={12} />
      </button>
    </div>
  )
}

export default ZoomControls
