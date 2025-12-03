/**
 * BreadcrumbNavigation Component
 *
 * Renders breadcrumb navigation for zoom levels, allowing users to jump
 * directly to any zoom level in the hierarchy.
 *
 * Props:
 * - breadcrumbPath: Array of zoom levels from general to specific
 * - currentZoomLevel: Currently active zoom level
 * - onZoomLevelClick: Function called when a breadcrumb is clicked
 */

import React from 'react'
import { ChevronRight } from 'lucide-react'

const BreadcrumbNavigation = ({
  breadcrumbPath,
  currentZoomLevel,
  onZoomLevelClick,
  disabled = false
}) => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-meta-gray-500">View:</span>
      {breadcrumbPath.map((level, index) => (
        <div key={level} className="flex items-center gap-1">
          <button
            onClick={() => !disabled && onZoomLevelClick(level)}
            disabled={disabled}
            className={`text-xs px-2 py-1 rounded-md transition-colors ${
              disabled
                ? 'text-meta-gray-400 cursor-not-allowed'
                : level === currentZoomLevel
                  ? 'bg-meta-blue-500 text-white'
                  : 'text-meta-gray-500 dark:text-meta-gray-400 hover:text-meta-blue-500 hover:bg-meta-gray-100 dark:hover:bg-meta-gray-700'
            }`}
            title={disabled ? 'Zoom disabled when range is selected' : `Switch to ${level} view`}
          >
            {level.charAt(0).toUpperCase() + level.slice(1)}
          </button>
          {index < breadcrumbPath.length - 1 && (
            <ChevronRight size={12} className="text-meta-gray-400" />
          )}
        </div>
      ))}
    </div>
  )
}

export default BreadcrumbNavigation
