/**
 * ActivityLog — reference "Activity log" card.
 *
 * Per-app rows: mono tile + name + productivity dot + usage bar + time.
 * All / Productive / Distracting filter tabs at the top.
 *
 * Props:
 *   apps: [{ name, timeStr, usagePercent (0..1), productivity, mono }]
 *   scope: string shown top-right (e.g. "Today")
 */
import { useState } from 'react'

// Map a productivity label to its category color token.
const prodColor = (p) =>
  p === 'Productive' ? 'var(--c-deep)' : p === 'Distracting' ? 'var(--c-distract)' : 'var(--c-comms)'

export default function ActivityLog({ apps = [], scope }) {
  const [filter, setFilter] = useState('all')

  const filtered = apps.filter((a) => {
    if (filter === 'productive') return a.productivity !== 'Distracting'
    if (filter === 'distracting') return a.productivity === 'Distracting'
    return true
  })

  const Tab = ({ id, label }) => {
    const active = filter === id
    return (
      <button
        onClick={() => setFilter(id)}
        className="flex-1 rounded-lg py-[7px] text-[12.5px] font-semibold transition-all"
        style={{
          background: active ? 'var(--fb-surface)' : 'transparent',
          color: active ? 'var(--fb-text)' : 'var(--fb-muted)',
          boxShadow: active ? '0 1px 3px rgba(20,20,29,.12)' : 'none'
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="rounded-[18px] border border-fb-border bg-fb-surface p-5 shadow-[var(--fb-shadow)] flex flex-col min-h-0">
      <div className="flex items-center justify-between">
        <div className="font-display text-base font-semibold text-fb-text">Activity log</div>
        {scope && <div className="text-xs font-medium text-fb-muted">{scope}</div>}
      </div>

      <div className="flex gap-1 bg-fb-surface2 border border-fb-border p-[3px] rounded-[10px] mt-3.5 mb-3">
        <Tab id="all" label="All" />
        <Tab id="productive" label="Productive" />
        <Tab id="distracting" label="Distracting" />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0 max-h-[290px]">
        {filtered.map((a, i) => (
          <div key={`${a.name}-${i}`} className="flex items-center gap-3 py-2.5">
            <div
              className="w-9 h-9 rounded-[10px] flex-none flex items-center justify-center text-white font-display font-semibold text-[13px]"
              style={{ background: prodColor(a.productivity) }}
            >
              {a.mono}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold truncate text-fb-text">{a.name}</span>
                <span
                  className="w-1.5 h-1.5 rounded-full flex-none"
                  style={{ background: prodColor(a.productivity) }}
                />
              </div>
              <div className="h-[5px] rounded-full bg-fb-track mt-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round((a.usagePercent || 0) * 100)}%`,
                    background: prodColor(a.productivity)
                  }}
                />
              </div>
            </div>
            <div className="font-display text-[13px] font-semibold flex-none text-fb-text">{a.timeStr}</div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-[13px] text-fb-muted text-center py-8">No apps to show</div>
        )}
      </div>
    </div>
  )
}
