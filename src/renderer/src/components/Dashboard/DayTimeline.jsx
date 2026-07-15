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
import { useMemo, useState } from 'react'
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
function buildSegments(rawData, date) {
  const day = rawData?.[date]
  if (!day) return { segments: [], startHour: 8, endHour: 19 }

  const segments = [] // { startMin, endMin, mode, category, label, ms, approx }

  for (const [key, hourData] of Object.entries(day)) {
    if (key === 'apps') continue
    const hour = parseInt(key.split(':')[0], 10)
    if (isNaN(hour)) continue

    for (const [name, d] of Object.entries(hourData)) {
      const label = d.domain || d.description || name
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
          ms: d.time,
          approx: true
        })
      }
    }
  }

  if (segments.length === 0) return { segments: [], startHour: 8, endHour: 19 }

  // Order chronologically.
  segments.sort((a, b) => a.startMin - b.startMin)

  const firstMin = segments[0].startMin
  const lastMin = Math.max(...segments.map((s) => s.endMin))
  const startHour = Math.min(8, Math.floor(firstMin / 60))
  const endHour = Math.max(19, Math.ceil(lastMin / 60))

  return { segments, startHour, endHour }
}

// Merge adjacent/overlapping segments that share the same work-mode into one
// block, tracking the real span and total active time. Keeps the label of the
// longest-running app in the run.
function mergeBlocks(segments) {
  const blocks = []
  for (const seg of segments) {
    const last = blocks[blocks.length - 1]
    // Merge when the same mode and this segment starts before/at the running
    // block's end (with a small 2-minute tolerance for tick gaps).
    if (last && last.mode === seg.mode && seg.startMin <= last.endMin + 2) {
      last.endMin = Math.max(last.endMin, seg.endMin)
      last.totalMs += seg.ms
      last.approx = last.approx || seg.approx
      if (seg.ms > last.topMs) {
        last.label = seg.label
        last.topMs = seg.ms
        last.category = seg.category
      }
    } else {
      blocks.push({
        startMin: seg.startMin,
        endMin: seg.endMin,
        mode: seg.mode,
        category: seg.category,
        label: seg.label,
        totalMs: seg.ms,
        topMs: seg.ms,
        approx: seg.approx
      })
    }
  }
  return blocks
}

export default function DayTimeline({ rawData, date }) {
  const [hover, setHover] = useState(null)
  const { blocks, startHour, endHour } = useMemo(() => {
    const { segments, startHour, endHour } = buildSegments(rawData, date)
    return { blocks: mergeBlocks(segments), startHour, endHour }
  }, [rawData, date])

  const START = startHour * 60
  const END = endHour * 60
  const SPAN = Math.max(1, END - START)

  const tlBlocks = blocks.map((b, i) => {
    const durMin = b.totalMs / 60000
    const prefix = b.approx ? '~' : ''
    return {
      i,
      left: ((b.startMin - START) / SPAN) * 100,
      width: Math.max(0.6, ((b.endMin - b.startMin) / SPAN) * 100),
      color: modeColor(b.mode),
      label: b.label,
      cat: b.mode,
      range: `${prefix}${clock(b.startMin)} – ${clock(b.endMin)}`,
      dur: fmtDur(durMin),
      opacity: hover == null || hover === i ? 1 : 0.38
    }
  })

  const ticks = []
  for (let h = startHour; h <= endHour; h++) {
    ticks.push({
      label: (h % 12 === 0 ? 12 : h % 12) + (h >= 12 ? 'p' : 'a'),
      left: ((h * 60 - START) / SPAN) * 100
    })
  }

  const hoverInfo = hover != null && tlBlocks[hover] ? tlBlocks[hover] : null

  return (
    <div>
      {/* Legend — the five work-modes, colored to match the Focus-balance donut. */}
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

        {/* Track */}
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
              className="absolute top-[5px] bottom-[5px] rounded-md cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md"
              style={{ left: `${b.left}%`, width: `calc(${b.width}% - 2px)`, background: b.color, opacity: b.opacity }}
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
