# FocusBook Tab Reporter (browser extension)

This Manifest V3 extension reports the **active browser tab** to the FocusBook
desktop app over a local, token-authenticated WebSocket. It replaces the old
`get_active_url.py` (pywinauto) URL lookup.

It works from one codebase in **Chrome, Brave, and Microsoft Edge**.

The extension reports **state only** — which tab is active in which window, and
which window is focused. It never measures or reports durations or "time spent";
the FocusBook focus tracker remains the sole authority on when time is spent.

## Install (unpacked)

1. Open your browser's extensions page:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this `extension/` folder.
4. Open the extension's **Options** page (Details → Extension options).
5. In FocusBook, open **Settings** and copy the pairing token, then paste it
   into the Options page and click **Save token**.

The extension connects automatically once the token is saved, and reconnects on
its own if the desktop app restarts.

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
