/**
 * Resolved-spans → legacy `appUsageData` adapter.
 *
 * The renderer (dataProcessor + all dashboards) consumes a nested shape:
 *   { [date]: { apps: { [appKey]: {time, category, mode, domain, description, timestamps} },
 *               'HH:00': { [appKey]: {...} } } }
 * and derives mode/productivity from `category` at render time.
 *
 * Under the span model, category is resolved at QUERY time. This adapter takes the
 * output of SpanService.getResolvedSpans (each span annotated with its resolved
 * category/productivity/winning_rule) and re-materializes the EXACT legacy shape, so
 * the renderer is untouched — it just receives a category that was resolved live
 * instead of one stored on a row. NO category is read off the span; it comes from the
 * resolver, so editing a rule changes this output on the next read (retroactive).
 *
 * Pure and dependency-free (no DB, no Electron) — testable in plain node.
 */

// Display key for a span, mirroring today's tracker:
//   web spans  -> the domain (site-level grouping the dashboard already uses)
//   app spans  -> the friendly FileDescription name (appName), else the raw exe
function displayKeyFor(span) {
  const k = span.key || {}
  if (k.source === 'web') {
    return k.domain || span.appName || k.app || 'Unknown'
  }
  return span.appName || k.app || 'Unknown'
}

// Local date (YYYY-MM-DD) and hour bucket ('HH:00') for a span's start. Uses the
// span's own start timestamp (already recorded) — no wall-clock read here.
function dateAndHour(startIso) {
  const d = new Date(startIso)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  return { date: `${yyyy}-${mm}-${dd}`, hour: `${hh}:00` }
}

// Ensure the nested containers exist and return the app entry for (date, bucket, key),
// creating it with zeroed time on first touch. `bucket` is 'apps' or an 'HH:00' string.
function ensureEntry(root, date, bucket, appKey, seed) {
  if (!root[date]) root[date] = { apps: {} }
  if (bucket !== 'apps' && !root[date][bucket]) root[date][bucket] = {}
  const container = bucket === 'apps' ? root[date].apps : root[date][bucket]
  if (!container[appKey]) {
    container[appKey] = {
      time: 0,
      category: seed.category,
      // productivity comes from the RESOLVER (rule-driven), carried through so the
      // renderer uses it directly instead of re-deriving from the legacy category
      // table (which doesn't know the new category names).
      productivity: seed.productivity,
      // Raw exe for the correction flow (app-rules must match key_app, not the
      // friendly display name).
      exe: seed.exe,
      // mode intentionally omitted — the renderer derives it from category. Included
      // as null so the shape matches and getMode(category) fallback kicks in.
      mode: null,
      description: seed.description,
      domain: seed.domain,
      // True when this key's time was attributed from a degraded (title-guessed)
      // browser span rather than a real URL. OR'd across the key's spans so the UI
      // can flag site totals whose accuracy is an estimate. Starts false.
      degraded: false,
      timestamps: []
    }
  }
  return container[appKey]
}

/**
 * Build the legacy appUsageData object from resolved spans.
 *
 * @param {Array} resolvedSpans output of SpanService.getResolvedSpans — each item has
 *   { key:{source,app,domain,path,title}, appName, start, end, durationMs, category,
 *     productivity, winning_rule }
 * @returns {object} nested appUsageData keyed by date -> apps/'HH:00' -> appKey
 */
function spansToAppUsageData(resolvedSpans) {
  const root = {}
  if (!Array.isArray(resolvedSpans)) return root

  for (const span of resolvedSpans) {
    const appKey = displayKeyFor(span)
    const { date, hour } = dateAndHour(span.start)
    // Uncategorized spans still surface in the dashboard as their category name so
    // time is never silently dropped; a null resolved category maps to 'Uncategorized'.
    const category = span.category || 'Uncategorized'
    // Resolver productivity; 'unrated' (unmatched) is shown as neutral for display.
    const productivity = span.productivity && span.productivity !== 'unrated' ? span.productivity : 'neutral'
    const domain = (span.key && span.key.source === 'web' && span.key.domain) || ''
    const description = span.appName || (span.key && span.key.app) || ''
    // Carry the RAW exe so a category correction can build an app-rule that matches
    // the span's key_app (e.g. 'code.exe'), not the friendly display key.
    const exe = (span.key && span.key.app) || ''
    const seed = { category, productivity, domain, description, exe }

    // Daily aggregate.
    const dailyEntry = ensureEntry(root, date, 'apps', appKey, seed)
    dailyEntry.time += span.durationMs
    dailyEntry.category = category // last-writer; all spans for a key share a resolution
    dailyEntry.productivity = productivity
    if (span.degraded) dailyEntry.degraded = true
    dailyEntry.timestamps.push({ start: new Date(span.start).toString(), duration: span.durationMs })

    // Hourly bucket.
    const hourlyEntry = ensureEntry(root, date, hour, appKey, seed)
    hourlyEntry.time += span.durationMs
    hourlyEntry.category = category
    hourlyEntry.productivity = productivity
    if (span.degraded) hourlyEntry.degraded = true
    hourlyEntry.timestamps.push({ start: new Date(span.start).toString(), duration: span.durationMs })
  }

  return root
}

module.exports = { spansToAppUsageData, displayKeyFor }
