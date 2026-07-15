/**
 * CustomTooltip Component
 *
 * Custom tooltip for the productivity chart that shows aggregated data
 * and productivity metrics for the current selection or entire dataset.
 *
 * Props:
 * - active: Boolean indicating if tooltip should be shown
 * - payload: Data from Recharts for the hovered point
 * - label: The label of the hovered point
 * - aggregatedData: Object with productive, neutral, distracting, and total time
 * - hasSelection: Boolean indicating if there's an active selection
 * - zoomLevel: Current zoom level for contextual title
 * - zoomLevelDetail: Detailed description of current zoom level
 */

import React from 'react'
import { formatTooltipValue, getTooltipTitle } from '../utils/selectionUtils'

// The five work-modes in display order, each with its design-system color token
// (theme-aware) and the productivity band it rolls up into. Drives the tooltip's
// Level-2 drill-down so the mode split reconciles with the Focused/Distracted rows.
const MODE_META = [
  { name: 'Deep work', color: 'var(--c-deep)', band: 'productive' },
  { name: 'Creative', color: 'var(--c-create)', band: 'productive' },
  { name: 'Collaboration', color: 'var(--c-comms)', band: 'productive' },
  { name: 'Break', color: 'var(--c-break)', band: 'neutral' },
  { name: 'Distraction', color: 'var(--c-distract)', band: 'distracting' }
]

const CustomTooltip = ({ active, payload, label, aggregatedData, hasSelection, zoomLevel, zoomLevelDetail }) => {
  if (!active || !payload || payload.length === 0) return null

  // Get the data for the hovered point. The chart shows only productive and
  // distracting (neutral is intentionally omitted), so the tooltip total is the
  // sum of those two to stay consistent with what's drawn.
  const pointData = payload[0]?.payload || {}
  const productiveSeconds = pointData.productive || 0
  const distractingSeconds = pointData.distracting || 0
  const totalSeconds = productiveSeconds + distractingSeconds

  // Level-2 drill-down: the per-mode split accrued onto every chart point. Show
  // only the modes with time, in canonical order. Deep-work/Creative/Collaboration
  // sum to the Focused row; Distraction to the Distracted row (Break is neutral and
  // not drawn on the chart, so it can appear here without matching a band).
  const modeSplit = pointData.modes || {}
  const modeRows = MODE_META.map((m) => ({ ...m, seconds: modeSplit[m.name] || 0 })).filter(
    (m) => m.seconds > 0
  )

  const productiveTime = formatTooltipValue(productiveSeconds)
  const distractingTime = formatTooltipValue(distractingSeconds)
  const totalTime = formatTooltipValue(totalSeconds)
  const productivePercentage =
    totalSeconds > 0
      ? Math.round((productiveSeconds / totalSeconds) * 100)
      : 0

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
        {totalSeconds > 0 && (
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

        {/* Level-2 work-mode drill-down for this point. */}
        {modeRows.length > 0 && (
          <div className="pt-2 mt-1.5 border-t border-white/15 space-y-1">
            <div className="text-white/50 text-[11px] uppercase tracking-wide mb-1">By mode</div>
            {modeRows.map((m) => (
              <div key={m.name} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                  <span className="text-white/70 text-[13px]">{m.name}</span>
                </div>
                <span className="text-white text-[13px] font-medium">
                  {formatTooltipValue(m.seconds)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CustomTooltip
