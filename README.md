# FocusBook

**FocusBook** is a Windows desktop app that tracks how you spend time on your
computer, categorizes it as productive  / distracting, and helps you
stay focused by optionally blocking distracting apps during focus sessions. It
runs quietly in the system tray and gives you detailed, retroactively
re-categorizable analytics of your day.

Built with **Electron + React**, backed by a local **SQLite** database. All data
stays on your machine.

> **Platform:** Windows only. The tracking core relies on Windows APIs
> (PowerShell process resolution + `electron-active-window`), so macOS/Linux
> targets are intentionally not built — they would install an app that records no
> data.

---

## Features

- **Automatic activity tracking** — records which app/window is in the
  foreground, and (for supported browsers) which site you're on.
- **Retroactive categorization** — activity is stored as an immutable event log
  of *what ran*; categories are resolved at query time. Edit a rule and your
  entire history re-categorizes instantly, with no data rewrite.
- **Presence & idle awareness** — a parallel log records whether you were
  actually *present* (active / idle / locked / suspended / unknown), so time away
  from the keyboard is never mistaken for work.
- **Focus mode & distraction blocking** — after a configurable stretch of
  productive work, a focus session starts automatically; switching to a
  distracting app shows a fullscreen prompt (Stay Focused / Take Break / Not a
  Distraction).
- **Rich dashboard** — day/week views, productivity area chart with drag-to-zoom,
  focus trends, timeline, and a most-used-apps breakdown (Recharts).
- **Fully editable taxonomy** — manage categories and rules in
  Settings → Categories Management. Most-specific rule wins; your rules beat the
  built-ins.
- **System tray integration** — global shortcuts, minimize-to-tray, quick actions.

---

## How It Works

### Processes

- **Main** (`src/main/index.js`) — windows, system tray, global shortcuts, IPC,
  focus-session timing, the distraction popup, and the SQLite database.
- **Preload** (`src/preload/index.js`) — the tracking loop: active-window
  monitoring, idle detection via Electron's `powerMonitor`, and the focus/popup
  enforcement logic. Bridges to the renderer via `contextBridge`.
- **Renderer** (`src/renderer/src/`) — the React UI (HashRouter). Routes:
  Dashboard (`/`), Apps/Activity (`/apps`), Focus Timer (`/focus`),
  Settings (`/settings`).

### Data model (span architecture)

Activity is recorded as an immutable **`span`** event log that stores *what* ran
(app / domain / path / title) — **never a category**. Category and productivity
are resolved at **query time** by joining spans against the current `rule` /
`category` tables (`src/main/classification/resolver.js`). That's what makes
re-categorization retroactive and free.

A sibling **`presence_span`** log records whether you were present, as typed,
gapless intervals — absence is always an explicit span, never a hole in the data.
A liveness watermark backfills crash/power-loss windows as `unknown` so the app
can't hallucinate "11 hours of coding overnight."

Storage lives at `{userData}/focusbook.db` (schema in
`src/main/database/schema.sql`), plus small JSON side-files in `userData`
(`config.json`, `ui-state.json`, `browser-bridge.json`, `window-state.json`).

### Browser tracking

The companion **browser extension** (`extension/`) connects to a local WebSocket
server (`src/main/browserBridge.js`) and reports the active tab's URL/domain for
Chromium browsers (Chrome, Brave, Edge). When the extension isn't connected,
browser time falls back to guessing the site from the window title; such spans
are flagged `degraded` and shown in the UI as *"estimated."* Incognito/PWA
windows are deliberately not URL-tracked.

---

## Getting Started

### Prerequisites

- **Windows** 10/11
- **Node.js** ≥ 22.12

### Install & run

```bash
npm install      # install dependencies
npm run dev      # start with hot reload
```

### Build (Windows)

```bash
npm run build:win        # full NSIS installer (output in dist/)
npm run build:unpack     # build without packaging, for testing
```

### Other commands

```bash
npm run lint      # ESLint
npm run format    # Prettier
npm start         # preview the built app
```

---

## Categories & Focus Mode

**Categories** — the span-model taxonomy (Coding, Communication, Browsing,
Utilities, Entertainment, Social, Uncategorized) is seeded in `schema.sql` and is
fully user-editable in **Settings → Categories Management**. There are three
productivity levels: **Productive**, **Neutral**, **Distracting**. Because
category is resolved at query time, every edit is retroactive.

**Focus & Blocking** — configurable in **Settings → Focus & Blocking**: a global
on/off switch, the productive-minutes threshold that auto-starts a session, and
the session length (persisted in `ui-state.json`, applied live). During a
session, switching to a distracting app shows a fullscreen popup. `ESC` is a safe
dismiss — it does *not* close the app; only an explicit **Stay Focused** click
(or the `1` key) closes the offending app/tab.

**Global shortcuts:** `Ctrl+O` show window · `Ctrl+Q` quit.

---

## Project Structure

```
src/
├── main/                     # Electron main process
│   ├── index.js              # entry: windows, tray, shortcuts, IPC, focus/popup
│   ├── browserBridge.js      # WebSocket server for the browser extension
│   ├── classification/       # span resolver, adapters (query-time categorization)
│   └── database/             # SQLite schema + services
├── preload/
│   └── index.js              # tracking loop + contextBridge API
└── renderer/src/             # React UI (Dashboard, Activity, Focus, Settings)

extension/                    # companion browser extension (active-tab reporter)
docs/                         # architecture & engine specs
```

---

## Tech Stack

- **Electron** + **electron-vite** — desktop shell & build system
- **React 18** + **React Router** (HashRouter), **Tailwind CSS**, **Radix UI**,
  **Recharts**, **Lucide** icons
- **SQLite** (`sqlite3`) — local data store
- **ws** — WebSocket bridge to the browser extension
- **electron-builder** — Windows NSIS packaging & auto-update

---

## Notes

- The tracking loop runs a fast (~5s) app-switch check plus a regular (~15s)
  tick. Slices under ~10s are dropped; very long slices are capped as likely idle.
- **Python is optional** — used only by the (currently disabled) AI insights
  service. Neither `npm install` nor `npm run build` requires it.
- There's no formal test framework yet; Electron behavior is verified manually.

For deeper architecture details, see [`docs/`](docs/) —
[`PRESENCE_AND_IDLE_ENGINE.md`](docs/PRESENCE_AND_IDLE_ENGINE.md) and
[`BUCKET_AGGREGATION_ENGINE.md`](docs/BUCKET_AGGREGATION_ENGINE.md) in particular.
