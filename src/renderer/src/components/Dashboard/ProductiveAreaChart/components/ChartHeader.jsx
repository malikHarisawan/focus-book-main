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
        <h3 className="text-meta-gray-900 dark:text-white text-sm font-medium">Productivity Over Time</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-meta-gray-500 dark:text-meta-gray-400 bg-meta-gray-100 dark:bg-meta-gray-700 px-2 py-1 rounded-md">
            {zoomLevelLabel}
          </span>
          <button
            onClick={onToggleHelp}
            className="text-meta-gray-400 hover:text-meta-blue-500 transition-colors"
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
            className="text-meta-blue-500 hover:text-meta-blue-600 text-xs px-3 py-1 rounded-lg border border-meta-blue-500 hover:border-meta-blue-600 transition-colors"
          >
            Clear Selection
          </button>
        )}
      </div>
    </div>
  )
}

export default ChartHeader
