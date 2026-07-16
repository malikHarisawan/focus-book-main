/**
 * DayTimeline — reference "Day timeline" view.
 *
 * A single horizontal track of the day's activity. Each block is a contiguous
 * run of usage, colored by productivity, positioned at its REAL clock time and
 * built from the per-app `timestamps` the tracker records ({ start, duration }).
 * Hovering a block shows the actual first-use → last-use span and the true
 * total active time — the same honest range/duration the reference shows.
 *
 * Older records without detailed timestamps fall back to their hour bucket
 * (positioned at the hour, flagged so the tooltip reads "~" for the range).
 *
 * Props:
 *   rawData: the full usage object (jsonData) — date → hour → app → { time, timestamps, ... }
 *   date: 'YYYY-MM-DD'
 */
import { useMemo, useState, useEffect } from 'react'
import { getMode } from '../../utils/dataProcessor'

// The five work-modes in canonical order, each mapped to its design-system color
// token (theme-aware) so the timeline matches the Focus-balance donut.
const MODE_ORDER = ['Deep work', 'Creative', 'Collaboration', 'Break', 'Distraction']
const MODE_TOKEN = {
  'Deep work': 'var(--c-deep)',
  Creative: 'var(--c-create)',
  Collaboration: 'var(--c-comms)',
  Break: 'var(--c-break)',
  Distraction: 'var(--c-distract)'
}
const modeColor = (mode) => MODE_TOKEN[mode] || 'var(--fb-muted)'

// Resolve an app record to its work-mode, mirroring dataProcessor's modeForApp
// (an explicit app.mode wins, else the category's default mode).
const modeForApp = (app) => (app && app.mode ? app.mode : getMode(app ? app.category : undefined))

// Minutes-since-midnight → "2:39 PM".
const clock = (mins) => {
  const total = Math.round(mins)
  let hh = Math.floor(total / 60) % 24
  const mm = ((total % 60) + 60) % 60
  const ap = hh >= 12 ? 'PM' : 'AM'
  let h = hh % 12
  if (h === 0) h = 12
  return `${h}:${String(mm).padStart(2, '0')} ${ap}`
}

const fmtDur = (mins) => {
  const m = Math.max(1, Math.round(mins)) // never show 0m for a real segment
  const h = Math.floor(m / 60)
  const rem = m % 60
  if (h && rem) return `${h}h ${rem}m`
  if (h) return `${h}h`
  return `${rem}m`
}

// Parse a stored timestamp's `start` (a Date string) into minutes-since-midnight
// on its own day. Returns null if unparseable.
const startMinutes = (startStr) => {
  const d = new Date(startStr)
  if (isNaN(d)) return null
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
}

// Build real-time activity segments from the raw usage object for one date.
// Exported for reconciliation testing (asserting per-app timeline totals equal the
// daily aggregate the Activity log / donut use).
export function buildSegments(rawData, date) {
  const day = rawData?.[date]
  if (!day) return { segments: [], startHour: 8, endHour: 19 }

  const segments = [] // { startMin, endMin, mode, category, label, ms, approx }

  for (const [key, hourData] of Object.entries(day)) {
    if (key === 'apps') continue
    const hour = parseInt(key.split(':')[0], 10)
    if (isNaN(hour)) continue

    for (const [name, d] of Object.entries(hourData)) {
      const label = d.domain || d.description || name
      // `appId` identifies the app for merging: two segments only merge into one
      // block when they are the SAME app, so a block's time is never another app's.
      const appId = label.toLowerCase()
      const mode = modeForApp(d)
      const stamps = Array.isArray(d.timestamps) ? d.timestamps : []

      // Prefer real timestamps: each is an actual usage moment.
      const usable = stamps
        .map((ts) => ({ start: startMinutes(ts.start), durMin: (ts.duration || 0) / 60000 }))
        .filter((ts) => ts.start != null && ts.durMin > 0)

      if (usable.length > 0) {
        for (const ts of usable) {
          segments.push({
            startMin: ts.start,
            endMin: ts.start + ts.durMin,
            mode,
            category: d.category,
            label,
            appId,
            ms: ts.durMin * 60000,
            approx: false
          })
        }
      } else if (d.time > 0) {
        // Fallback: no detailed timestamps — place a block at the hour bucket,
        // sized by its real duration, flagged approximate.
        const durMin = d.time / 60000
        segments.push({
          startMin: hour * 60,
          endMin: hour * 60 + Math.min(60, durMin),
          mode,
          category: d.category,
          label,
          appId,
          ms: d.time,
          approx: true
        })
      }
    }
  }

  if (segments.length === 0) {
    return { segments: [], firstMin: 8 * 60, lastMin: 19 * 60 }
  }

  // Order chronologically.
  segments.sort((a, b) => a.startMin - b.startMin)

  // Real data extent — the axis is FITTED to this (padded) rather than a fixed
  // 8a–7p window, so a 50-minute day doesn't get crushed into 6% of the canvas.
  const firstMin = segments[0].startMin
  const lastMin = Math.max(...segments.map((s) => s.endMin))

  return { segments, firstMin, lastMin }
}

// Given the raw data extent (minutes-since-midnight), compute the fitted axis
// window: pad each side by ~8% of the span (min 15 min), clamp to [0, 1440], and
// snap outward to whole hours so the ticks land on clean labels. A degenerate or
// tiny extent still yields at least a ~1-hour window so the track isn't a dot.
function fitAxis(firstMin, lastMin) {
  const rawSpan = Math.max(1, lastMin - firstMin)
  const pad = Math.max(15, rawSpan * 0.08)
  let start = Math.max(0, firstMin - pad)
  let end = Math.min(1440, lastMin + pad)
  // Snap to whole hours outward.
  start = Math.floor(start / 60) * 60
  end = Math.ceil(end / 60) * 60
  // Guarantee a minimum visible window.
  if (end - start < 60) {
    const mid = (start + end) / 2
    start = Math.max(0, Math.floor((mid - 30) / 60) * 60)
    end = Math.min(1440, start + 60)
  }
  return { startMin: start, endMin: end }
}

// The merge threshold: a cross-mode interruption at or above this many minutes
// survives as its OWN block (e.g. a 6-minute facebook.com detour stays a visible
// bar — the app must never swallow that into a "Deep work" block and lie). Below
// it, a sandwiched interruption is absorbed into the surrounding block but rendered
// as a MARKER (a tick), so it is surfaced as texture, not deleted and not a sliver.
//
// This is a DAY-scale threshold. Semantic zoom (hour/finer views) lowers it so a
// 30-second span that is 8px wide at hour scale earns its own bar. Exported and
// parameterized so the merge is a pure VIEW over the span log, recomputed per zoom —
// never written back to storage.
export const DAY_MERGE_THRESHOLD_MIN = 1.5 // 90 seconds

// Mode-aware, threshold-aware merge. Produces the timeline's BLOCKS from raw spans:
//
//   - Adjacent spans of the SAME mode  -> merge into one block (a coding run reads
//     as one bar, not 40 slivers). The block's start→end still equals real elapsed
//     time, so widths remain honest and sum to the timeline.
//   - A cross-mode interruption >= threshold -> its own block (stays visible).
//   - A cross-mode interruption < threshold, sandwiched inside a same-mode run ->
//     absorbed into the block's span but recorded as a MARKER (tick) at its position,
//     with its real label/mode/duration for the tooltip. Nothing is hidden.
//
// Honesty guarantees (asserted in tests):
//   - Every span's time is accounted for: it is either its own block, part of a
//     merged block, or an absorbed marker — never dropped.
//   - A block's width == its real elapsed wall-clock span (no min-width inflation),
//     so blocks tile the timeline without overlap or padding lies.
//
// Semantic-zoom threshold: the merge threshold scales with the VISIBLE window so a
// span that is too small to see at day scale earns its own bar once you zoom in.
// Rule of thumb from the spec — a span deserves its own bar when it is at least a
// few pixels wide. We approximate "a few pixels" as ~0.4% of the visible span, so:
//   day view  (~2h window)   -> ~0.5 min floor, capped at the 90s day threshold
//   hour view (~10m window)  -> ~2.4 s floor  -> a 30s span becomes its own bar
// Clamped so it never exceeds the day threshold and never goes fully to zero.
export function zoomThresholdMin(windowSpanMin) {
  const scaled = Math.max(0.05, windowSpanMin * 0.004) // ~0.24s per visible minute
  return Math.min(DAY_MERGE_THRESHOLD_MIN, scaled)
}

// `thresholdMin` is injectable so semantic zoom can lower it.
//
// Day-view blocks are MODE blocks: a block is a contiguous run of the same work-mode,
// LABELLED BY THE MODE (e.g. "Deep work"), colored by the mode. Its width is the real
// elapsed span. Each block also carries `segs` — the raw app-level segments that
// compose it — so clicking a block can expand it IN PLACE into per-app segments
// (see expandBlockToApps) without any extra data round-trip. Brief cross-mode
// interruptions are still surfaced as `markers` (ticks) on the mode block.
export function mergeBlocks(segments, thresholdMin = DAY_MERGE_THRESHOLD_MIN) {
  if (!segments.length) return []

  const blocks = []
  let cur = null // the block currently being built

  const startBlock = (seg) => ({
    startMin: seg.startMin,
    endMin: seg.endMin,
    mode: seg.mode,
    category: seg.category,
    label: seg.mode, // MODE label — the day view answers "how did I work?"
    appId: seg.appId,
    totalMs: seg.ms, // active time of this MODE run
    approx: seg.approx,
    markers: [], // absorbed sub-threshold interruptions (rendered as ticks)
    segs: [seg] // raw app-level segments composing this block (for in-place expand)
  })

  for (const seg of segments) {
    const durMin = seg.ms / 60000
    const contiguous = cur && seg.startMin <= cur.endMin + 2 // 2-min tick tolerance

    if (!cur) {
      cur = startBlock(seg)
      continue
    }

    if (contiguous && seg.mode === cur.mode) {
      // Same-mode run: extend the block and sum its time. Keep the raw segment so the
      // block can later expand into its apps.
      cur.endMin = Math.max(cur.endMin, seg.endMin)
      cur.totalMs += seg.ms
      cur.approx = cur.approx || seg.approx
      cur.segs.push(seg)
    } else if (contiguous && seg.mode !== cur.mode && durMin < thresholdMin) {
      // Short cross-mode interruption sandwiched in a run: absorb as a MARKER. Its
      // time is preserved on the block's span and it stays in `segs` so expanding
      // the block still shows it as its own app segment (never deleted).
      cur.endMin = Math.max(cur.endMin, seg.endMin)
      cur.markers.push({ atMin: seg.startMin, mode: seg.mode, label: seg.label, ms: seg.ms })
      cur.segs.push(seg)
    } else {
      // Either a gap, or a cross-mode interruption at/above threshold: it earns its
      // own block. Close the current one and start fresh.
      blocks.push(cur)
      cur = startBlock(seg)
    }
  }
  if (cur) blocks.push(cur)

  blocks.sort((a, b) => a.startMin - b.startMin)
  return blocks
}

// Expand a MODE block into per-APP segments for in-place drill-in. Merges the block's
// raw `segs` by app (adjacent same-app spans coalesce), so a "Deep work" block becomes
// [VS Code | Electron | terminal] at their real positions within the SAME window.
// Widths stay honest (real elapsed time); nothing is dropped — even a brief interruption
// app inside the run gets its own segment here. Returns [{ startMin, endMin, mode,
// category, label, appId, totalMs, approx }] sorted by time.
export function expandBlockToApps(block) {
  const segs = (block?.segs || []).slice().sort((a, b) => a.startMin - b.startMin)
  const out = []
  let cur = null
  for (const seg of segs) {
    const contiguous = cur && seg.appId === cur.appId && seg.startMin <= cur.endMin + 2
    if (contiguous) {
      cur.endMin = Math.max(cur.endMin, seg.endMin)
      cur.totalMs += seg.ms
      cur.approx = cur.approx || seg.approx
    } else {
      cur = {
        startMin: seg.startMin,
        endMin: seg.endMin,
        mode: seg.mode,
        category: seg.category,
        label: seg.label, // APP label in the expanded view
        appId: seg.appId,
        totalMs: seg.ms,
        approx: seg.approx
      }
      out.push(cur)
    }
  }
  out.sort((a, b) => a.startMin - b.startMin)
  return out
}

// Switch-density series: for each 1-minute bin across [startMin, endMin), count the
// number of app switches (a segment whose appId differs from the previous segment).
// Returns [{ min, switches }] used to paint the fragmentation strip. This is the
// "context switches" metric given its own visual channel instead of cluttering the
// blocks — high intensity = fragmented attention, pale = flow.
export function switchDensity(segments, startMin, endMin) {
  const bins = []
  const nBins = Math.max(1, Math.round(endMin - startMin))
  for (let i = 0; i < nBins; i++) bins.push(0)

  let prevApp = null
  for (const seg of segments) {
    if (prevApp !== null && seg.appId !== prevApp) {
      const idx = Math.floor(seg.startMin - startMin)
      if (idx >= 0 && idx < nBins) bins[idx] += 1
    }
    prevApp = seg.appId
  }
  return bins.map((switches, i) => ({ min: startMin + i, switches }))
}

export default function DayTimeline({ rawData, date }) {
  const [hover, setHover] = useState(null)
  // In-place drill-in: the index of the MODE block currently expanded into its apps,
  // or null for the mode (day) view. Same time window either way — expanding only
  // changes ONE block from a mode bar into its per-app segments.
  const [expandedIdx, setExpandedIdx] = useState(null)

  // All spans for the day (immutable source; expansion only RE-DERIVES a view over
  // them, never the underlying spans).
  const { segments, dayFirst, dayLast } = useMemo(() => {
    const { segments, firstMin, lastMin } = buildSegments(rawData, date)
    return { segments, dayFirst: firstMin, dayLast: lastMin }
  }, [rawData, date])

  // Reset expansion whenever the day's data changes so we never show a stale view.
  useEffect(() => {
    setExpandedIdx(null)
    setHover(null)
  }, [date, dayFirst, dayLast])

  // The axis always fits the full day — expanding a block keeps the same time window
  // (the block splits in place into apps; the timeline metaphor stays intact).
  const axis = useMemo(() => fitAxis(dayFirst, dayLast), [dayFirst, dayLast])
  const START = axis.startMin
  const END = axis.endMin
  const SPAN = Math.max(1, END - START)
  const pctOf = (min) => ((min - START) / SPAN) * 100

  // Day view = MODE blocks. Each carries its raw app segments for in-place expansion.
  const modeBlocks = useMemo(() => mergeBlocks(segments), [segments])

  // The expanded block's per-app segments (empty unless a block is expanded).
  const expandedApps = useMemo(() => {
    if (expandedIdx == null || !modeBlocks[expandedIdx]) return []
    return expandBlockToApps(modeBlocks[expandedIdx])
  }, [expandedIdx, modeBlocks])

  const density = useMemo(() => switchDensity(segments, START, END), [segments, START, END])
  const maxSwitches = density.reduce((m, d) => Math.max(m, d.switches), 0)

  // Reset expansion if the block list shrinks below the expanded index.
  useEffect(() => {
    if (expandedIdx != null && expandedIdx >= modeBlocks.length) setExpandedIdx(null)
  }, [expandedIdx, modeBlocks.length])

  const tlBlocks = modeBlocks.map((b, i) => {
    const durMin = b.totalMs / 60000
    const prefix = b.approx ? '~' : ''
    const left = pctOf(b.startMin)
    const width = pctOf(b.endMin) - left // honest: width == real elapsed time, no min-width
    return {
      i,
      left,
      width,
      startMin: b.startMin,
      endMin: b.endMin,
      color: modeColor(b.mode),
      label: b.label,
      cat: b.mode,
      range: `${prefix}${clock(b.startMin)} – ${clock(b.endMin)}`,
      dur: fmtDur(durMin),
      // Interruption markers (ticks), positioned within the block.
      markers: (b.markers || []).map((mk) => ({
        leftPct: pctOf(mk.atMin),
        color: modeColor(mk.mode),
        mode: mk.mode,
        label: mk.label,
        dur: fmtDur(mk.ms / 60000)
      })),
      markerCount: (b.markers || []).length,
      opacity: hover == null || hover === i ? 1 : 0.38
    }
  })

  // Positioned per-app segments for the expanded block (empty when nothing expanded).
  // Hover keys are strung `app:<n>` so they don't collide with mode-block indices.
  const expandedTl = expandedApps.map((a, i) => {
    const left = pctOf(a.startMin)
    const width = pctOf(a.endMin) - left
    return {
      key: `app:${i}`,
      left,
      width,
      startMin: a.startMin,
      endMin: a.endMin,
      color: modeColor(a.mode),
      label: a.label,
      cat: a.mode,
      range: `${a.approx ? '~' : ''}${clock(a.startMin)} – ${clock(a.endMin)}`,
      dur: fmtDur(a.totalMs / 60000)
    }
  })
  const expandedBlock = expandedIdx != null ? tlBlocks[expandedIdx] : null

  // Hour ticks across the fitted window (every hour; if the window is very wide,
  // this stays readable because the axis is fitted, not the whole day).
  const startHour = Math.floor(START / 60)
  const endHour = Math.ceil(END / 60)
  const ticks = []
  for (let h = startHour; h <= endHour; h++) {
    ticks.push({
      label: (h % 12 === 0 ? 12 : h % 12) + (h >= 12 ? 'p' : 'a'),
      left: pctOf(h * 60)
    })
  }

  const hoverInfo =
    typeof hover === 'string'
      ? expandedTl.find((e) => e.key === hover) || null
      : hover != null && tlBlocks[hover]
        ? tlBlocks[hover]
        : null

  // Click a MODE block -> expand it IN PLACE into its apps. Clicking the same block
  // again (or the collapse control) returns to the mode view. Only blocks with real
  // span are worth expanding.
  const toggleExpand = (i) => {
    const b = modeBlocks[i]
    if (!b || b.endMin - b.startMin < 0.5) return
    setExpandedIdx((cur) => (cur === i ? null : i))
    setHover(null)
  }

  return (
    <div>
      {/* Legend + collapse control. In the mode (day) view, clicking a block expands
          it into its apps; the control collapses back to modes. */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex gap-4 flex-wrap">
          {MODE_ORDER.map((m) => (
            <Legend key={m} color={MODE_TOKEN[m]} label={m} />
          ))}
        </div>
        {expandedIdx != null && expandedBlock && (
          <button
            onClick={() => {
              setExpandedIdx(null)
              setHover(null)
            }}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-fb-muted hover:text-fb-text hover:bg-fb-surface2 transition-colors flex-none"
            title="Collapse back to work modes"
          >
            <span aria-hidden>←</span>
            Back to modes
            <span className="text-fb-muted/70">· {expandedBlock.cat}</span>
          </button>
        )}
      </div>

      <div className="relative">
        {/* Hover tooltip */}
        {hoverInfo && (
          <div
            className="absolute z-20 pointer-events-none"
            style={{ bottom: 'calc(100% + 12px)', left: `${hoverInfo.left + hoverInfo.width / 2}%`, transform: 'translateX(-50%)' }}
          >
            <div className="rounded-xl px-3.5 py-2.5 min-w-[160px] text-white shadow-lg" style={{ background: 'var(--fb-tip)' }}>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-white/65">
                <span className="w-2 h-2 rounded-[3px]" style={{ background: hoverInfo.color }} />
                {hoverInfo.cat}
              </div>
              <div className="text-sm font-semibold mt-1.5 truncate max-w-[220px]">{hoverInfo.label}</div>
              <div className="text-[12.5px] text-white/70 mt-0.5">{hoverInfo.range} · {hoverInfo.dur}</div>
              {hoverInfo.markerCount > 0 && (
                <div className="text-[12px] text-white/55 mt-1.5 pt-1.5 border-t border-white/15">
                  {hoverInfo.markerCount} brief interruption{hoverInfo.markerCount > 1 ? 's' : ''}
                </div>
              )}
              {expandedIdx == null && hoverInfo.endMin - hoverInfo.startMin >= 1 && (
                <div className="text-[11px] text-white/45 mt-1.5">Click to see apps</div>
              )}
            </div>
          </div>
        )}

        {/* Track. Day view = MODE blocks. When a block is expanded, it is replaced
            in place by its per-APP segments (same time window); the other mode blocks
            dim so the expansion reads as a focus. */}
        <div className="relative h-[60px] rounded-xl overflow-hidden" style={{ background: 'var(--fb-track)' }}>
          {tlBlocks.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-[13px] text-fb-muted">
              No activity tracked for this day
            </div>
          )}

          {tlBlocks.map((b) => {
            if (b.i === expandedIdx) return null // replaced by its app segments below
            const dimmed = expandedIdx != null // other blocks recede while one is open
            const op = dimmed ? 0.28 : b.opacity
            return (
              <div
                key={b.i}
                onMouseEnter={() => setHover(b.i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => toggleExpand(b.i)}
                className="absolute top-[5px] bottom-[5px] rounded-md cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md overflow-hidden"
                style={{ left: `${b.left}%`, width: `calc(${b.width}% - 2px)`, background: b.color, opacity: op }}
              >
                {/* Interruption ticks — brief cross-mode blips surfaced as texture. */}
                {b.markers.map((mk, mi) => {
                  const within = b.width > 0 ? ((mk.leftPct - b.left) / b.width) * 100 : 0
                  return (
                    <span
                      key={mi}
                      className="absolute top-0 bottom-0 w-[2px]"
                      style={{
                        left: `${Math.max(0, Math.min(100, within))}%`,
                        background: mk.color,
                        boxShadow: '0 0 0 0.5px rgba(0,0,0,0.25)'
                      }}
                    />
                  )
                })}
              </div>
            )
          })}

          {/* Expanded block -> per-app segments, in the block's own time window. */}
          {expandedTl.map((e) => (
            <div
              key={e.key}
              onMouseEnter={() => setHover(e.key)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setExpandedIdx(null)}
              className="absolute top-[5px] bottom-[5px] rounded-md cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md overflow-hidden ring-1 ring-white/20"
              style={{ left: `${e.left}%`, width: `calc(${e.width}% - 1.5px)`, background: e.color }}
              title={`${e.label} · ${e.dur}`}
            />
          ))}
        </div>

        {/* Switch-density strip — fragmentation as its own channel. Each 1-min bin is
            shaded by how many app switches started in it: dark = fragmented, pale =
            flow. This is the context-switch metric in the right channel, not clutter. */}
        {maxSwitches > 0 && (
          <div className="relative h-[10px] mt-1.5 rounded-md overflow-hidden" style={{ background: 'var(--fb-track)' }}>
            {density.map((d, i) =>
              d.switches > 0 ? (
                <span
                  key={i}
                  className="absolute top-0 bottom-0"
                  style={{
                    left: `${pctOf(d.min)}%`,
                    width: `${(1 / SPAN) * 100}%`,
                    background: 'var(--c-distract)',
                    opacity: 0.18 + 0.82 * (d.switches / maxSwitches)
                  }}
                  title={`${d.switches} switch${d.switches > 1 ? 'es' : ''}`}
                />
              ) : null
            )}
          </div>
        )}

        {/* Hour ticks */}
        <div className="relative h-[18px] mt-2">
          {ticks.map((t, i) => (
            <span
              key={i}
              className="absolute text-[11px] font-medium text-fb-muted"
              style={{ left: `${t.left}%`, transform: 'translateX(-50%)' }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function Legend({ color, label }) {
  return (
    <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-fb-muted">
      <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: color }} />
      {label}
    </div>
  )
}
