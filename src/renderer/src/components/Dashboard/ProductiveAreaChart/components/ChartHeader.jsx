/**
 * ChartHeader Component
 *
 * Header section of the productivity chart containing title, zoom level display,
 * help button, zoom controls, and selection clear button.
 *
 * Props:
 * - zoomLevelLabel: Current zoom level display label
 * - showHelp: Boolean indicating if help panel is visible
 * - onToggleHelp: Function to toggle help panel visibility
 * - selectedRange: Current selected range object
 * - onClearSelection: Function to clear current selection
 * - zoomControls: Zoom control buttons component
 */

import React from 'react'
import { HelpCircle } from 'lucide-react'

const ChartHeader = ({
  zoomLevelLabel,
  showHelp,
  onToggleHelp,
  selectedRange,
  onClearSelection,
  zoomControls
}) => {
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-3">
        <h3 className="text-white text-sm font-medium">Productivity Over Time</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
            {zoomLevelLabel}
          </span>
          <button
            onClick={onToggleHelp}
            className="text-gray-400 hover:text-cyan-400 transition-colors"
            title="Help & Controls"
          >
            <HelpCircle size={14} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {zoomControls}
        {selectedRange && (
          <button
            onClick={onClearSelection}
            className="text-cyan-400 hover:text-cyan-300 text-xs px-3 py-1 rounded border border-cyan-400 hover:border-cyan-300 transition-colors"
          >
            Clear Selection
          </button>
        )}
      </div>
    </div>
  )
}

export default ChartHeader
