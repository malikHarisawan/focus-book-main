# FocusBook Project Context

## Project Overview

FocusBook is a comprehensive productivity tracking desktop application built with Electron. It monitors application usage, tracks focus sessions, and helps maintain productivity by blocking distracting applications. The application features a hybrid database architecture, real-time data visualization, and intelligent focus management system.

### Core Technologies

- **Electron**: Desktop application framework
- **React**: Frontend UI library
- **Node.js**: Backend runtime
- **SQLite**: Local database (replaced NeDB and MongoDB)
- **Python**: Browser automation scripts (Windows-specific)

## Architecture

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

### Key Directories

- `src/main/`: Main Electron process code
  - `src/main/database/`: Database connection and service layer
  - `src/main/popupManager.js`: Popup window management
- `src/preload/`: Preload script for secure IPC bridge
- `src/renderer/`: React frontend code
  - `src/renderer/src/components/`: UI components
  - `src/renderer/src/context/`: React context providers
  - `src/renderer/src/utils/`: Utility functions

## Database Architecture

FocusBook now uses SQLite as its sole database, replacing the previous hybrid NeDB/MongoDB approach. This simplifies the architecture while maintaining all core functionality.

### SQLite Connection (`src/main/database/sqliteConnection.js`)

- File-based local storage in `userData/focusbook.db`
- ACID compliance and data integrity
- Better performance for complex queries and analytics
- SQL query syntax with full relational capabilities
- Full-text search and advanced indexing

### Database Schema (`src/main/database/schema.sql`)

The database contains several tables:
- `app_usage`: Application usage tracking data
- `categories`: Productivity category definitions
- `custom_category_mappings`: User-defined app categorizations
- `focus_sessions`: Focus session tracking and analytics
- `timestamps`: Detailed session timestamps
- `focus_session_interruptions`: Focus session interruption tracking

### Service Layer

#### Application Usage Services (`src/main/database/localAppUsageService.js`)

- Methods for saving and retrieving application usage data
- Analytics methods for generating reports
- Data cleanup with configurable retention periods

#### Category Management Services (`src/main/database/localCategoriesService.js`)

- Methods for managing productivity categories
- Custom mapping management
- Category search and filtering

#### Focus Session Services (`src/main/database/localFocusSessionService.js`)

- Methods for tracking and managing focus sessions
- Interruption tracking
- Session analytics

## Data Tracking System

### Active Window Monitoring (`src/preload/index.js`)

- **Interval-based tracking**: Updates every 30 seconds
- **Active window detection**: Uses `electron-active-window` library
- **Idle state detection**: Integrates with Electron's `powerMonitor` API (120s threshold)

### Category Management

- **Multi-layered Category System**:
  1. Custom mappings (highest priority): User-defined overrides
  2. Built-in categories: Predefined in `src/preload/categories.js`
  3. Default fallback: "Miscellaneous" for unmatched applications

### Browser Integration

- **Python Script Integration**:
  - `scripts/get_active_url.py` for URL extraction using `pywinauto`
  - `scripts/closeTab.py` for distraction blocking
  - Process coordination via browser PID targeting

## UI Architecture

### React Component Structure

- **Main Dashboard**: Productivity overview with charts and metrics
- **Layout Components**: Main layout with sidebar navigation
- **Data Visualization**: Charts using Recharts library
- **State Management**: Date context and data processing utilities

### IPC Communication

- Secure API exposure via `contextBridge` in preload script
- Main process handlers for data operations
- Real-time updates for focus session tracking
V
## Key Features

### System Integration

- **System Tray**: Context menu with quick actions
- **Global Shortcuts**:
  - `Ctrl+O` - Show main window
  - `Ctrl+Q` - Quit application
- **Startup Management**: Auto-start capability
- **Window Management**: Minimize to tray, restore functionality

### Focus Management System

- **Focus Session Tracking**: Timer system with real-time updates
- **Distraction Management**: Popup system for blocking distracting apps
- **Application Blocking**: Python integration for tab closure and process termination
  
## Development Workflow

### Setup

```bash
npm run setup  # Install dependencies and Python packages
```

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

## File Structure

```
src/
├── main/
│   ├── database/
│   │   ├── hybridConnection.js     # Database orchestration (simplified)
│   │   ├── localAppUsageService.js # SQLite usage service
│   │   ├── localCategoriesService.js # SQLite category service
│   │   ├── localFocusSessionService.js # SQLite focus session service
│   │   ├── sqliteConnection.js       # SQLite connection
│   │   └── schema.sql               # Database schema
│   ├── popupManager.js             # Popup window management
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