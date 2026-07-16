/**
 * Presence service — the DB-facing layer of the presence/idle engine.
 * See docs/PRESENCE_AND_IDLE_ENGINE.md for the full design.
 *
 * This first slice implements steps 1–2 of the build order: the liveness watermark
 * and crash reconciliation. It deliberately does NOT yet contain the active/idle/
 * locked/suspended state machine (step 3) — those spans are written by a later slice.
 * What it DOES guarantee today is that a period where the app was not running (crash,
 * power cut, force-kill) is recorded as an explicit `unknown` presence span instead of
 * silently vanishing or being folded into an open activity span. That alone closes the
 * "coded 11h straight overnight" bug.
 *
 * Mirrors SpanService: constructed with a `db` exposing async run(sql, params) and
 * all(sql, params), so it runs against the real SQLiteConnection in production and a
 * throwaway connection in tests. Pure I/O — no Electron, no powerMonitor here.
 */

class PresenceService {
  /**
   * @param {object} db object exposing async run(sql, params) and all(sql, params)
   * @param {object} [opts]
   * @param {number} [opts.heartbeatIntervalMs=5000] cadence the heartbeat is written at;
   *   the reconciliation "gap" threshold is derived from it (interval + margin).
   * @param {number} [opts.staleMarginMs=15000] extra slack added to the interval before a
   *   watermark is considered stale, so a slightly-late heartbeat isn't misread as a crash.
   */
  constructor(db, opts = {}) {
    this.db = db
    this.heartbeatIntervalMs = opts.heartbeatIntervalMs || 5000
    this.staleMarginMs = opts.staleMarginMs != null ? opts.staleMarginMs : 15000
    // Idle threshold (ms): no input for this long ⇒ the user is treated as absent.
    // 5 minutes is the industry default (§9): shorter shreds a reading session, longer
    // credits every bathroom break as deep work. Configurable.
    this.idleThresholdMs = opts.idleThresholdMs != null ? opts.idleThresholdMs : 5 * 60 * 1000

    // THE single open presence span. Exactly one span is open at any time, which is what
    // makes the log gapless-by-construction: closing the open span and opening the next
    // in one step can never leave a hole or an overlap. Shape: { type, start } (epoch ms),
    // or null before the machine has started. This is the entire in-memory state — the
    // machine is otherwise a pure function of (open span, observation, now).
    this.openSpan = null
  }

  /** The gap (ms) beyond which a watermark means the app was not running. */
  get staleThresholdMs() {
    return this.heartbeatIntervalMs + this.staleMarginMs
  }

  /**
   * Write a presence span [start, end) of a given type. `start`/`end` are epoch ms or
   * ISO strings; stored as ISO for stable text comparison (matches SpanService.toIso).
   * A zero/negative interval is a no-op — a presence span must have positive length so
   * the gapless invariant never records an empty or reversed interval.
   * @returns {Promise<number|null>} the new span id, or null if skipped
   */
  async writePresenceSpan(type, start, end) {
    const startIso = toIso(start)
    const endIso = toIso(end)
    if (msBetween(startIso, endIso) <= 0) return null
    const result = await this.db.run(
      `INSERT INTO presence_span (type, start, end) VALUES (?, ?, ?)`,
      [type, startIso, endIso]
    )
    return result && (result.lastID ?? result.lastInsertRowid ?? result.id ?? null)
  }

  /** Read the current watermark as epoch ms, or null if never written. */
  async getWatermark() {
    const rows = await this.db.all(`SELECT last_alive_at FROM app_liveness WHERE id = 1`)
    if (!rows || !rows[0] || !rows[0].last_alive_at) return null
    const ms = new Date(rows[0].last_alive_at).getTime()
    return Number.isFinite(ms) ? ms : null
  }

  /**
   * Write the liveness watermark to `now` (epoch ms or ISO). Upserts the single row.
   * Cheap by design (one row) so it can run on a short heartbeat.
   */
  async heartbeat(now) {
    const iso = toIso(now)
    await this.db.run(
      `INSERT INTO app_liveness (id, last_alive_at, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET last_alive_at = excluded.last_alive_at,
                                     updated_at = excluded.updated_at`,
      [iso, iso]
    )
  }

  /**
   * Startup reconciliation — the crash-survival mechanism.
   *
   * Compares the last watermark to `now`. If the app was down for longer than the stale
   * threshold, that window is backfilled as an `unknown` presence span: it is the honest
   * state (we have no evidence for it) and a prime candidate for the return prompt later.
   *
   * Idempotent-friendly: the caller writes a fresh heartbeat immediately AFTER this runs
   * (see wiring), so a second startup won't see the same stale gap twice.
   *
   * @param {number} now epoch ms for "startup time" (injected, not read from wall clock
   *   here, so the function stays pure and testable).
   * @returns {Promise<{ backfilled: boolean, gapMs: number, spanId: number|null }>}
   */
  async reconcileOnStartup(now) {
    const watermark = await this.getWatermark()
    // First run ever: no prior watermark, so there is no gap to attribute.
    if (watermark == null) {
      return { backfilled: false, gapMs: 0, spanId: null }
    }
    const gapMs = now - watermark
    if (gapMs <= this.staleThresholdMs) {
      // The app was alive right up to (near) now — a clean shutdown/restart, no hole.
      return { backfilled: false, gapMs: Math.max(0, gapMs), spanId: null }
    }
    // The app was NOT running for [watermark, now). Record it explicitly.
    const spanId = await this.writePresenceSpan('unknown', watermark, now)
    return { backfilled: true, gapMs, spanId }
  }

  // ==========================================================================
  // STATE MACHINE — the single writer of live presence spans (spec §6).
  // ==========================================================================
  // Exactly ONE span is open at a time (this.openSpan). Every transition is:
  //   1. decide the NEW presence type from the observation,
  //   2. if it differs from the open span's type, close the open span at the
  //      correct edge and open a new one starting AT THAT SAME EDGE (gapless),
  //   3. otherwise leave the open span as-is (idempotent — safe to call twice).
  // No time is ever accumulated; a span's duration is only ever end - start.

  /**
   * Open the first span. Call once after reconcileOnStartup, with the state observed at
   * launch. Idempotent: if a span is already open this is a no-op.
   * @param {string} type initial presence type ('active' | 'idle' | 'locked' | ...)
   * @param {number} now epoch ms
   */
  startTracking(type, now) {
    if (this.openSpan) return
    this.openSpan = { type, start: now }
  }

  /**
   * Map a raw OS observation to a presence type. Pure.
   *   - explicit event 'suspend' / 'lock' / 'unlock' / 'resume' short-circuits;
   *   - otherwise idleState from getSystemIdleState drives it, refined by idleSeconds:
   *     'locked' ⇒ locked, 'active' ⇒ active, and 'idle' is only honoured once the
   *     input has actually been gone ≥ threshold (getSystemIdleState's own threshold
   *     may differ from ours, so we re-check with the authoritative idleSeconds).
   * @param {object} obs { event?, idleState?, idleSeconds? }
   * @returns {string} presence type
   */
  observationToType(obs = {}) {
    if (obs.event === 'suspend') return 'suspended'
    if (obs.event === 'lock') return 'locked'
    // 'resume'/'unlock' carry no verdict on their own — the caller re-polls idle state
    // and passes idleState/idleSeconds, so they fall through to the idle-state branch.
    const idleState = obs.idleState
    if (idleState === 'locked') return 'locked'
    const idleMs = (obs.idleSeconds || 0) * 1000
    if (idleState === 'idle' || idleMs >= this.idleThresholdMs) return 'idle'
    return 'active'
  }

  /**
   * THE reconcile step. Idempotent by design (spec §6): "whatever just happened,
   * recompute the state and reconcile the open span." Call it from every powerMonitor
   * handler and from the periodic tick; running it twice for one real event is safe.
   *
   * Backdating (spec §3): the ENTRY edge into an absence is backdated to when input
   * actually stopped — `now - idleSeconds` — NOT when we detected it. Exit edges use
   * `now`. So an active→idle transition truncates the active span to lastInputAt and
   * starts the idle span there; idle→active ends idle at now.
   *
   * In-place upgrade (spec §9): idle→locked is the SAME absence with stronger evidence,
   * so it does not fragment the timeline — the open idle span is discarded (never
   * written) and replaced by a locked span that KEEPS the original (backdated) start.
   * Same for idle→suspended.
   *
   * @param {object} obs { event?, idleState?, idleSeconds? }
   * @param {number} now epoch ms
   * @returns {Promise<{ changed: boolean, closedType: string|null, openType: string }>}
   */
  async reconcile(obs, now) {
    const newType = this.observationToType(obs)

    if (!this.openSpan) {
      this.openSpan = { type: newType, start: now }
      return { changed: true, closedType: null, openType: newType }
    }

    const open = this.openSpan
    if (newType === open.type) {
      return { changed: false, closedType: null, openType: open.type }
    }

    const enteringAbsence = open.type === 'active' && isAbsence(newType)
    const upgradingAbsence = isAbsence(open.type) && isAbsence(newType)

    if (upgradingAbsence) {
      // Same departure, stronger evidence about what kind. Keep the (already backdated)
      // start; just relabel by swapping the open span's type. Nothing is written yet —
      // the span is still open and will be written when it finally closes.
      this.openSpan = { type: newType, start: open.start }
      return { changed: true, closedType: null, openType: newType, upgraded: true }
    }

    // A real close+open. Determine the boundary edge.
    let edge = now
    if (enteringAbsence) {
      // Backdate to when input actually stopped. Clamp into [open.start, now]: a bad or
      // large idleSeconds can never produce a future edge or precede the open span's
      // start (which, after a heartbeat flush, is the last flush point — so backdating
      // can never reach across a flushed boundary and create an overlap). When the whole
      // open span was already absence (lastInputAt <= open.start) the edge collapses to
      // open.start, the active close is zero-length and writePresenceSpan skips it, so
      // the absence correctly starts at open.start with no fragment.
      const idleMs = (obs.idleSeconds || 0) * 1000
      const lastInputAt = now - idleMs
      edge = Math.min(Math.max(lastInputAt, open.start), now)
    }

    // Close the open span at the edge (zero-length closes are skipped), open the new one
    // at the same edge so the log stays gapless.
    const closedSpanId = await this.writePresenceSpan(open.type, open.start, edge)
    this.openSpan = { type: newType, start: edge }
    // Surface the just-closed absence so the caller can fire the return prompt (§7) when
    // the user comes BACK to active from a long absence. closedSpanId is null for a
    // zero-length (skipped) close.
    const closedDurationMs = edge - open.start
    return {
      changed: true,
      closedType: open.type,
      openType: newType,
      closedSpanId,
      closedDurationMs,
      returnedFromAbsence: isAbsence(open.type) && newType === 'active' && closedSpanId != null
    }
  }

  /**
   * Flush the currently open span up to `now` WITHOUT changing state — used by the
   * heartbeat so an in-progress span is durably persisted at its current length even if
   * the app dies before the next transition. It writes [start, now) and re-opens the
   * SAME type at `now`, so the on-disk log plus the (short) open span always tile the
   * timeline. A no-op if nothing is open or no time has elapsed.
   * @param {number} now epoch ms
   */
  async flushOpenSpan(now) {
    const open = this.openSpan
    if (!open || now <= open.start) return
    await this.writePresenceSpan(open.type, open.start, now)
    this.openSpan = { type: open.type, start: now }
  }

  /**
   * Close the open span at `now` and forget it (clean shutdown). After this the machine
   * has no open span; the next startTracking/reconcile opens a fresh one.
   * @param {number} now epoch ms
   */
  async closeTracking(now) {
    if (this.openSpan) {
      await this.writePresenceSpan(this.openSpan.type, this.openSpan.start, now)
      this.openSpan = null
    }
  }

  // ==========================================================================
  // ANNOTATIONS — the user's interpretation of an absence (spec §7).
  // ==========================================================================
  // The annotation is a NEW FACT, not a correction: the presence_span stays exactly as
  // recorded ("no input 10:00–10:23" is true forever). We store the user's label beside
  // it and dashboards JOIN it at query time — the same shape as span+rule.

  /**
   * Long, unannotated, absence spans that are candidates for the return prompt. Absence
   * (idle/locked/suspended/unknown) only — `active` is never prompted. Rows already
   * annotated are excluded. Ordered most-recent-first so the UI can prompt for the block
   * the user just returned from. `minAwayMs` filters out short absences not worth asking
   * about (default 5 min). `since`/`until` bound the search window (epoch ms).
   *
   * NOTE: heartbeat flushing can split one logical absence into several consecutive rows
   * of the same type; this returns them individually. The prompt UI coalesces adjacent
   * same-type rows for display, and annotateSpan can be applied per-row.
   *
   * @returns {Promise<Array<{ id, type, start, end, durationMs }>>}
   */
  async getUnannotatedAway(sinceMs, untilMs, minAwayMs = 5 * 60 * 1000) {
    const rows = await this.db.all(
      `SELECT ps.id, ps.type, ps.start, ps.end
       FROM presence_span ps
       LEFT JOIN span_annotation sa ON sa.presence_span_id = ps.id
       WHERE ps.type != 'active'
         AND sa.id IS NULL
         AND ps.start >= ? AND ps.start < ?
       ORDER BY ps.start DESC`,
      [toIso(sinceMs), toIso(untilMs)]
    )
    return (rows || [])
      .map((r) => ({
        id: r.id,
        type: r.type,
        start: r.start,
        end: r.end,
        durationMs: msBetween(r.start, r.end)
      }))
      .filter((r) => r.durationMs >= minAwayMs)
  }

  /**
   * Record the user's interpretation of an absence span. Idempotent per span: a second
   * answer REPLACES the first (the user corrected their own label), never duplicates.
   * The presence_span itself is never touched.
   * @param {number} presenceSpanId
   * @param {string} userLabel  e.g. 'break' | 'working' | 'meeting' | free text
   * @param {number} answeredAt epoch ms
   * @returns {Promise<{ id: number|null }>}
   */
  async annotateSpan(presenceSpanId, userLabel, answeredAt) {
    if (!presenceSpanId || !userLabel) return { id: null }
    const answeredIso = toIso(answeredAt)
    const existing = await this.db.all(
      `SELECT id FROM span_annotation WHERE presence_span_id = ?`,
      [presenceSpanId]
    )
    if (existing && existing[0]) {
      await this.db.run(
        `UPDATE span_annotation SET user_label = ?, answered_at = ? WHERE id = ?`,
        [userLabel, answeredIso, existing[0].id]
      )
      return { id: existing[0].id }
    }
    const res = await this.db.run(
      `INSERT INTO span_annotation (presence_span_id, user_label, answered_at) VALUES (?, ?, ?)`,
      [presenceSpanId, userLabel, answeredIso]
    )
    return { id: res.lastID }
  }

  /**
   * Resolved presence spans in a range — each absence span annotated with its user label
   * (null if unanswered). This is the read seam dashboards consume: a `locked` span the
   * user labelled 'working' still IS a locked span (the fact is unchanged), but the label
   * lets the UI credit it. Same join-at-query-time model as category rules.
   * @returns {Promise<Array<{ id, type, start, end, durationMs, userLabel }>>}
   */
  async getResolvedPresence(sinceMs, untilMs) {
    const rows = await this.db.all(
      `SELECT ps.id, ps.type, ps.start, ps.end, sa.user_label
       FROM presence_span ps
       LEFT JOIN span_annotation sa ON sa.presence_span_id = ps.id
       WHERE ps.start >= ? AND ps.start < ?
       ORDER BY ps.start ASC`,
      [toIso(sinceMs), toIso(untilMs)]
    )
    return (rows || []).map((r) => ({
      id: r.id,
      type: r.type,
      start: r.start,
      end: r.end,
      durationMs: msBetween(r.start, r.end),
      userLabel: r.user_label || null
    }))
  }
}

// A presence type that represents absence (everything except 'active').
function isAbsence(type) {
  return type === 'idle' || type === 'locked' || type === 'suspended' || type === 'unknown'
}

// --- helpers (shared conventions with spanService.js) ---

// Accept epoch-ms number or ISO string; store as ISO for stable text comparison.
function toIso(v) {
  if (typeof v === 'number') return new Date(v).toISOString()
  return String(v)
}

function msBetween(startIso, endIso) {
  const s = new Date(startIso).getTime()
  const e = new Date(endIso).getTime()
  return Number.isFinite(s) && Number.isFinite(e) ? e - s : 0
}

module.exports = { PresenceService }
