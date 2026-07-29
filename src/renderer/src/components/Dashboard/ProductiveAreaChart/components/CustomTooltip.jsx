/**
 * CustomTooltip Component
 *
 * Custom tooltip for the productivity chart. Shows the hovered bucket's Focused and
 * Distracted time (binary model) plus a Total and productivity %. All values are
 * rounded ONCE to whole minutes and the total/percentage are derived from those
 * rounded integers, so the displayed parts always sum to the displayed total
 * (see docs/BUCKET_AGGREGATION_ENGINE.md §3).
 *
 * Props:
 * - active: Boolean indicating if tooltip should be shown
 * - payload: Data from Recharts for the hovered point (carries focusedMs / distractedMs)
 * - label: The label of the hovered point
 */

// Format whole minutes as "2h 30m" / "45m". Input is already ROUNDED minutes, so no
// rounding happens here — this is pure display (see the one-rounding-pass rule below).
const fmtMinutes = (min) => {
  if (min <= 0) return '0m'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null

  // Hovered bucket. BINARY model: the tooltip shows Focused + Distracted, and Total is
  // DEFINED as their sum, so the displayed parts always reconcile with the displayed
  // total. Values on the point are milliseconds.
  const pointData = payload[0]?.payload || {}
  const focusedMs = pointData.focusedMs || 0
  const distractedMs = pointData.distractedMs || 0

  // ONE ROUNDING PASS (see docs/BUCKET_AGGREGATION_ENGINE.md §3): round each component
  // to whole minutes ONCE, then derive the total and percentage FROM the rounded
  // integers — never from the raw ms. This is what makes 4 + 1 == 5 on screen and the
  // percentage match the numbers the user can add up themselves.
  const fMin = Math.round(focusedMs / 60000)
  const dMin = Math.round(distractedMs / 60000)
  const totalMin = fMin + dMin
  const productivePercentage = totalMin > 0 ? Math.round((fMin / totalMin) * 100) : null

  const productiveTime = fmtMinutes(fMin)
  const distractingTime = fmtMinutes(dMin)
  const totalTime = fmtMinutes(totalMin)

  return (
    <div
      className="p-3 rounded-xl shadow-lg min-w-[180px] text-white"
      style={{ background: 'var(--fb-tip)' }}
    >
      <p className="font-display font-semibold mb-2 text-white">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--c-deep)' }} />
            <span className="text-white/70 text-sm">Focused:</span>
          </div>
          <span className="text-white text-sm font-semibold">{productiveTime}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--c-distract)' }} />
            <span className="text-white/70 text-sm">Distracted:</span>
          </div>
          <span className="text-white text-sm font-semibold">{distractingTime}</span>
        </div>
        <div className="flex items-center justify-between gap-4 pt-1.5 mt-1.5 border-t border-white/15">
          <span className="text-white/70 text-sm">Total:</span>
          <span className="text-white text-sm font-semibold">{totalTime}</span>
        </div>
        {/* Percentage is hidden (not shown as 0%) when there's no tracked time — "0%
            productive" on an untracked bucket would be another untracked-as-zero lie. */}
        {productivePercentage !== null && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-white/70 text-sm">Productivity:</span>
            <span
              className="text-sm font-semibold"
              style={{ color: productivePercentage >= 50 ? 'var(--c-deep)' : 'var(--c-distract)' }}
            >
              {productivePercentage}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default CustomTooltip
