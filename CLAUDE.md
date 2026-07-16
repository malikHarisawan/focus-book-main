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
- Application usage tracking; browser tab/URL detection via a local WebSocket
  bridge to a companion browser extension (NOT Python — see below)
- Category assignment and custom category mapping
- Reads user blocking settings (`ui-state.json`) and enforces the focus/popup logic

**Renderer Process** (`src/renderer/src/`)

- React-based UI with React Router (HashRouter) for navigation
- Routes: Dashboard (`/`), Apps/Activity (`/apps`, legacy `/activity`), Focus
  Timer (`/focus`), Settings (`/settings`). A `/chat` AI-insights route exists but
  is disabled (the AI service is not spawned in this build).
- First-run onboarding modal (`Onboarding/WelcomeModal.jsx`) gated on
  `ui-state.json`'s `onboardingCompleted` flag
- Uses Tailwind CSS for styling with Radix UI components
- Real-time data visualization with Recharts

### Data Architecture

**Storage**: SQLite database at `{userData}/focusbook.db` (see
`src/main/database/schema.sql`), plus small JSON side-files in `userData`
(`config.json`, `ui-state.json`, `browser-bridge.json`, `window-state.json`).

**Span model** (current architecture): activity is recorded as an immutable
`span` event log that stores WHAT ran (app/domain/path/title), never a category.
Category + productivity are resolved at QUERY time by joining spans against the
current `rule`/`category` tables (`src/main/classification/resolver.js`), which is
what makes re-categorization retroactive. A parallel `presence_span` log records
whether the user was present (active/idle/locked/suspended/unknown). The legacy
`app_usage` table still exists for back-compat. The renderer consumes a
legacy-shaped nested object materialized from resolved spans by
`src/main/classification/appUsageAdapter.js`.

### External Dependencies

**Browser Extension Bridge** (`src/main/browserBridge.js`)

- A local WebSocket server the companion browser extension connects to, reporting
  the active tab's URL/domain. This replaced the old Python URL scripts entirely.
- Incognito/PWA windows are deliberately NOT URL-tracked. When the extension is
  not connected, browser time falls back to guessing the site from the window
  title; such spans are flagged `degraded` and surfaced in the UI as "estimated".

**Python** is OPTIONAL and only used by the (currently disabled) AI service; it is
not required by `npm install`, `npm run build`, or normal tracking.

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

- **Windows-only distribution.** The tracking core relies on Windows APIs
  (PowerShell process resolution + `electron-active-window`), so mac/linux targets
  are intentionally not built — they would install an app that records no data.
- Windows NSIS installer

## Development Notes

### File Monitoring

- Tracking loop runs on a fast (~5s) app-switch check plus a regular (~15s) tick
- Slices under ~10 seconds are dropped; very long slices are capped as likely idle
- Browser tabs/URLs are resolved via the browser-extension WebSocket bridge

### Category System

- Span-model taxonomy seeded in `schema.sql` (Coding, Communication, Browsing,
  Utilities, Entertainment, Social, Uncategorized), plus the legacy `categories`
  table (Code, Learning, Browsing, Communication, Utilities, Entertainment, Social
  Media, Miscellaneous)
- Three productivity levels: Productive, Neutral, Distracting
- Fully user-editable via Settings → Categories Management (`CategoryRulesPanel`);
  edits are retroactive because category is resolved at query time
- Most-specific matching rule wins; user rules beat built-ins

### Focus Mode / Blocking

- When enabled, an auto focus session starts after a configurable stretch of
  productive activity; switching to a distracting app during a session shows a
  fullscreen popup (Stay Focused / Take Break / Not a Distraction)
- **User-configurable in Settings → Focus & Blocking**: a global on/off switch,
  the productive-minutes threshold, and the session length (persisted in
  `ui-state.json` under `blocking`, applied live via `blocking-settings-changed`)
- ESC on the popup is a safe dismiss — it does NOT kill the app; only an explicit
  "Stay Focused" click (or the `1` key) closes the offending app/tab

### Code Style

- ESLint with Electron Toolkit configuration
- Prettier for code formatting
- React with functional components and hooks
- Tailwind CSS with custom component library

### Testing Considerations

- No formal test framework currently configured
- Manual testing required for Electron app functionality
- Python script dependencies must be available on Windows systems
