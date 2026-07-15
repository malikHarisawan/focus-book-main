/**
 * FocusBalanceDonut — reference "Focus balance" card.
 *
 * An SVG donut over an arbitrary set of segments (the dashboard feeds it the
 * five work-modes: Deep work / Creative / Collaboration / Break / Distraction),
 * with a legend listing each segment and its time. Center shows a headline share.
 *
 * Data in (all numeric, same unit the rest of the dashboard uses):
 *   segments: [{ name, value, color, timeStr }]  — color is a CSS color string
 *   centerBig, centerSub                         — text for the donut center
 */
import { useState } from 'react'

const R = 48
const CIRC = 2 * Math.PI * R // ~301.59

export default function FocusBalanceDonut({ segments = [], centerBig, centerSub, subtitle }) {
  const [hover, setHover] = useState(null)
  const total = segments.reduce((s, seg) => s + seg.value, 0)

  // Build stroke-dasharray/offset for each arc.
  let acc = 0
  const arcs = segments.map((seg, i) => {
    const frac = total > 0 ? seg.value / total : 0
    const len = frac * CIRC
    const gap = len > 4 ? 1.5 : 0
    const arc = {
      ...seg,
      pct: Math.round(frac * 100),
      dasharray: `${Math.max(0, len - gap)} ${CIRC - Math.max(0, len - gap)}`,
      offset: -acc,
      opacity: hover == null || hover === i ? 1 : 0.26
    }
    acc += len
    return arc
  })

  const big = hover != null && arcs[hover] ? `${arcs[hover].pct}%` : centerBig
  const small = hover != null && arcs[hover] ? arcs[hover].name : centerSub

  return (
    <div className="rounded-[18px] border border-fb-border bg-fb-surface p-5 shadow-[var(--fb-shadow)] flex flex-col">
      <div className="font-display text-base font-semibold text-fb-text">Focus balance</div>
      {subtitle && <div className="text-[13px] text-fb-muted mt-1">{subtitle}</div>}

      <div className="relative w-[170px] h-[170px] mx-auto mt-4 mb-1">
        <svg width="170" height="170" viewBox="0 0 120 120" className="-rotate-90">
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--fb-track)" strokeWidth="15" />
          {arcs.map((a, i) => (
            <circle
              key={i}
              cx="60"
              cy="60"
              r={R}
              fill="none"
              strokeWidth="15"
              stroke={a.color}
              strokeDasharray={a.dasharray}
              strokeDashoffset={a.offset}
              opacity={a.opacity}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer', transition: 'opacity .25s' }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="font-display text-[34px] leading-none font-semibold tracking-tight text-fb-text">
            {big}
          </div>
          <div className="text-[12.5px] text-fb-muted mt-1">{small}</div>
        </div>
      </div>

      <div className="flex flex-col gap-0.5 mt-2">
        {arcs.map((a, i) => (
          <div
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors hover:bg-fb-surface2"
            style={{ opacity: a.opacity }}
          >
            <span className="h-2.5 w-2.5 rounded-[3px] flex-none" style={{ background: a.color }} />
            <span className="text-[13px] font-medium flex-1 text-fb-text">{a.name}</span>
            <span className="font-display text-[13px] font-semibold text-fb-text">{a.timeStr}</span>
          </div>
        ))}
        {arcs.length === 0 && (
          <div className="text-[13px] text-fb-muted text-center py-6">No activity yet</div>
        )}
      </div>
    </div>
  )
}
