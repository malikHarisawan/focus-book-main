# ProductiveAreaChart Module

A comprehensive, modular productivity visualization chart with interactive zoom and selection features.

## 📁 Module Structure

```
ProductiveAreaChart/
├── README.md                      # This documentation file
├── index.js                       # Main entry point and exports
├── ProductiveAreaChart.jsx        # Main component orchestrator
├── components/                    # Reusable UI components
│   ├── ChartHeader.jsx           # Chart title and controls header
│   ├── ZoomControls.jsx          # Zoom in/out/reset buttons
│   ├── BreadcrumbNavigation.jsx  # Breadcrumb zoom navigation
│   ├── ZoomProgressIndicator.jsx # Progress bar for zoom level
│   ├── HelpPanel.jsx             # Help text and shortcuts
│   └── CustomTooltip.jsx         # Custom chart tooltip
├── hooks/                        # Custom React hooks
│   ├── useZoomState.js           # Zoom state management
│   └── useSelectionState.js      # Selection state management
└── utils/                        # Utility functions
    ├── zoomUtils.js              # Zoom-related calculations
    ├── selectionUtils.js         # Selection and aggregation logic
    └── eventHandlers.js          # Event handling utilities
```

## 🧩 Component Architecture

### Main Component

- **ProductiveAreaChart.jsx**: Orchestrates all functionality and renders the complete chart

### UI Components

- **ChartHeader**: Title, zoom level display, help button, and action buttons
- **ZoomControls**: Zoom in, zoom out, and reset buttons with proper disabled states
- **BreadcrumbNavigation**: Clickable breadcrumb navigation for direct zoom level selection
- **ZoomProgressIndicator**: Visual progress bar showing current zoom detail level
- **HelpPanel**: Collapsible help panel with keyboard shortcuts and instructions
- **CustomTooltip**: Context-aware tooltip showing aggregated productivity data

### Custom Hooks

- **useZoomState**: Manages zoom level state and provides zoom navigation functions
- **useSelectionState**: Handles drag selection state and range calculations

### Utility Modules

- **zoomUtils**: Pure functions for zoom calculations and metadata
- **selectionUtils**: Functions for data aggregation and selection validation
- **eventHandlers**: Factory functions for creating event handlers

## 📖 Usage Examples

### Basic Usage

```jsx
import ProductiveAreaChart from './ProductiveAreaChart'
;<ProductiveAreaChart
  data={hourlyData}
  rawData={fullDataset}
  selectedDate="2024-01-15"
  onZoomLevelChange={(level) => console.log('Zoom changed:', level)}
/>
```

### Advanced Usage with Custom Components

```jsx
import { ProductiveAreaChart, ZoomControls, useZoomState } from './ProductiveAreaChart'

// Custom implementation using the modular parts
const MyCustomChart = () => {
  const { zoomLevel, zoomIn, zoomOut, resetZoom } = useZoomState()

  return (
    <div>
      <ZoomControls
        zoomLevel={zoomLevel}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={resetZoom}
        canZoomIn={true}
        canZoomOut={true}
      />
      {/* Your custom chart implementation */}
    </div>
  )
}
```

## ⚙️ Features

### Interactive Zoom System

- **4 Zoom Levels**: Hour (9AM-9PM), Day (24h), Week (7 days), Month (30 days)
- **Multiple Input Methods**: Mouse wheel, keyboard shortcuts (+/-/0), buttons, breadcrumbs
- **Visual Feedback**: Progress indicator, breadcrumb navigation, help system

### Selection System

- **Drag Selection**: Click and drag to select time ranges
- **Visual Feedback**: Dashed outline while dragging, solid highlight when selected
- **Data Aggregation**: Real-time calculation of selected range metrics

### Responsive Design

- **Adaptive Labels**: Context-aware display labels for each zoom level
- **Responsive Layout**: Works on different screen sizes
- **Accessibility**: Keyboard navigation and screen reader friendly

### Data Processing

- **Smart Data Loading**: Async data processing with loading states
- **Error Handling**: Graceful fallbacks for data processing errors
- **Performance**: Efficient re-renders using React hooks and memoization

## 🔧 Customization

### Styling

All components use Tailwind CSS classes and can be easily customized by modifying the className props or creating theme variants.

### Functionality

Each module is designed to be independently usable:

- Use individual components for custom layouts
- Import utility functions for custom logic
- Extend hooks for additional state management

### Data Processing

The chart works with any data that follows the expected structure:

```javascript
{
  day: string,        // Label for X-axis
  productive: number, // Productive time in seconds
  unproductive: number // Unproductive time in seconds
}
```

## 🚀 Performance Considerations

- **Lazy Loading**: Data processing utilities are imported dynamically
- **Memoized Calculations**: Expensive calculations are memoized
- **Event Handler Optimization**: Event handlers are created with useCallback
- **Minimal Re-renders**: State is split into focused hooks to minimize updates

## 🔍 Debugging

The module includes comprehensive console logging for selection operations. Check the browser console when working with selections to see detailed debugging information.

## 🤝 Contributing

When extending this module:

1. Follow the existing naming conventions
2. Add comprehensive JSDoc comments
3. Keep components focused and single-purpose
4. Add proper error handling
5. Update this README with new features
