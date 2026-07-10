/**
 * StatCard — reference-design stat tile.
 *
 * Two shapes:
 *  - default: label (with a small square swatch) + big Space-Grotesk number + subtext
 *  - ring:    same, but with a circular progress ring on the right (Focus Score)
 *
 * Colors come from the design tokens (--c-* / --fb-*) so the tile tracks the
 * active theme automatically.
 */
export default function StatCard({ title, value, sub, swatch, score }) {
  // swatch: a category token key ('deep' | 'comms' | 'distract' | 'muted') for the label dot
  const swatchColor = {
    deep: 'var(--c-deep)',
    create: 'var(--c-create)',
    comms: 'var(--c-comms)',
    break: 'var(--c-break)',
    distract: 'var(--c-distract)',
    muted: 'var(--fb-muted)'
  }[swatch || 'muted']

  // Score ring geometry
  const R = 26
  const C = 2 * Math.PI * R // ~163.36
  const pct = Math.max(0, Math.min(100, score ?? 0))
  const dash = (pct / 100) * C
  const ringColor = pct >= 75 ? 'var(--c-create)' : pct >= 55 ? 'var(--c-break)' : 'var(--c-distract)'

  return (
    <div className="rounded-[18px] border border-fb-border bg-fb-surface p-5 shadow-[var(--fb-shadow)] flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-fb-muted">
          {swatch && (
            <span
              className="h-2 w-2 rounded-[2px] flex-none"
              style={{ background: swatchColor }}
            />
          )}
          <span className="truncate">{title}</span>
        </div>
        <div className="font-display text-[34px] leading-none font-semibold tracking-tight mt-3 text-fb-text">
          {value}
        </div>
        {sub != null && <div className="text-xs text-fb-muted mt-2">{sub}</div>}
      </div>

      {score != null && (
        <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90 flex-none">
          <circle cx="32" cy="32" r={R} fill="none" stroke="var(--fb-track)" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r={R}
            fill="none"
            stroke={ringColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${C - dash}`}
            style={{ transition: 'stroke-dasharray .6s ease' }}
          />
        </svg>
      )}
    </div>
  )
}
