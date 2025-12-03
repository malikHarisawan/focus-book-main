/**
 * HelpPanel Component
 *
 * Displays help information and keyboard shortcuts for the chart.
 * Shows contextual information based on current zoom level.
 *
 * Props:
 * - isVisible: Boolean controlling panel visibility
 * - zoomLevelDetail: Detailed description of current zoom level
 */

import React from 'react'

const HelpPanel = ({ isVisible, zoomLevelDetail }) => {
  if (!isVisible) return null

  return (
    <div className="bg-meta-gray-50 dark:bg-meta-gray-700 border border-meta-gray-200 dark:border-meta-gray-600 rounded-lg p-3 text-xs space-y-2">
      <div className="text-meta-blue-600 dark:text-meta-blue-400 font-medium">Chart Controls:</div>
      <div className="text-meta-gray-600 dark:text-meta-gray-300 space-y-1">
        <div>
          • <kbd className="bg-meta-gray-200 dark:bg-meta-gray-600 px-1 rounded">Mouse Wheel</kbd> - Zoom in/out
        </div>
        <div>
          • <kbd className="bg-meta-gray-200 dark:bg-meta-gray-600 px-1 rounded">+/-</kbd> keys - Zoom in/out
        </div>
        <div>
          • <kbd className="bg-meta-gray-200 dark:bg-meta-gray-600 px-1 rounded">0</kbd> key - Reset to default
        </div>
        <div>
          • <strong>Click & Drag</strong> on chart to select time range
        </div>
        <div>• Click breadcrumb buttons to jump between views</div>
        <div>• Hover chart for detailed tooltip information</div>
      </div>
      <div className="text-meta-blue-600 dark:text-meta-blue-400 font-medium mt-2">Current View: {zoomLevelDetail}</div>
    </div>
  )
}

export default HelpPanel
