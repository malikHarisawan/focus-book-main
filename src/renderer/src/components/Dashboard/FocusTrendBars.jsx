/**
 * FocusTrendBars — reference "Focus trend" card (last 7 days).
 *
 * Presentational: the parent supplies the 7-day series and a click handler.
 *
 * Props:
 *   days:  [{ key, label, valueStr, value (numeric for bar height), selected }]
 *   avgStr: string shown top-right ("daily avg")
 *   onSelectDay(key): called when a bar is clicked
 */
import { useState } from 'react'

export default function FocusTrendBars({ days = [], avgStr, onSelectDay }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(1, ...days.map((d) => d.value))

  return (
    <div className="rounded-[18px] border border-fb-border bg-fb-surface p-5 shadow-[var(--fb-shadow)] flex flex-col">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-display text-base font-semibold text-fb-text">Focus trend</div>
          <div className="text-[13px] text-fb-muted mt-1">Last 7 days · click a bar to open it</div>
        </div>
        <div className="text-right">
          <div className="font-display text-xl font-semibold whitespace-nowrap text-fb-text">{avgStr}</div>
          <div className="text-[11.5px] text-fb-muted">daily avg</div>
        </div>
      </div>

      <div className="flex-1 flex items-end gap-3 mt-6 min-h-[190px]">
        {days.map((d, i) => {
          const hPx = Math.max(6, Math.round((d.value / max) * 150))
          const active = d.selected
          const showVal = hover === i || active
          return (
            <div
              key={d.key}
              onClick={() => onSelectDay?.(d.key)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="flex-1 flex flex-col items-center justify-end h-full cursor-pointer gap-2"
            >
              <div
                className="font-display text-xs font-semibold h-4 transition-opacity"
                style={{
                  color: active ? 'var(--c-deep)' : 'var(--fb-muted)',
                  opacity: showVal ? 1 : 0
                }}
              >
                {d.valueStr}
              </div>
              <div
                className="w-full max-w-[40px] rounded-t-lg transition-transform hover:scale-y-[1.03] origin-bottom"
                style={{
                  height: `${hPx}px`,
                  background: active ? 'var(--c-deep)' : 'var(--fb-baridle)'
                }}
              />
              <div
                className="text-[12.5px] transition-colors"
                style={{
                  color: active ? 'var(--fb-text)' : 'var(--fb-muted)',
                  fontWeight: active ? 700 : 500
                }}
              >
                {d.label}
              </div>
            </div>
          )
        })}
        {days.length === 0 && (
          <div className="w-full text-center text-[13px] text-fb-muted self-center">No data</div>
        )}
      </div>
    </div>
  )
}
