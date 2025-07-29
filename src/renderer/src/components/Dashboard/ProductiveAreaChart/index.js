/**
 * ProductiveAreaChart Module
 *
 * This module exports the main ProductiveAreaChart component and all its utilities.
 * Use this as the main entry point for importing the chart functionality.
 *
 * Main Components:
 * - ProductiveAreaChart: The main chart component
 *
 * Utilities (for advanced usage):
 * - zoomUtils: Zoom-related utility functions
 * - selectionUtils: Selection-related utility functions
 * - eventHandlers: Event handling utilities
 *
 * Sub-components (for customization):
 * - ZoomControls: Zoom control buttons
 * - BreadcrumbNavigation: Breadcrumb navigation component
 * - ZoomProgressIndicator: Progress indicator component
 * - HelpPanel: Help panel component
 * - CustomTooltip: Custom tooltip component
 * - ChartHeader: Chart header component
 *
 * Custom Hooks (for state management):
 * - useZoomState: Zoom state management hook
 * - useSelectionState: Selection state management hook
 */

// Main component
export { default } from './ProductiveAreaChart'
export { default as ProductiveAreaChart } from './ProductiveAreaChart'

// Utility modules
export * as zoomUtils from './utils/zoomUtils'
export * as selectionUtils from './utils/selectionUtils'
export * as eventHandlers from './utils/eventHandlers'

// Sub-components
export { default as ZoomControls } from './components/ZoomControls'
export { default as BreadcrumbNavigation } from './components/BreadcrumbNavigation'
export { default as ZoomProgressIndicator } from './components/ZoomProgressIndicator'
export { default as HelpPanel } from './components/HelpPanel'
export { default as CustomTooltip } from './components/CustomTooltip'
export { default as ChartHeader } from './components/ChartHeader'

// Custom hooks
export { default as useZoomState } from './hooks/useZoomState'
export { default as useSelectionState } from './hooks/useSelectionState'
