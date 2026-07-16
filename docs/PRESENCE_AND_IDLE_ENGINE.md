# Presence & Idle Engine — Design

Tracks **whether the user was present**, as a first-class, gapless event log — the
peer of the activity `span` log, not a filter on top of it. Today the tracker
*discards* absence: `updateAppUsage` early-returns on `idle`/`locked`/`unknown` and
resets `lastUpdateTime`, so the time simply vanishes from the record. This engine
replaces that hole with an explicit, typed, backdated span for every second the app
was alive.

> **One-line summary.** Idle isn't a gap in your data; it's a *claim* your app makes
> about the world — backdated to the last moment you had evidence, refined by stronger
> signals when they arrive, and always open to the user telling you what it really was.

This is the **third** instance of the project's one data shape:

| Log (immutable observation) | Interpretation layer (mutable, resolved at query time) |
|---|---|
| `span` — what app/URL ran | `rule` → category, `productivity_override` → verdict |
| `span` — work-mode signals | mode scorer / `mode_overrides` |
| **`presence_span` — was the user here** | **`span_annotation` — what the absence *meant*** |

Nothing in any log is ever rewritten. Every layer of judgment resolves on top.

---

## 1. The four kinds of absence

"The user isn't typing" and "the user isn't there" are different claims, and the app
only ever has evidence for the first. These are **distinct span types** — collapsing
them into one "not working" bucket throws away information the dashboard wants
("locked 45 min" is lunch; "idle 45 min" might be a design review worth crediting).

| Type | Evidence | Certainty | Notes |
|---|---|---|---|
| `active` | input within threshold | — | the only "present" state |
| `idle` | no input for N min, machine awake | **inference — can be wrong** | the false-idle problem (§7) |
| `locked` | Win+L / screensaver lock | strong — deliberate "I'm leaving" | |
| `suspended` | machine slept / powered off | definitive — time wasn't spent | |
| `unknown` | app died without a goodbye (crash, kill, power cut, BSOD) | none — discovered at startup | the one everybody forgets (§5) |

`active` is produced by the existing activity tracker. The other four are produced by
this engine. Every one is an **explicit span**, never the absence of a span.

---

## 2. Signals & where they live

The activity tracker runs in the **preload**; `powerMonitor` and the DB live in
**main**. The presence state machine is owned by **main** (it's the side that receives
the OS events and holds the watermark). The preload's `active` spans and main's
presence spans share one timeline and must tile it without gaps or overlaps (§4).

| Signal | API (main) | Use |
|---|---|---|
| suspend / resume | `powerMonitor.on('suspend'\|'resume')` | open/close `suspended` |
| lock / unlock | `powerMonitor.on('lock-screen'\|'unlock-screen')` | upgrade absence to `locked` |
| **seconds since last input** | `powerMonitor.getSystemIdleTime()` | **backdating (§3) — the load-bearing call** |
| coarse state | `powerMonitor.getSystemIdleState(threshold)` | idempotent recompute after any event |
| logoff/shutdown (Windows) | `app.on('session-end')` | best-effort close; **never** a correctness dependency |

**Windows trap.** `powerMonitor` has no usable `shutdown` on Windows — use
`app.on('session-end')` (logoff/shutdown/restart). Windows gives a short window and can
kill you anyway, so `session-end` is nice-to-have. Correctness comes from the watermark
(§5), not from any shutdown event.

**`getSystemIdleTime()` is machine-wide** (console session input). Don't over-trust it
under RDP (§8).

---

## 3. The insight that matters most: detection time ≠ departure time

Threshold 5 min: at 10:05 you *learn* the user went idle, but they left at **10:00**.
Close the active span at 10:05 and you've credited 5 min of "focused coding" to an empty
chair. All day, that systematically inflates the focus score — the quiet wrongness that
makes people stop trusting a tracker.

**Always backdate the entry edge:**

```
lastInputAt = now - getSystemIdleTime() * 1000
// truncate the open active span to lastInputAt
// start the idle span at lastInputAt
```

Backdating applies to the **entry edge only**. When input resumes at 10:23, the idle
span ends at 10:23 and the new active span starts there — no backdating on exit.

`getSystemIdleTime()` exists precisely for this: it answers "when did they leave," not
"are they gone."

---

## 4. The gapless invariant (the correctness spine)

> **For any period the app was running, presence spans tile the timeline with no gaps
> and no overlaps.** Every second is exactly one of `active | idle | locked | suspended
> | unknown`.

This gives a cheap, brutal test:

```
sum(span durations over window W) === wall-clock elapsed over W
```

Any state-machine bug — missed transition, double-close, lost resume — surfaces
immediately as a gap or overlap. Without the invariant those bugs are invisible until a
user emails about a weird day. This is the executable statement of the thing that must
never break — the same role the retroactive-recategorization test plays for the rule
engine.

Two mechanics enforce it:

- **Compute duration from timestamps, never accumulate ticks.** On suspend, timers stop
  firing; a per-poll counter reads an 8-hour sleep as zero, and `setInterval` deltas go
  chaotic across resume. Every duration is `end_ts - start_ts` captured at the edges.
- **Measure with a monotonic clock, display with wall-clock.** The wall clock can jump
  (NTP, DST, user edit); a correction must never mint a negative-length span. Store
  wall-clock for display (`start`/`end`), use `performance.now()`/monotonic for interval
  math and for detecting jumps. This extends the `emitSpan` monotonic-floor guard already
  in the preload (`lastSpanEnd`) — the same floor applies across both logs.

---

## 5. The watermark: surviving a crash

You cannot get an event for a power cut. So write a heartbeat every few seconds (one
SQLite row update — cheap):

```sql
CREATE TABLE IF NOT EXISTS app_liveness (
    id INTEGER PRIMARY KEY CHECK (id = 1),   -- single row
    last_alive_at DATETIME NOT NULL
);
```

Heartbeat: `UPDATE app_liveness SET last_alive_at = ? WHERE id = 1` on a ~5s timer in
main.

**On startup**, read `last_alive_at`:
- If it's meaningfully older than `now` (> heartbeat interval + margin), the app was not
  running for that gap. **Backfill an `unknown` span** `[last_alive_at, startup_now)`.
- Never extend the last open span to the present — that's the classic "I apparently coded
  11 hours straight overnight" bug.

An `unknown` gap is the honest state to show, and a prime candidate for the return
prompt (§7).

---

## 6. The state machine

```
                         input within threshold
        ┌───────────────────────────────────────────────┐
        │                                                ▼
   ┌─────────┐   no input ≥ N (backdate to lastInputAt) ┌──────┐
   │ ACTIVE  │ ───────────────────────────────────────▶ │ IDLE │
   └─────────┘                                           └──────┘
     │   ▲  │ lock-screen                          lock-screen │
     │   │  └───────────────┐          ┌──────────────────────┘
     │   │ unlock &&        ▼          ▼
     │   │ input       ┌──────────┐  (idle upgrades to locked in place —
     │   │             │  LOCKED  │   same absence, stronger evidence; §9)
     │   │             └──────────┘
     │   │ resume+input     │ suspend
     │   │ (recompute)      ▼
     │   │             ┌───────────┐
     │   └─────────────│ SUSPENDED │
     │  suspend        └───────────┘
     ▼
┌───────────┐
│ SUSPENDED │
└───────────┘

   ┌──────────┐
   │ UNKNOWN  │ ◀╌╌╌╌ discovered at STARTUP by comparing watermark to now
   └──────────┘        (one-way, no event — this asymmetry IS the design)
```

Every solid edge arrives as a signal you act on. The dashed edge into `unknown` is the
only one with no event — it's discovered later, at startup, by comparing the watermark
to now. That asymmetry is the whole point.

**Idempotent handlers.** `resume` and `unlock-screen` fire in unpredictable order and
sometimes only one arrives. Don't hand-code the choreography. Every handler does the same
thing: **"whatever just happened, recompute state from `getSystemIdleState()` +
`getSystemIdleTime()` and reconcile the open span."** Recomputation is safe to run twice.

---

## 7. False idle & the annotation table

A 40-min conference talk looks identical to an empty chair. There's no clean technical
fix (audio-session APIs are a heuristic with their own false positives — a background
Spotify tab isn't "working"). The honest answer, à la Rize: **when the user returns from
an absence longer than N minutes, ask.** "You were away 10:00–10:23 — break, or working?"
Cheapest possible feature; converts your worst-quality data into your best.

This respects the immutable-span rule. **The user's answer is a new fact, not a
correction.** The idle span stays exactly as recorded — "no input 10:00–10:23" is true
forever. The interpretation lands beside it:

```sql
CREATE TABLE IF NOT EXISTS span_annotation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    presence_span_id INTEGER NOT NULL,
    user_label TEXT NOT NULL,        -- 'break' | 'working' | 'meeting' | free text
    answered_at DATETIME NOT NULL,
    FOREIGN KEY (presence_span_id) REFERENCES presence_span(id) ON DELETE CASCADE
);
```

Dashboards **join** it at query time, exactly like `rule` and `productivity_override`.
Nothing in the log is rewritten. Same principle, third time: observations immutable,
interpretations beside them and free to change.

---

## 8. Data model

```sql
-- Immutable presence log — sibling of `span`. No interpretation stored.
CREATE TABLE IF NOT EXISTS presence_span (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('active','idle','locked','suspended','unknown')),
    start DATETIME NOT NULL,   -- wall-clock, for display
    end   DATETIME NOT NULL,   -- wall-clock; duration = end - start (never accumulated)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_presence_span_start ON presence_span(start);
CREATE INDEX IF NOT EXISTS idx_presence_span_type  ON presence_span(type);
```

`active` presence spans are redundant with the activity `span` log's coverage and MAY be
omitted for storage — but the gapless test (§4) then treats "covered by an activity span"
as `active`. Recommended v1: **do** write `active` presence spans so one table answers
"were they here," and the invariant test reads a single log.

---

## 9. Edge cases (week-one biters)

- **Lock during the idle countdown.** Input 10:00, lock 10:05, threshold 5 min. The user
  left *once*, at 10:00. Do **not** emit a 5-min idle span then a locked span. The absence
  starts at 10:00; the lock is stronger evidence about *what kind*. **Upgrade the open
  span's type in place** (idle → locked) rather than fragmenting the timeline.
- **Resume without unlock / unlock without resume.** Unpredictable order, sometimes only
  one. Idempotent recompute (§6) makes this a non-issue.
- **RDP & fast user switching.** The session can be disconnected while the machine stays
  awake; `session-end` doesn't fire. Windows session-change notifications cover it —
  **out of scope for v1**, but a *known gap*, not a mystery bug. `getSystemIdleTime()` is
  unreliable here (§2).
- **Idle threshold is a setting; the default matters.** 1 min shreds a reading session
  into confetti; 15 min counts every bathroom break as deep work. **Default 5 min**
  (industry standard), configurable. Note: a threshold change is *retroactive-unfriendly*
  — spans are already segmented. Making threshold changes reapply historically would need
  raw per-input-activity timestamps stored separately. **Skip for v1**; accept the limit.

---

## 10. Build order

1. ✅ **Schema** — `presence_span`, `app_liveness`, `span_annotation` (+ indexes). Guarded
   `CREATE TABLE IF NOT EXISTS`, same as the span model. **[built]**
2. ✅ **Watermark** — heartbeat timer in main; startup reconciliation that backfills the
   `unknown` span. Shipped *first*: pure DB, no state machine, closes the overnight-hole
   bug. **[built — `PresenceService.heartbeat/reconcileOnStartup`]**
3. ✅ **PresenceService** (main) — pure state machine + DB writer, mirroring `SpanService`'s
   shape (`db` with `run`/`all`; unit-testable). Owns the backdating + in-place-upgrade
   math. **[built — `reconcile/observationToType/startTracking/flushOpenSpan/closeTracking`]**
4. ✅ **Wire it** — main owns the state machine as the SINGLE writer, driven by
   `powerMonitor` events (`suspend`/`resume`/`lock-screen`/`unlock-screen`) + a 30s idle
   poll. The preload activity (`span`) log is a separate, unchanged timeline. **[built —
   `readPresenceObservation/reconcilePresence/bindPresenceListeners` in index.js]**
5. ✅ **Gapless-invariant test** — the executable guarantee (§4/§11). Scripted
   active→idle→lock→suspend→resume timeline asserts zero gap/overlap and
   `sum(durations) === elapsed`. **[built — `presenceService.test.js`, 44 tests]**
6. ✅ **Return prompt + annotation** — main fires `away-return` on return from an absence
   ≥5min; the renderer `AwayReturnPrompt` toast asks Working/Break/Meeting and writes a
   `span_annotation` (a new fact — the presence_span is never rewritten). Backlog absences
   (app was closed) are pulled on mount so nothing is lost. Dashboards read via
   `getResolvedPresence` (absence + joined label). **[built — `PresenceService.getUnannotatedAway/
   annotateSpan/getResolvedPresence`; IPC `presence-annotate-span`/`presence-get-unannotated-away`/
   `presence-get-resolved`; `AwayReturnPrompt.jsx`]**

All six steps built and tested (`presenceService.test.js`, 57 tests). The engine is
complete: typed, backdated, gapless presence spans, crash-survivable via the watermark,
with false-idle corrected by user annotations resolved at query time.

### Remaining (not part of the engine itself)
A **presence/timeline dashboard** that visualizes the spans and credits annotated absences
is out of scope here — `getResolvedPresence` is the seam it would consume. The engine
produces the data; no existing dashboard reads it yet.

---

## 11. The invariant test (executable spec)

```js
// presenceService.test.js — the thing that must never break.
// Drive a scripted timeline through the state machine and assert the gapless invariant.
const events = [
  { t: '10:00:00', ev: 'active'  },              // input
  { t: '10:05:00', ev: 'idle',   backdateTo: '10:00:00' }, // detected at :05, left at :00
  { t: '10:07:00', ev: 'lock'    },              // upgrades open span idle→locked in place
  { t: '10:30:00', ev: 'suspend' },
  { t: '13:00:00', ev: 'resume'  },              // + input → active
  // crash gap discovered next launch:
  { t: '18:00:00', ev: 'watermark', lastAliveAt: '13:20:00' }, // → unknown [13:20, 18:00)
]
// assert: spans over [10:00, 18:00) tile with no gap, no overlap,
//         and sum(durations) === 8h exactly.
// assert: exactly one span is `locked` starting at 10:00 (NOT a 7-min idle + locked pair).
// assert: the [13:20,18:00) hole is a single `unknown` span, not an extended active span.
```

Passing this proves the three hardest properties at once: backdating, in-place upgrade,
and crash reconciliation.
