/**
 * PresenceService DB-backed tests (watermark + crash reconciliation slice).
 *
 *   node src/main/classification/presenceService.test.js
 *
 * Uses a real in-memory sqlite3 database with the real presence-model tables, so the
 * heartbeat, watermark read, and startup reconciliation are exercised against actual
 * SQL. No Electron, no powerMonitor. `now` is injected everywhere so the tests are
 * deterministic (no wall-clock reads).
 *
 * The load-bearing assertion: a period the app was NOT running is reconstructed as an
 * explicit `unknown` presence span — never a silent hole, never an extended open span.
 */

const sqlite3 = require('sqlite3')
const { PresenceService } = require('./presenceService')

function makeDb() {
  const db = new sqlite3.Database(':memory:')
  return {
    run(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) reject(err)
          else resolve({ lastID: this.lastID, changes: this.changes })
        })
      })
    },
    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
      })
    },
    exec(sql) {
      return new Promise((resolve, reject) => {
        db.exec(sql, (err) => (err ? reject(err) : resolve()))
      })
    },
    close() {
      return new Promise((resolve) => db.close(() => resolve()))
    }
  }
}

let passed = 0
let failed = 0
function ok(cond, label) {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.error(`  ✗ ${label}`) }
}

// Presence-model DDL, kept in sync with schema.sql (the three tables this slice owns).
const DDL = `
CREATE TABLE presence_span (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('active','idle','locked','suspended','unknown')),
  start DATETIME NOT NULL,
  end DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE app_liveness (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_alive_at DATETIME NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE span_annotation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  presence_span_id INTEGER NOT NULL,
  user_label TEXT NOT NULL,
  answered_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (presence_span_id) REFERENCES presence_span(id) ON DELETE CASCADE
);
`

const MIN = 60 * 1000
const T0 = new Date('2026-07-16T09:00:00.000Z').getTime()

async function main() {
  // --- heartbeat + watermark round-trip ---
  {
    const db = makeDb()
    await db.exec(DDL)
    const svc = new PresenceService(db, { heartbeatIntervalMs: 5000, staleMarginMs: 15000 })

    ok((await svc.getWatermark()) === null, 'watermark is null before any heartbeat')

    await svc.heartbeat(T0)
    ok((await svc.getWatermark()) === T0, 'heartbeat writes the watermark')

    await svc.heartbeat(T0 + 5000)
    ok((await svc.getWatermark()) === T0 + 5000, 'heartbeat upserts (single row, advances)')
    const rows = await db.all('SELECT COUNT(*) c FROM app_liveness')
    ok(rows[0].c === 1, 'app_liveness stays a single row across heartbeats')
    await db.close()
  }

  // --- first run ever: no watermark -> nothing to reconcile ---
  {
    const db = makeDb()
    await db.exec(DDL)
    const svc = new PresenceService(db)
    const res = await svc.reconcileOnStartup(T0)
    ok(res.backfilled === false && res.spanId === null, 'first run: no watermark, no backfill')
    const spans = await db.all('SELECT * FROM presence_span')
    ok(spans.length === 0, 'first run: no presence span written')
    await db.close()
  }

  // --- clean restart: watermark fresh (within threshold) -> no unknown span ---
  {
    const db = makeDb()
    await db.exec(DDL)
    const svc = new PresenceService(db, { heartbeatIntervalMs: 5000, staleMarginMs: 15000 })
    await svc.heartbeat(T0)
    // Restart 10s later — below the 20s stale threshold (clean quit/relaunch).
    const res = await svc.reconcileOnStartup(T0 + 10 * 1000)
    ok(res.backfilled === false, 'clean restart within threshold: no backfill')
    const spans = await db.all('SELECT * FROM presence_span')
    ok(spans.length === 0, 'clean restart: no unknown span written')
    await db.close()
  }

  // --- THE crash test: watermark stale -> exactly one unknown span over the gap ---
  {
    const db = makeDb()
    await db.exec(DDL)
    const svc = new PresenceService(db, { heartbeatIntervalMs: 5000, staleMarginMs: 15000 })
    // App was alive at 09:00, then died (power cut). Next launch is 4 hours later.
    await svc.heartbeat(T0)
    const startup = T0 + 4 * 60 * MIN
    const res = await svc.reconcileOnStartup(startup)

    ok(res.backfilled === true, 'crash gap: backfilled')
    const spans = await db.all('SELECT type, start, end FROM presence_span')
    ok(spans.length === 1, 'crash gap: exactly one span written')
    ok(spans[0].type === 'unknown', 'crash gap: span type is unknown')
    ok(
      new Date(spans[0].start).getTime() === T0,
      'crash gap: span starts at the last watermark (not extended backwards)'
    )
    ok(
      new Date(spans[0].end).getTime() === startup,
      'crash gap: span ends at startup now (not extended to a wrong "present")'
    )
    // The overnight bug this prevents: the gap is unknown, NOT credited as active time.
    const active = await db.all("SELECT COUNT(*) c FROM presence_span WHERE type='active'")
    ok(active[0].c === 0, 'crash gap is NOT recorded as active ("coded 11h overnight" bug)')
    await db.close()
  }

  // --- reconcile is not double-counted: after reconcile + fresh heartbeat, a second
  //     reconcile at ~now sees a fresh watermark and does nothing ---
  {
    const db = makeDb()
    await db.exec(DDL)
    const svc = new PresenceService(db, { heartbeatIntervalMs: 5000, staleMarginMs: 15000 })
    await svc.heartbeat(T0)
    const startup = T0 + 60 * MIN
    await svc.reconcileOnStartup(startup)
    // Wiring writes a fresh heartbeat immediately after reconcile:
    await svc.heartbeat(startup)
    const res2 = await svc.reconcileOnStartup(startup + 3 * 1000) // 3s later, within threshold
    ok(res2.backfilled === false, 'second reconcile after fresh heartbeat: no duplicate gap')
    const spans = await db.all('SELECT * FROM presence_span')
    ok(spans.length === 1, 'still exactly one unknown span (not doubled)')
    await db.close()
  }

  // --- writePresenceSpan guards against empty/reversed intervals ---
  {
    const db = makeDb()
    await db.exec(DDL)
    const svc = new PresenceService(db)
    ok((await svc.writePresenceSpan('idle', T0, T0)) === null, 'zero-length span is a no-op')
    ok((await svc.writePresenceSpan('idle', T0 + 1000, T0)) === null, 'reversed span is a no-op')
    const id = await svc.writePresenceSpan('idle', T0, T0 + 1000)
    ok(typeof id === 'number' && id > 0, 'positive-length span is written and returns an id')
    await db.close()
  }

  // ==========================================================================
  // STATE MACHINE tests (spec §6/§9) + THE GAPLESS INVARIANT (spec §4/§11).
  // ==========================================================================

  // Assert the presence log tiles [from, to) with no gap and no overlap, and that
  // sum(durations) === (to - from). `openSpan` (if still open) is included as if it
  // closed at `to`. This is the load-bearing correctness check.
  async function assertGapless(db, svc, from, to, label) {
    const rows = await db.all('SELECT type, start, end FROM presence_span ORDER BY start ASC, id ASC')
    const spans = rows.map((r) => ({
      type: r.type,
      start: new Date(r.start).getTime(),
      end: new Date(r.end).getTime()
    }))
    if (svc.openSpan) spans.push({ type: svc.openSpan.type, start: svc.openSpan.start, end: to })
    spans.sort((a, b) => a.start - b.start)

    let gaplessOk = spans.length > 0 && spans[0].start === from && spans[spans.length - 1].end === to
    let sum = 0
    for (let i = 0; i < spans.length; i++) {
      sum += spans[i].end - spans[i].start
      if (spans[i].end < spans[i].start) gaplessOk = false // reversed
      if (i > 0 && spans[i].start !== spans[i - 1].end) gaplessOk = false // gap or overlap
    }
    ok(gaplessOk, `${label}: spans tile [from,to) with no gap/overlap`)
    ok(sum === to - from, `${label}: sum(durations) === elapsed (${sum} === ${to - from})`)
  }

  // --- active → idle backdates to lastInputAt, not detection time (spec §3) ---
  {
    const db = makeDb()
    await db.exec(DDL)
    const svc = new PresenceService(db, { idleThresholdMs: 5 * MIN })
    svc.startTracking('active', T0)                    // active from 09:00
    // User worked until 09:02, then left. At 09:07 we DETECT idle (idleSeconds=300 ⇒
    // input last seen at 09:02). The active span must end at 09:02, not 09:07.
    const lastInput = T0 + 2 * MIN
    const detectAt = T0 + 7 * MIN
    await svc.reconcile({ idleState: 'idle', idleSeconds: 300 }, detectAt)
    const rows = await db.all("SELECT type, start, end FROM presence_span")
    ok(rows.length === 1 && rows[0].type === 'active', 'active span closed on entering idle')
    ok(
      new Date(rows[0].end).getTime() === lastInput,
      'active span truncated to lastInputAt (09:02), NOT detection time (09:07)'
    )
    ok(svc.openSpan.type === 'idle' && svc.openSpan.start === lastInput, 'idle span starts at lastInputAt (backdated)')
    await assertGapless(db, svc, T0, detectAt, 'active→idle backdated')
    await db.close()
  }

  // --- idle → locked upgrades IN PLACE: one span, not idle+locked pair (spec §9) ---
  {
    const db = makeDb()
    await db.exec(DDL)
    const svc = new PresenceService(db, { idleThresholdMs: 5 * MIN })
    svc.startTracking('active', T0)
    // Worked until 09:02, left, detected idle at 09:07 (idleSeconds=300 ⇒ lastInput 09:02).
    const lastInput = T0 + 2 * MIN
    await svc.reconcile({ idleState: 'idle', idleSeconds: 300 }, T0 + 7 * MIN)
    // Lock fires at 09:09 — same absence, stronger evidence. Must NOT write a separate idle.
    await svc.reconcile({ event: 'lock' }, T0 + 9 * MIN)
    const written = await db.all("SELECT type FROM presence_span")
    ok(written.length === 1 && written[0].type === 'active', 'no idle span written on upgrade (only the active close so far)')
    ok(svc.openSpan.type === 'locked' && svc.openSpan.start === lastInput, 'open span upgraded idle→locked, keeps backdated start (09:02)')
    // Return to active at 09:30 → the locked span (09:02–09:30) is written as ONE span.
    await svc.reconcile({ idleState: 'active', idleSeconds: 0 }, T0 + 30 * MIN)
    const locked = await db.all("SELECT type, start, end FROM presence_span WHERE type='locked'")
    ok(locked.length === 1, 'exactly ONE locked span (not idle+locked fragments)')
    ok(
      new Date(locked[0].start).getTime() === lastInput && new Date(locked[0].end).getTime() === T0 + 30 * MIN,
      'locked span spans the whole absence 09:02–09:30'
    )
    await assertGapless(db, svc, T0, T0 + 30 * MIN, 'idle→locked upgrade')
    await db.close()
  }

  // --- idempotent handlers: reconciling the SAME observation twice does nothing (spec §6) ---
  {
    const db = makeDb()
    await db.exec(DDL)
    const svc = new PresenceService(db, { idleThresholdMs: 5 * MIN })
    svc.startTracking('active', T0)
    // Worked until 09:02 (idleSeconds=300 at 09:07 ⇒ lastInput 09:02), so the active
    // close is a real span; then a second idle observation must not add anything.
    const r1 = await svc.reconcile({ idleState: 'idle', idleSeconds: 300 }, T0 + 7 * MIN)
    const r2 = await svc.reconcile({ idleState: 'idle', idleSeconds: 420 }, T0 + 9 * MIN) // still idle
    ok(r1.changed === true && r2.changed === false, 'second identical-state reconcile is a no-op')
    const rows = await db.all("SELECT COUNT(*) c FROM presence_span")
    ok(rows[0].c === 1, 'no duplicate span from repeated idle observation')
    await db.close()
  }

  // --- resume/unlock order independence: whichever fires, recompute wins (spec §9) ---
  {
    const db = makeDb()
    await db.exec(DDL)
    const svc = new PresenceService(db, { idleThresholdMs: 5 * MIN })
    svc.startTracking('active', T0)
    await svc.reconcile({ event: 'suspend' }, T0 + 2 * MIN)         // suspend at 09:02
    ok(svc.openSpan.type === 'suspended', 'suspended span open')
    // resume fires first with input present → active; a later unlock recompute is a no-op.
    await svc.reconcile({ event: 'resume', idleState: 'active', idleSeconds: 0 }, T0 + 60 * MIN)
    ok(svc.openSpan.type === 'active', 'resume+input → active')
    const r = await svc.reconcile({ event: 'unlock', idleState: 'active', idleSeconds: 0 }, T0 + 60 * MIN + 100)
    ok(r.changed === false, 'redundant unlock after resume is a no-op (order-independent)')
    await assertGapless(db, svc, T0, T0 + 61 * MIN, 'suspend→resume→unlock')
    await db.close()
  }

  // --- flush + backdate interaction: a heartbeat flush must NOT create an overlap ---
  {
    const db = makeDb()
    await db.exec(DDL)
    const svc = new PresenceService(db, { idleThresholdMs: 5 * MIN })
    svc.startTracking('active', T0)
    await svc.flushOpenSpan(T0 + 3 * MIN)   // heartbeat flushes active [09:00,09:03), reopens active@09:03
    // Now idle detected at 09:06 with idleSeconds=360 → lastInputAt=09:00, BEFORE the flush.
    // The clamp must keep the new idle edge at/after the flush boundary (09:03), no overlap.
    await svc.reconcile({ idleState: 'idle', idleSeconds: 360 }, T0 + 6 * MIN)
    await assertGapless(db, svc, T0, T0 + 6 * MIN, 'flush then backdated idle (no overlap)')
    await db.close()
  }

  // --- THE FULL SCRIPTED TIMELINE (spec §11): active→idle→lock→suspend→resume, then close ---
  {
    const db = makeDb()
    await db.exec(DDL)
    const svc = new PresenceService(db, { idleThresholdMs: 5 * MIN })
    const t = (m) => T0 + m * MIN
    svc.startTracking('active', t(0))                                         // 09:00 active
    await svc.reconcile({ idleState: 'idle', idleSeconds: 300 }, t(5))        // left 09:00, idle
    await svc.reconcile({ event: 'lock' }, t(7))                             // upgrade → locked
    await svc.reconcile({ event: 'suspend' }, t(30))                         // upgrade → suspended
    await svc.reconcile({ event: 'resume', idleState: 'active', idleSeconds: 0 }, t(180)) // 12:00 active
    await svc.closeTracking(t(200))                                          // clean quit 12:20
    await assertGapless(db, svc, t(0), t(200), 'full scripted timeline')
    // The absence 09:00–12:00 is ONE span (locked upgraded to suspended in place), not fragments.
    const absence = await db.all("SELECT type, start, end FROM presence_span WHERE type IN ('idle','locked','suspended') ORDER BY start")
    ok(absence.length === 1, 'the whole 09:00–12:00 absence is a single span (upgraded in place)')
    ok(absence[0].type === 'suspended', 'final absence type is the strongest evidence (suspended)')
    ok(
      new Date(absence[0].start).getTime() === t(0) && new Date(absence[0].end).getTime() === t(180),
      'absence span is 09:00–12:00 (backdated entry, exit at resume)'
    )
    await db.close()
  }

  // ==========================================================================
  // ANNOTATIONS (spec §7) — the user's interpretation of an absence.
  // ==========================================================================

  // --- reconcile signals returnedFromAbsence when coming back from a long absence ---
  {
    const db = makeDb()
    await db.exec(DDL)
    const svc = new PresenceService(db, { idleThresholdMs: 5 * MIN })
    svc.startTracking('active', T0)
    // Worked to 09:02, away, detected idle 09:07, back to active 09:40 (38-min absence).
    await svc.reconcile({ idleState: 'idle', idleSeconds: 300 }, T0 + 7 * MIN)
    const back = await svc.reconcile({ idleState: 'active', idleSeconds: 0 }, T0 + 40 * MIN)
    ok(back.returnedFromAbsence === true, 'reconcile flags returnedFromAbsence on idle→active')
    ok(back.closedType === 'idle' && back.closedSpanId != null, 'returns the closed idle span id')
    ok(back.closedDurationMs === 38 * MIN, 'reports the absence duration (38 min)')
    await db.close()
  }

  // --- getUnannotatedAway: long absences only, unannotated, newest first ---
  {
    const db = makeDb()
    await db.exec(DDL)
    const svc = new PresenceService(db)
    // A 2-min idle (too short), a 30-min locked (prompt-worthy), a 10-min idle (worthy).
    await svc.writePresenceSpan('active', T0, T0 + 60 * MIN)
    await svc.writePresenceSpan('idle', T0 + 60 * MIN, T0 + 62 * MIN)          // 2m - skip
    const lockedId = await svc.writePresenceSpan('locked', T0 + 62 * MIN, T0 + 92 * MIN) // 30m
    const idleId = await svc.writePresenceSpan('idle', T0 + 92 * MIN, T0 + 102 * MIN)    // 10m

    const away = await svc.getUnannotatedAway(T0, T0 + 200 * MIN, 5 * MIN)
    ok(away.length === 2, 'only the two ≥5min absences are returned (2-min idle filtered)')
    ok(away[0].id === idleId && away[1].id === lockedId, 'newest-first ordering')
    ok(!away.some((a) => a.type === 'active'), 'active spans are never prompted')

    // Annotate the locked one → it drops out of the unannotated list.
    await svc.annotateSpan(lockedId, 'lunch', T0 + 105 * MIN)
    const away2 = await svc.getUnannotatedAway(T0, T0 + 200 * MIN, 5 * MIN)
    ok(away2.length === 1 && away2[0].id === idleId, 'annotated span removed from prompt list')
    await db.close()
  }

  // --- annotateSpan is idempotent per span: re-answer replaces, never duplicates ---
  {
    const db = makeDb()
    await db.exec(DDL)
    const svc = new PresenceService(db)
    const id = await svc.writePresenceSpan('idle', T0, T0 + 20 * MIN)
    await svc.annotateSpan(id, 'break', T0 + 21 * MIN)
    await svc.annotateSpan(id, 'working', T0 + 22 * MIN) // corrected answer
    const rows = await db.all('SELECT user_label FROM span_annotation WHERE presence_span_id = ?', [id])
    ok(rows.length === 1, 'one annotation per span (re-answer replaces)')
    ok(rows[0].user_label === 'working', 'latest answer wins')
    await db.close()
  }

  // --- getResolvedPresence: absence carries its label; the span itself is unchanged ---
  {
    const db = makeDb()
    await db.exec(DDL)
    const svc = new PresenceService(db)
    const lockedId = await svc.writePresenceSpan('locked', T0, T0 + 40 * MIN)
    await svc.annotateSpan(lockedId, 'working', T0 + 41 * MIN)
    const resolved = await svc.getResolvedPresence(T0, T0 + 60 * MIN)
    ok(resolved.length === 1, 'one presence span in range')
    ok(resolved[0].type === 'locked', 'the FACT is unchanged — still a locked span')
    ok(resolved[0].userLabel === 'working', 'the label is joined in (interpretation beside the fact)')
    // Prove immutability: the presence_span row has no label column touched.
    const raw = await db.all('SELECT type FROM presence_span WHERE id = ?', [lockedId])
    ok(raw[0].type === 'locked', 'presence_span row never rewritten by annotation')
    await db.close()
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
