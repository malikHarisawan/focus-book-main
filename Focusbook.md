# FocusBook Architecture Documentation

## Overview

FocusBook is a comprehensive productivity tracking desktop application built with Electron. It monitors application usage, tracks focus sessions, and helps maintain productivity by blocking distracting applications. The application features a hybrid database architecture, real-time data visualization, and intelligent focus management system.

## Core Architecture

### Process Structure

```
┌─────────────────────────────────────────────────────┐
│                MAIN PROCESS                         │
│  ┌─────────────────┐  ┌─────────────────────────┐   │
│  │   Database      │  │   Focus Session         │   │
│  │   Services      │  │   Management            │   │
│  └─────────────────┘  └─────────────────────────┘   │
│  ┌─────────────────┐  ┌─────────────────────────┐   │
│  │   System Tray   │  │   Popup Window          │   │
│  │   & Shortcuts   │  │   Management            │   │
│  └─────────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                    ↕️ IPC Communication
┌─────────────────────────────────────────────────────┐
│                PRELOAD PROCESS                      │
│  ┌─────────────────┐  ┌─────────────────────────┐   │
│  │   Active Window │  │   Category              │   │
│  │   Monitoring    │  │   Management            │   │
│  └─────────────────┘  └─────────────────────────┘   │
│  ┌─────────────────┐  ┌─────────────────────────┐   │
│  │   Python Script │  │   Data Processing       │   │
│  │   Integration   │  │   & Transformation      │   │
│  └─────────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                    ↕️ Context Bridge
┌─────────────────────────────────────────────────────┐
│                RENDERER PROCESS                     │
│  ┌─────────────────┐  ┌─────────────────────────┐   │
│  │   React UI      │  │   Data Visualization    │   │
│  │   Components    │  │   (Charts & Metrics)    │   │
│  └─────────────────┘  └─────────────────────────┘   │
│  ┌─────────────────┐  ┌─────────────────────────┐   │
│  │   Context       │  │   Layout & Navigation   │   │
│  │   Management    │  │   Components            │   │
│  └─────────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Database Architecture

### Hybrid Storage System

FocusBook implements a sophisticated dual-storage approach providing both offline functionality and cloud synchronization:

#### Connection Strategy

- **Primary**: NeDB (local offline storage) - Always available
- **Secondary**: MongoDB Atlas (cloud storage) - Available when online
- **Fallback**: Graceful degradation to offline-only mode
- **Monitoring**: Periodic health checks every 30 seconds

#### Database Models

**1. AppUsage Schema**

```javascript
{
  date: String,           // YYYY-MM-DD format
  hour: String,           // HH:MM format
  appName: String,        // Application identifier
  timeSpent: Number,      // Milliseconds
  category: String,       // Productivity category
  description: String,    // Human-readable app name
  domain: String,         // For browser applications
  timestamps: [{          // Individual session tracking
    start: Date,
    duration: Number
  }]
}
```

**2. Category Schema**

```javascript
{
  name: String,           // Category name
  type: String,           // productive/neutral/distracted
  apps: [String],         // Associated applications
  keywords: [String],     // Matching keywords
  color: String           // UI color code
}
```

**3. CustomCategoryMapping Schema**

```javascript
{
  appIdentifier: String,  // Application identifier
  category: String,       // Assigned category
  userId: String,         // User identifier
  createdAt: Date,
  updatedAt: Date
}
```

### Storage Adapters

#### MongoDB Connection (`src/main/database/connection.js`)

- Mongoose-based with connection pooling
- Retry logic with exponential backoff
- Transaction support for data integrity
- Comprehensive error handling and reconnection

#### NeDB Connection (`src/main/database/nedbConnection.js`)

- File-based local storage in `userData/LocalData/`
- Three database files:
  - `appUsage.db` - Usage tracking data
  - `categories.db` - Category definitions
  - `customCategoryMappings.db` - User overrides
- Indexes for performance optimization
- Manual timestamp management

### Service Layer

#### Application Usage Services

**MongoDB Service** (`src/main/database/appUsageService.js`)

- Advanced aggregation pipelines for statistics
- Bulk operations for efficient data updates
- Analytics methods:
  - `getAppUsageData()` - Retrieve usage statistics
  - `saveAppUsage()` - Store usage data
  - `bulkUpdateAppUsageData()` - Batch operations
- Data cleanup with configurable retention periods

**Local Service** (`src/main/database/localAppUsageService.js`)

- Equivalent functionality adapted for NeDB
- Manual aggregation (NeDB lacks pipeline support)
- Cross-platform date handling
- Memory-efficient querying

#### Category Management Services

**MongoDB Service** (`src/main/database/categoriesService.js`)

- Bulk operations for category management
- Custom mapping management with upsert operations
- Advanced features:
  - Category search and filtering
  - Usage statistics by category
  - Import/export functionality
- Transaction support for data integrity

**Local Service** (`src/main/database/localCategoriesService.js`)

- Offline-equivalent functionality
- Manual relationship management
- Simulated aggregation for statistics

### Background Sync Service

#### Synchronization Strategy (`src/main/database/syncService.js`)

- **Periodic Sync**: Every 5 minutes when online
- **Network-Aware**: Triggers sync on connectivity restoration
- **Queue Management**: Failed operations queued for retry
- **Conflict Resolution**: MongoDB acts as source of truth

#### Sync Operations

- **Bidirectional**: NeDB ↔ MongoDB synchronization
- **Data Types**: Categories, custom mappings, app usage data
- **Batch Processing**: Efficient bulk operations
- **Error Handling**: Comprehensive retry logic

## Data Tracking System

### Active Window Monitoring (`src/preload/index.js`)

#### Core Monitoring System

- **Interval-based tracking**: Updates every 30 seconds
- **Active window detection**: Uses `electron-active-window` library
- **Idle state detection**: Integrates with Electron's `powerMonitor` API (120s threshold)

#### Data Collection Flow

```javascript
async function updateAppUsage() {
  // 1. Check system idle/locked state
  const state = await getCurrentState(120)
  if (state == 'idle' || state == 'locked') return

  // 2. Get current active window
  const currentWindow = await getActiveWindow()

  // 3. Detect app switches (including browser tabs)
  hasAppSwitched = detectAppSwitch(currentWindow)

  // 4. Get app category and check distraction level
  let appIdentifier = getCategory(currentWindow.windowClass)
  const isFocused = !Distracted_List.includes(appIdentifier)

  // 5. Handle focus sessions and popup blocking
  if (isFocused) startFocusSession(isFocused)
  if (!isFocused && isFocusSessionActive) handlePopup(appIdentifier, currentWindow, isDismissed)

  // 6. Update usage data
  updateUsageData(currentWindow, hasAppSwitched)
}
```

### Category Management

#### Multi-layered Category System

1. **Custom mappings** (highest priority): User-defined overrides
2. **Built-in categories**: Predefined in `src/preload/categories.js`
3. **Default fallback**: "Miscellaneous" for unmatched applications

#### Application Categories

- **Code**: Development tools, IDEs, programming resources
- **Browsing**: Educational content, tutorials, research
- **Communication**: Email, messaging, video calls
- **Utilities**: System tools, file managers, calculators
- **Entertainment**: Music, videos, games, social media
- **Miscellaneous**: Unclassified applications

### Browser Integration

#### Python Script Integration

- **URL extraction**: `scripts/get_active_url.py` using `pywinauto`
- **Tab management**: `scripts/closeTab.py` for distraction blocking
- **Process coordination**: Browser PID targeting

#### Browser-specific Tracking

- **Domain extraction**: From active tab URLs
- **Tab change detection**: Window name monitoring
- **Distraction blocking**: Automatic tab closure

## Dashboard and UI Architecture

### React Component Structure

#### Main Dashboard (`src/renderer/src/components/Dashboard/`)

**ProductivityOverview** (`productivity-overview.jsx`)

- Main dashboard orchestrator
- Real-time data loading via IPC
- Multiple view modes (day/week)
- Automatic refresh on visibility change
- Integrated metrics and visualization

**ProductiveAreaChart** (`ProductiveAreaChart .jsx`)

- Advanced interactive area chart
- Multi-level zoom (hour/day/week/month)
- Drag-to-select functionality
- Real-time data processing
- Custom tooltips and navigation

#### Layout Components (`src/renderer/src/components/layout/`)

**MainLayout** (`main-layout.jsx`)

- 12-column responsive grid
- Loading overlay with animations
- Gradient background system
- Sidebar and main content coordination

**Sidebar** (`sidebar.jsx`)

- React Router navigation
- Real-time productivity scores
- Goal progress indicators
- Menu items:
  - Dashboard
  - Focus Timer
  - Activity
  - Tasks
  - Goals
  - Analytics
  - Schedule
  - Settings

**Header** (`header.jsx`)

- Search functionality
- Theme toggle
- Notifications
- User avatar

### Data Visualization

#### Chart Components

- **Recharts Integration**: ResponsiveContainer, AreaChart, Area
- **Interactive Features**: Zoom controls, range selection
- **Custom Tooltips**: Contextual productivity data
- **Gradient Fills**: Visual productivity distinction

#### Metric Display

- **StatCard**: Simple metrics with progress bars
- **MetricCard**: Advanced metrics with trends
- **Status Items**: Sidebar productivity indicators

### State Management

#### DateContext (`src/renderer/src/context/DateContext.jsx`)

- Global date selection management
- Navigation logic (previous/next/today)
- Zoom level-aware date handling
- Formatted date range display

#### Data Processing (`src/renderer/src/utils/dataProcessor.js`)

- **Core Functions**:
  - `processUsageChartData()` - Chart data transformation
  - `processProductiveChartData()` - Productivity datasets
  - `processMostUsedApps()` - Top applications list
  - `getTotalFocusTime()` - Focus time calculations
  - `formatAppsData()` - UI data formatting

### IPC Communication

#### Preload Process Bridge (`src/preload/index.js`)

```javascript
contextBridge.exposeInMainWorld('activeWindow', {
  getAppUsageStats: (date) => getAppUsageStats(date),
  getCategoryAppsData: (date) => getCategoryAppsData(date),
  updateAppCategory: (appId, category, date, appToUpdate) =>
    updateAppCategory(appId, category, date, appToUpdate),
  refreshData: () => loadData(),
  loadCategories: () => loadCategories()
})
```

#### Main Process Handlers (`src/main/index.js`)

- `load-data` - Retrieve app usage data
- `save-data` - Store usage data
- `load-categories` - Fetch category configuration
- `load-custom-categories` - Get custom mappings
- `idle-state` - System idle detection
- `start-focus`/`end-focus` - Focus session management

## Focus Management System

### Focus Session Tracking (`src/main/index.js`)

#### Session Management

- **Timer System**: 1.5-second intervals for real-time updates
- **State Tracking**: Global focus session state
- **Time Accumulation**: Total focus time calculation
- **Visual Feedback**: Real-time UI timer updates

#### Focus Session Flow

```javascript
function startFocusSession(isFocused) {
  if (!isFocusSessionActive && isFocused) {
    isFocusSessionActive = true
    focusStartTime = Date.now()

    // Start timer updates
    focusInterval = setInterval(() => {
      updateFocusTimer()
      sendFocusUpdateToRenderer()
    }, 1500)
  }
}
```

### Distraction Management

#### Popup System

- **Trigger**: Productive → unproductive app switch
- **Fullscreen Overlay**: System-wide distraction blocking
- **User Options**:
  - **Stay Focused**: Closes distracting app
  - **Cooldown**: Temporary dismissal with timer
  - **Dismiss**: Permanent dismissal for session

#### Popup Window Management

```javascript
function createPopupWindow(appIdentifier, window, isDismissed) {
  popup = new BrowserWindow({
    fullscreen: true,
    alwaysOnTop: true,
    frame: false,
    transparent: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  popup.loadFile('popup.html')
  popup.show()
}
```

### Application Blocking

#### Process Management

- **Python Integration**: Tab closure via `closeTab.py`
- **Windows Integration**: `taskkill` command execution
- **Process Targeting**: PID-based application closure
- **Graceful Handling**: Error recovery and logging

## Key Features

### System Integration

- **System Tray**: Context menu with quick actions
- **Global Shortcuts**:
  - `Ctrl+O` - Show main window
  - `Ctrl+Q` - Quit application
- **Startup Management**: Auto-start capability
- **Window Management**: Minimize to tray, restore functionality

### Data Persistence

- **Automatic Saving**: Every 60 seconds
- **Backup System**: Rolling backups (5 most recent)
- **Data Recovery**: Automatic backup restoration
- **Export Functionality**: JSON data export

### Performance Optimizations

- **Lazy Loading**: Data processing utilities
- **Memoized Calculations**: Chart component optimization
- **Debounced Interactions**: User input handling
- **Efficient Queries**: Database indexing and aggregation

### Cross-Platform Support

- **Windows**: Full feature support with Python integration
- **macOS**: Core functionality with adapted window management
- **Linux**: Basic functionality with limited Python features

## Technical Stack

### Core Technologies

- **Electron**: Desktop application framework
- **React**: Frontend UI library
- **Node.js**: Backend runtime
- **MongoDB**: Cloud database
- **NeDB**: Local database
- **Python**: Browser automation scripts

### UI/UX Libraries

- **Tailwind CSS**: Utility-first styling
- **Radix UI**: Accessible component primitives
- **Recharts**: Data visualization
- **Lucide React**: Icon library

### Development Tools

- **Electron Vite**: Build system
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Electron Builder**: Application packaging

## File Structure

```
src/
├── main/
│   ├── database/
│   │   ├── hybridConnection.js     # Dual database orchestration
│   │   ├── appUsageService.js      # MongoDB usage service
│   │   ├── localAppUsageService.js # NeDB usage service
│   │   ├── categoriesService.js    # MongoDB category service
│   │   ├── localCategoriesService.js # NeDB category service
│   │   ├── syncService.js          # Background synchronization
│   │   ├── models.js               # Data models and schemas
│   │   ├── connection.js           # MongoDB connection
│   │   └── nedbConnection.js       # NeDB connection
│   └── index.js                    # Main process entry point
├── preload/
│   ├── index.js                    # Preload process bridge
│   └── categories.js               # Category definitions
└── renderer/
    └── src/
        ├── components/
        │   ├── Dashboard/
        │   │   ├── productivity-overview.jsx
        │   │   └── ProductiveAreaChart.jsx
        │   ├── layout/
        │   │   ├── main-layout.jsx
        │   │   ├── sidebar.jsx
        │   │   └── header.jsx
        │   └── shared/
        ├── context/
        │   └── DateContext.jsx
        ├── utils/
        │   └── dataProcessor.js
        └── main.jsx
```

## Security Considerations

### IPC Security

- **Context Isolation**: Enabled for all renderer processes
- **Preload Script**: Secure API exposure via `contextBridge`
- **Input Validation**: All IPC data validated and sanitized
- **Process Isolation**: Clear boundaries between processes

### Data Protection

- **Local Storage**: Encrypted user data directory
- **Network Security**: TLS for MongoDB connections
- **Credential Management**: No hardcoded credentials
- **Log Sanitization**: Sensitive data excluded from logs

## Development Workflow

### Build Commands

```bash
npm install          # Install dependencies
npm run dev         # Development server
npm run build       # Production build
npm run lint        # Code linting
npm run format      # Code formatting
```

### Platform Builds

```bash
npm run build:win   # Windows build
npm run build:mac   # macOS build
npm run build:linux # Linux build
```

### Testing

- Manual testing required for Electron functionality
- Python script dependencies for Windows systems
- Cross-platform testing for feature compatibility

## Future Enhancements

### Planned Features

- **Advanced Analytics**: Machine learning insights
- **Team Collaboration**: Shared productivity metrics
- **Custom Integrations**: Third-party app connectors
- **Mobile Companion**: iOS/Android sync apps
- **Advanced Blocking**: Website-level filtering

### Architecture Improvements

- **Microservices**: Service-oriented architecture
- **Real-time Sync**: WebSocket-based synchronization
- **Plugin System**: Extensible architecture
- **Performance Monitoring**: Application telemetry
- **Automated Testing**: Comprehensive test suite

This architecture provides a robust foundation for productivity tracking with excellent offline capabilities, seamless cloud synchronization, and comprehensive focus management features.
