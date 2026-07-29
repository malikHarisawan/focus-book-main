/**
 * Resolved-presence → legacy `appUsageData` adapter.
 *
 * The renderer's dashboards consume a nested shape keyed by date:
 *   { [date]: { apps: { [key]: {time, category, productivity, ...} }, 'HH:00': {...} } }
 * and bucket each entry into productive/neutral/distracting via its `productivity` field
 * (see dataProcessor.accumulateProductivity → productivityForApp).
 *
 * This adapter turns LABELLED absence spans (the user's answer to the return prompt) into
 * that same shape, so a "Working"/"Meeting"/"Break" block shows up in the totals with no
 * renderer change. It is then merged into the app-usage data by the caller.
 *
 * DESIGN RULES (confirmed with the user):
 *   - Only LABELLED absences are credited. An idle/locked span with no annotation is NOT
 *     emitted here — unanswered away-time stays out of the totals, exactly as before.
 *   - Label → productivity:  working → productive,  meeting → productive,  break → neutral.
 *   - The absence remains an immutable fact; this is a READ-TIME projection of it, built
 *     from getResolvedPresence output. Nothing is written back onto the span.
 *
 * Pure and dependency-free (no DB, no Electron) — testable in plain node.
 */

// A labelled absence becomes a synthetic "app" row under this display key, so it reads
// clearly in any per-app breakdown ("Meeting", "Break", "Working") without colliding with
// real app names.
const LABEL_DISPLAY = {
  working: 'Working (away)',
  meeting: 'Meeting (away)',
  break: 'Break (away)'
}

// Label → resolver productivity. Anything unrecognised is treated as neutral so an
// unexpected free-text label can never inflate the productive total.
const LABEL_PRODUCTIVITY = {
  working: 'productive',
  meeting: 'productive',
  break: 'neutral'
}

// Category name shown for the synthetic row. 'Away' is a virtual category — it is not in
// the taxonomy and needs no rule; the row carries its own `productivity` so the dashboard
// buckets it directly without a category lookup.
const AWAY_CATEGORY = 'Away'

// Local date (YYYY-MM-DD) and hour bucket ('HH:00') for a span's start — mirrors
// appUsageAdapter.dateAndHour so both logs bucket identically.
function dateAndHour(startIso) {
  const d = new Date(startIso)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  return { date: `${yyyy}-${mm}-${dd}`, hour: `${hh}:00` }
}

function ensureEntry(root, date, bucket, appKey, seed) {
  if (!root[date]) root[date] = { apps: {} }
  if (bucket !== 'apps' && !root[date][bucket]) root[date][bucket] = {}
  const container = bucket === 'apps' ? root[date].apps : root[date][bucket]
  if (!container[appKey]) {
    container[appKey] = {
      time: 0,
      category: seed.category,
      productivity: seed.productivity,
      mode: null,
      description: seed.description,
      domain: '',
      // Marks this as away-derived time so a future timeline UI can distinguish it
      // from real app usage; the existing dashboards simply ignore the flag.
      isAway: true,
      timestamps: []
    }
  }
  return container[appKey]
}

/**
 * Build appUsageData-shaped rows from resolved presence spans.
 *
 * @param {Array} resolvedPresence output of PresenceService.getResolvedPresence — each
 *   item: { id, type, start, end, durationMs, userLabel }
 * @returns {object} nested appUsageData keyed by date -> apps/'HH:00' -> appKey
 */
function presenceToAppUsageData(resolvedPresence) {
  const root = {}
  if (!Array.isArray(resolvedPresence)) return root

  for (const span of resolvedPresence) {
    // Only labelled absences are credited. 'active' spans and unanswered absences are
    // skipped — the former is real app time (already counted via the span log), the
    // latter is intentionally left out of the totals.
    if (span.type === 'active') continue
    const label = span.userLabel ? String(span.userLabel).toLowerCase() : null
    if (!label) continue

    const productivity = LABEL_PRODUCTIVITY[label] || 'neutral'
    const appKey = LABEL_DISPLAY[label] || `${label} (away)`
    const seed = { category: AWAY_CATEGORY, productivity, description: appKey }
    const { date, hour } = dateAndHour(span.start)

    const daily = ensureEntry(root, date, 'apps', appKey, seed)
    daily.time += span.durationMs
    daily.productivity = productivity
    daily.timestamps.push({ start: new Date(span.start).toString(), duration: span.durationMs })

    const hourly = ensureEntry(root, date, hour, appKey, seed)
    hourly.time += span.durationMs
    hourly.productivity = productivity
    hourly.timestamps.push({ start: new Date(span.start).toString(), duration: span.durationMs })
  }

  return root
}

/**
 * Merge presence-derived usage into the app-usage tree IN PLACE (returns the same root).
 * Away rows use distinct synthetic keys ("Working (away)", …) so they never collide with
 * real app rows; time is summed defensively in case a key somehow already exists.
 */
function mergePresenceIntoUsage(usage, presenceUsage) {
  const root = usage || {}
  if (!presenceUsage) return root

  for (const date of Object.keys(presenceUsage)) {
    const src = presenceUsage[date]
    if (!root[date]) root[date] = { apps: {} }
    for (const bucket of Object.keys(src)) {
      const srcContainer = src[bucket]
      if (bucket !== 'apps' && !root[date][bucket]) root[date][bucket] = {}
      const dstContainer = bucket === 'apps' ? root[date].apps : root[date][bucket]
      for (const key of Object.keys(srcContainer)) {
        if (!dstContainer[key]) {
          dstContainer[key] = srcContainer[key]
        } else {
          dstContainer[key].time += srcContainer[key].time
          dstContainer[key].timestamps.push(...srcContainer[key].timestamps)
        }
      }
    }
  }
  return root
}

module.exports = { presenceToAppUsageData, mergePresenceIntoUsage, LABEL_PRODUCTIVITY }
