# FocusBook Tab Reporter (browser extension)

This Manifest V3 extension reports the **active browser tab** to the FocusBook
desktop app over a local, token-authenticated WebSocket. It replaces the old
`get_active_url.py` (pywinauto) URL lookup.

It works from one codebase in **Chrome, Brave, and Microsoft Edge**.

The extension reports **state only** — which tab is active in which window, and
which window is focused. It never measures or reports durations or "time spent";
the FocusBook focus tracker remains the sole authority on when time is spent.

## Install (unpacked, auto-paired)

FocusBook stamps the pairing token into this folder (`focusbook-token.js`) when
you open it from **Settings → Getting Started → Open extension folder**, so the
loaded extension connects on its own — no token to copy.

1. In FocusBook, click **Open extension folder** (this pre-pairs it).
2. Open your browser's extensions page:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select that folder.

It connects within a few seconds; "Connected" appears in FocusBook.

### Manual pairing (fallback)

If the folder was read-only (rare) or you're pairing a checkout the app never
stamped, open the extension's **Options** page (Details → Extension options),
paste the token from FocusBook's Settings, and click **Save token**. A token
entered here always overrides the bundled one.

## How it stays alive

MV3 service workers can be suspended. The extension keeps reporting via:

- A heartbeat over the socket every 10s (active WebSocket traffic keeps the
  worker awake).
- A `chrome.alarms` alarm (every 30s) that resurrects the worker if it was
  killed, re-establishes the socket, and re-sends a fresh snapshot.

## Privacy

- Only `https?://` URLs of the **active** tab in each normal window are sent.
- Incognito/private windows and PWA windows appear as private to the desktop
  app; no URL is ever guessed for them.
- The token authenticates the local connection; without it, the desktop app
  rejects the socket.
