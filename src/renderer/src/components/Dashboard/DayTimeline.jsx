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

// Merge raw spans into per-APP blocks — the timeline's only view. Adjacent spans of the
// SAME app coalesce into one bar (e.g. facebook.com's ~19 short fragments become one
// 11-minute block), so a fragmented app reads as a single honest bar instead of a swarm
// of slivers. Each block is one app at its real clock position, sized by its real elapsed
// span, colored by its work-mode. Nothing is dropped: every span lands in exactly one
// block. Returns [{ startMin, endMin, mode, category, label, appId, totalMs, approx }]
// sorted by time.
export function mergeAppBlocks(segments) {
  const segs = (segments || []).slice().sort((a, b) => a.startMin - b.startMin)
  const out = []
  let cur = null
  for (const seg of segs) {
    // Same app AND close enough in time (2-min tick tolerance) -> extend the block.
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
        label: seg.label, // APP label (domain / friendly name)
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

  // All spans for the day (immutable source).
  const { segments, dayFirst, dayLast } = useMemo(() => {
    const { segments, firstMin, lastMin } = buildSegments(rawData, date)
    return { segments, dayFirst: firstMin, dayLast: lastMin }
  }, [rawData, date])

  // Clear any stale hover when the day's data changes.
  useEffect(() => {
    setHover(null)
  }, [date, dayFirst, dayLast])

  // The axis fits the day's real extent (padded), so a short day isn't crushed.
  const axis = useMemo(() => fitAxis(dayFirst, dayLast), [dayFirst, dayLast])
  const START = axis.startMin
  const END = axis.endMin
  const SPAN = Math.max(1, END - START)
  const pctOf = (min) => ((min - START) / SPAN) * 100

  // The only view: per-APP blocks. Adjacent same-app spans are coalesced, each block is
  // one app at its real position/duration, colored by its work-mode.
  const appBlocks = useMemo(() => mergeAppBlocks(segments), [segments])

  const tlBlocks = appBlocks.map((b, i) => {
    const left = pctOf(b.startMin)
    const width = pctOf(b.endMin) - left // honest: width == real elapsed time, no min-width
    return {
      i,
      left,
      width,
      startMin: b.startMin,
      endMin: b.endMin,
      color: modeColor(b.mode),
      label: b.label, // app name / domain
      cat: b.mode,
      range: `${b.approx ? '~' : ''}${clock(b.startMin)} – ${clock(b.endMin)}`,
      dur: fmtDur(b.totalMs / 60000),
      opacity: hover == null || hover === i ? 1 : 0.38
    }
  })

  // Hour ticks across the fitted window (every hour; the axis is fitted, not the whole
  // day, so this stays readable).
  const startHour = Math.floor(START / 60)
  const endHour = Math.ceil(END / 60)
  const ticks = []
  for (let h = startHour; h <= endHour; h++) {
    ticks.push({
      label: (h % 12 === 0 ? 12 : h % 12) + (h >= 12 ? 'p' : 'a'),
      left: pctOf(h * 60)
    })
  }

  const hoverInfo = hover != null && tlBlocks[hover] ? tlBlocks[hover] : null

  return (
    <div>
      {/* Legend — the five work-modes, matching each block's color. */}
      <div className="flex gap-4 flex-wrap mb-4">
        {MODE_ORDER.map((m) => (
          <Legend key={m} color={MODE_TOKEN[m]} label={m} />
        ))}
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
            </div>
          </div>
        )}

        {/* Track — one bar per app at its real clock position. */}
        <div className="relative h-[60px] rounded-xl overflow-hidden" style={{ background: 'var(--fb-track)' }}>
          {tlBlocks.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-[13px] text-fb-muted">
              No activity tracked for this day
            </div>
          )}

          {tlBlocks.map((b) => (
            <div
              key={b.i}
              onMouseEnter={() => setHover(b.i)}
              onMouseLeave={() => setHover(null)}
              className="absolute top-[5px] bottom-[5px] rounded-md transition-all hover:-translate-y-0.5 hover:shadow-md overflow-hidden"
              style={{ left: `${b.left}%`, width: `calc(${b.width}% - 2px)`, background: b.color, opacity: b.opacity }}
              title={`${b.label} · ${b.dur}`}
            />
          ))}
        </div>

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
