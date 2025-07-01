# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FocusBook is an Electron-based productivity tracking desktop application that monitors application usage, tracks focus sessions, and helps users maintain productivity by blocking distracting applications. The app tracks time spent on different applications, categorizes them as productive/unproductive, and provides detailed analytics.

## Development Commands

### Essential Commands

- `npm install` - Install dependencies
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the application for production
- `npm run lint` - Run ESLint to check for code issues
- `npm run format` - Format code with Prettier

### Platform-Specific Builds

- `npm run build:win` - Build for Windows
- `npm run build:mac` - Build for macOS
- `npm run build:linux` - Build for Linux
- `npm run build:unpack` - Build without packaging (for testing)

### Development Workflow

- `npm start` - Preview the built application
- Use Electron DevTools for debugging (automatically opens in development)

## Architecture Overview

### Core Components

**Main Process** (`src/main/index.js`)

- Electron main process managing windows, system tray, and global shortcuts
- Handles IPC communication between renderer and preload processes
- Manages data persistence to userData directory
- Controls popup window for distraction blocking
- Implements focus session timing and cleanup

**Preload Process** (`src/preload/index.js`)

- Bridge between main and renderer processes using contextBridge
- Active window monitoring using `electron-active-window`
- Application usage tracking with Chrome tab detection via Python scripts
- Category assignment and custom category mapping
- Data processing and persistence coordination

**Renderer Process** (`src/renderer/src/`)

- React-based UI with React Router for navigation
- Three main routes: Dashboard (/), Settings (/settings), Activity (/activity)
- Uses Tailwind CSS for styling with Radix UI components
- Real-time data visualization with Recharts

### Data Architecture

**Storage Location**: App data stored in `userData/Data/` directory

- `data.json` - Main usage tracking data with automatic backups
- `categories_data.json` - User-defined productive/distracted categories
- `custom-categories.json` - Custom application category mappings

**Data Structure**:

- Hierarchical by date → hour → application
- Tracks time, category, domain (for browsers), and timestamps
- Automatic backup system keeps 5 most recent backups

### External Dependencies

**Python Scripts** (Windows-specific):

- `scripts/get_active_url.py` - Extracts active Chrome/Brave tab URL using pywinauto
- `scripts/closeTab.py` - Closes distracting tabs/applications
- Requires `pywinauto` Python package

**Key Features**:

- System tray integration with context menu
- Global keyboard shortcuts (Ctrl+O to show, Ctrl+Q to quit)
- Popup blocking system with cooldown and dismiss functionality
- Focus session tracking with visual timer
- Idle state detection using Electron's powerMonitor

### Component Structure

**Layout Components**:

- `MainLayout` - Main application shell with sidebar navigation
- `Header` - Top navigation bar
- `Sidebar` - Left navigation panel

**Feature Components**:

- `ProductivityOverview` - Dashboard with charts and metrics
- `Activity` - Detailed activity logs and category management
- `Settings` - Application configuration and category setup

**Utility Components**:

- `dataProcessor.js` - Data transformation utilities for charts and statistics
- Context providers for date selection and state management

### Build Configuration

**Electron Vite** (`electron.vite.config.mjs`):

- Separate build configurations for main, preload, and renderer processes
- Custom plugin to copy popup.html to output directory
- React integration for renderer process

**Electron Builder** (`electron-builder.yml`):

- Cross-platform application packaging
- Windows installer creation via `createInstaller.js`

## Development Notes

### File Monitoring

- App continuously monitors active windows every 30 seconds
- Data is automatically saved every 60 seconds
- Chrome/Brave browser tabs are tracked separately using Python automation

### Category System

- Built-in categories: Code, Browsing, Communication, Utilities, Entertainment, Miscellaneous
- Three productivity levels: Productive, Neutral, Un-Productive
- Custom category mappings override default categorization

### Focus Mode

- Triggers when switching from productive to unproductive apps
- Shows fullscreen popup with options: Stay Focused, Cooldown, Dismiss
- Implements cooldown periods and temporary dismissals per app category

### Code Style

- ESLint with Electron Toolkit configuration
- Prettier for code formatting
- React with functional components and hooks
- Tailwind CSS with custom component library

### Testing Considerations

- No formal test framework currently configured
- Manual testing required for Electron app functionality
- Python script dependencies must be available on Windows systems
