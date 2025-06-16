# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **FocusBook**, an Electron-based desktop application for tracking productivity and app usage. It monitors active windows, categorizes applications, and provides analytics through a React-based dashboard.

## Architecture

- **Main Process** (`src/main/index.js`): Electron main process handling window management, system tray, active window tracking, and IPC communication
- **Preload Scripts** (`src/preload/`): Bridge between main and renderer processes, handles app usage tracking and data persistence
- **Renderer Process** (`src/renderer/src/`): React frontend with routing, dashboard components, and data visualization
- **Data Layer**: JSON files in `Data/` directory store usage statistics and app categorizations

### Key Components

- **App Tracking**: Uses `electron-active-window` to monitor active applications and track time spent
- **Categorization**: Apps are categorized as Productive, Neutral, or Un-Productive based on predefined categories
- **Dashboard**: React components using Recharts for data visualization and Radix UI for interface elements
- **Settings**: User configuration for app categories and productivity classifications

## Development Commands

```bash
# Install dependencies
npm install

# Development with hot reload
npm run dev

# Build application
npm run build

# Build platform-specific distributables
npm run build:win    # Windows
npm run build:mac    # macOS  
npm run build:linux  # Linux

# Code quality
npm run lint         # ESLint
npm run format       # Prettier
```

## Data Structure

- Usage data stored in `Data/data.json`
- App categories defined in `src/preload/categories.js`
- Backup files created automatically with timestamps
- Data format: `{ "YYYY-MM-DD": { "apps": { "app_key": { "time": seconds, "category": string, "domain": string } } } }`

## Tech Stack

- **Electron** with Vite build system
- **React** with React Router for navigation
- **Tailwind CSS** for styling
- **Radix UI** components for accessible UI elements
- **Recharts** for data visualization
- **Python scripts** in `scripts/` for browser integration

## File Paths

- Main window: `src/renderer/index.html`
- Popup window: `src/renderer/popup.html` (copied to build output)
- Icon resources: `resources/icon.png`, `icon.ico`
- Build output: `out/` directory