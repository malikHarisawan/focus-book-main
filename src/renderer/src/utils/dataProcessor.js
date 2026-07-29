// Category metadata is DB-driven — the `categories` table is the single source of
// truth for productivity type, color, and icon. This module is the renderer-side
// cache: it loads the full metadata once (get-all-categories) and exposes lookups
// so no component needs its own hardcoded color/icon/productivity map.
//
// Fallbacks below apply when the DB is unreachable or a category has no color/icon
// set, so the UI degrades gracefully (Neutral / gray / Package) rather than
// crashing.
let categoryProductivityMap = {}
let categoryColorMap = {}
let categoryIconMap = {}
let categoryList = [] // [{ name, type, color, icon }, ...]

// Work-mode (Level 2) caches. These are ADDITIVE — the category/verdict caches
// above are untouched, so the AreaChart and every getProductivity* consumer keep
// working exactly as before. Modes are a finer level that rolls up into the verdict.
let categoryModeMap = {} // category name -> default mode (from categories.default_mode)
let modeRollupMap = {} // mode name -> 'productive' | 'distracted' | 'neutral'
let modeList = [] // [{ name, rollup, color, icon }, ...]

// Sensible defaults when the DB has no color/icon for a category, or is offline.
const DEFAULT_CATEGORY_COLOR = '#7a7a7a'
const DEFAULT_CATEGORY_ICON = 'Package'

// Fallbacks so the mode seam degrades gracefully when the DB is unreachable. These
// mirror the schema seed (modes table + categories.default_mode) so behaviour is
// identical offline.
//
// BINARY VERDICT MODEL (see docs/BUCKET_AGGREGATION_ENGINE.md): every second is either
// 'productive' (Focused) or 'distracted' (Distracted) — there is no 'neutral' band.
// Anything not clearly productive rolls up to 'distracted', so Break, uncategorized,
// and unknown time all count against Focus%. The mode TAXONOMY is unchanged; only its
// ROLLUP collapses to two verdicts. `normalizeVerdict` below is the single choke point
// that enforces this, so any stray 'neutral' from the DB is coerced to 'distracted'.
const DEFAULT_MODE = 'Break'
const DEFAULT_MODE_ROLLUP = 'distracted' // not-clearly-productive -> distracted
const FALLBACK_MODE_ROLLUP = {
  'Deep work': 'productive',
  Creative: 'productive',
  Collaboration: 'productive',
  Break: 'distracted', // rest/uncategorized counts against focus under the binary model
  Distraction: 'distracted'
}

// The one place the binary rule lives: collapse any legacy three-band verdict
// ('productive' | 'neutral' | 'distracting'/'distracted') to the two we keep. Only an
// explicit 'productive' survives as productive; everything else is 'distracted'. Every
// rollup/label path funnels through this so the numbers can never drift back apart.
const normalizeVerdict = (raw) => (raw === 'productive' ? 'productive' : 'distracted')
const FALLBACK_CATEGORY_MODE = {
  // Legacy category names (kept for any pre-cutover data).
  Code: 'Deep work',
  Learning: 'Deep work',
  Browsing: 'Deep work',
  Communication: 'Collaboration',
  Utilities: 'Break',
  Entertainment: 'Distraction',
  'Social Media': 'Distraction',
  Miscellaneous: 'Break',
  // SPAN-MODEL taxonomy (the categories seeded in schema.sql). Maps each resolved
  // category to a work-mode so the Focus-balance donut groups correctly under the
  // new engine (the legacy categories table doesn't know these names).
  Coding: 'Deep work',
  Social: 'Distraction',
  Uncategorized: 'Break'
}

// A stable color per span-model category, keyed by name. The new `category` table
// has no color column, so the renderer owns the palette here (used by the Apps-page
// dropdown dots, the category chips, and the time bars). Unknown names fall back to
// DEFAULT_CATEGORY_COLOR via getCategoryColorFromDB.
const SPAN_CATEGORY_COLORS = {
  Coding: '#00d8ff',
  Learning: '#14b8a6',
  Communication: '#a855f7',
  Browsing: '#b381c9',
  Utilities: '#36a2eb',
  Entertainment: '#ff6384',
  Social: '#f97316',
  Uncategorized: '#7a7a7a'
}

// Load category metadata from the SPAN-MODEL `category` table (the single source of
// truth). This is what the Apps-page dropdown, productivity badges, and colors read,
// so it matches exactly what corrections write. Falls back to the legacy tables only
// if the span endpoint is unavailable.
async function loadCategoryProductivityMapping() {
  try {
    let cats = []
    if (window.activeWindow?.spanGetCategories) {
      cats = await window.activeWindow.spanGetCategories()
    }

    if (Array.isArray(cats) && cats.length > 0) {
      const pMap = {}
      const cMap = {}
      cats.forEach((c) => {
        if (!c || !c.name) return
        // New table uses default_productivity ('productive'|'neutral'|'distracting').
        // Under the binary model, only 'productive' stays productive; 'neutral' and
        // 'distracting' both collapse to 'distracted' via normalizeVerdict.
        pMap[c.name] = normalizeVerdict(c.default_productivity)
        if (SPAN_CATEGORY_COLORS[c.name]) cMap[c.name] = SPAN_CATEGORY_COLORS[c.name]
      })
      categoryProductivityMap = pMap
      categoryColorMap = cMap
      categoryIconMap = {}
      // Mode is category-derived under the span model (FALLBACK_CATEGORY_MODE covers
      // the new taxonomy), so no per-category default_mode is loaded from the DB.
      categoryModeMap = {}
      categoryList = cats.map((c) => ({
        name: c.name,
        type: normalizeVerdict(c.default_productivity), // 'productive' | 'distracted'
        color: SPAN_CATEGORY_COLORS[c.name] || DEFAULT_CATEGORY_COLOR
      }))
      console.log('Span category metadata loaded:', categoryList.length, 'categories')

      // Mode metadata (colors/rollup) for the donut still comes from the modes table.
      await loadModeMetadata()
      return
    }

    // Fallback: legacy [productive[], distracted[]] shape.
    const categories = await window.activeWindow?.loadCategories?.()
    if (Array.isArray(categories)) {
      const [productive = [], distracted = []] = categories
      const map = {}
      productive.forEach((name) => { map[name] = 'productive' })
      distracted.forEach((name) => { map[name] = 'distracted' })
      categoryProductivityMap = map
    }
  } catch (error) {
    console.error('Error loading category metadata:', error)
  }
}

// Load the work-mode (Level 2) metadata: the modes table (name/rollup/color/icon)
// and the category -> default_mode map. Populates the module-level mode caches used
// by getMode/getModeRollup. Never throws — leaves the caches empty on failure so the
// getMode* fallbacks take over.
async function loadModeMetadata() {
  try {
    const [modes, defaultModes] = await Promise.all([
      window.activeWindow?.loadAllModes ? window.activeWindow.loadAllModes() : [],
      window.activeWindow?.loadCategoryDefaultModes
        ? window.activeWindow.loadCategoryDefaultModes()
        : {}
    ])

    if (Array.isArray(modes) && modes.length > 0) {
      const rMap = {}
      modes.forEach((m) => {
        if (!m || !m.name) return
        if (m.rollup) rMap[m.name] = m.rollup
      })
      modeRollupMap = rMap
      modeList = modes
    }

    // Merge category default-modes from the DB over what we already read from the
    // categories payload (the dedicated endpoint is the authoritative source).
    if (defaultModes && typeof defaultModes === 'object') {
      categoryModeMap = { ...categoryModeMap, ...defaultModes }
    }

    console.log('Mode metadata loaded:', modeList.length, 'modes')
  } catch (error) {
    console.error('Error loading mode metadata:', error)
  }
}

// Initialize the mapping when the module loads
loadCategoryProductivityMapping()

// Export function to refresh category mappings if needed
export const refreshCategoryMapping = () => {
  return loadCategoryProductivityMapping()
}

// DB-driven category color. Falls back to a neutral gray when unknown.
export const getCategoryColorFromDB = (category) => {
  return categoryColorMap[category] || DEFAULT_CATEGORY_COLOR
}

// DB-driven category icon name (a lucide-react icon name string). Falls back to
// 'Package'. Consumers resolve the string to a component/emoji themselves.
export const getCategoryIconFromDB = (category) => {
  return categoryIconMap[category] || DEFAULT_CATEGORY_ICON
}

// The full list of categories [{ name, type, color, icon }] for dropdowns/menus.
export const getCategoryList = () => categoryList
export const formatTime = (milliseconds) => {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60))
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60))

  return `${hours * 60 + minutes}`
}

// Map a category to its display productivity level. BINARY model: 'Productive' |
// 'Distracting' only. Anything not clearly productive (including the old 'neutral')
// reads as 'Distracting'. Exported so all components share this one mapping.
export const getProductivity = (category) => {
  return normalizeVerdict(categoryProductivityMap[category]) === 'productive'
    ? 'Productive'
    : 'Distracting'
}

// Export getProductivityType for external use — returns the raw binary verdict
// ('productive' | 'distracted'). Legacy 'neutral' collapses to 'distracted'.
export const getProductivityType = (category) => {
  return normalizeVerdict(categoryProductivityMap[category])
}

// SPAN MODEL: map a resolver productivity ('productive'|'neutral'|'distracting') to
// the display label. Under the span model each app row carries the RESOLVED
// productivity (rule-driven), so prefer it over re-deriving from the legacy category
// table. Binary: only 'productive' is Productive; everything else is 'Distracting'.
export const productivityLabel = (raw) => {
  return normalizeVerdict(raw) === 'productive' ? 'Productive' : 'Distracting'
}

// Resolve an app's display productivity: prefer the resolver value carried on the
// row (span model), else fall back to deriving from the category (legacy).
export const productivityForApp = (app) => {
  if (app && app.productivity) return productivityLabel(app.productivity)
  return getProductivity(app && app.category)
}

// --- Work-mode (Level 2) seam ---
// These are ADDITIVE lookups that sit beside the verdict seam above. In Phase 1
// the mode of an app is derived from its category's default_mode; Phase 2 will
// pass a richer signature through the scorer, but the getMode* API stays the same.

// Resolve the work-mode for a category. Falls back to the DB-less default map and
// finally to Break so this never returns undefined. (Break is a valid mode; it just
// rolls up to 'distracted' under the binary model.)
export const getMode = (category) => {
  return categoryModeMap[category] || FALLBACK_CATEGORY_MODE[category] || DEFAULT_MODE
}

// Roll a mode up to its BINARY verdict ('productive' | 'distracted'). This is the
// bridge that keeps the AreaChart's two bands equal to the sum of their modes — always
// drive band membership through this, never a hardcoded map. Any legacy 'neutral' from
// the DB is collapsed to 'distracted' via normalizeVerdict.
export const getModeRollup = (mode) => {
  return normalizeVerdict(modeRollupMap[mode] || FALLBACK_MODE_ROLLUP[mode] || DEFAULT_MODE_ROLLUP)
}

export function formatAppsData(rawData, date) {
  const appMap = new Map()

  const apps = rawData[date]?.apps || {}
  for (const [key, value] of Object.entries(apps)) {
    // Standardize app name resolution - same as Dashboard logic
    const name = (value.domain || value.description || key).toLowerCase()
    const displayName = value.domain || value.description || key
    const prevTime = appMap.get(name)?.timeSpentSeconds || 0

    appMap.set(name, {
      key: key,
      name: displayName, // Use original case for display
      category: value.category,
      // Resolver productivity (span model), carried through for the row badge.
      productivity: value.productivity || appMap.get(name)?.productivity || null,
      // Raw exe so a category correction builds an app-rule matching key_app.
      exe: value.exe || appMap.get(name)?.exe || '',
      domain: value.domain || appMap.get(name)?.domain || '',
      description: value.description || appMap.get(name)?.description || '',
      // True when any of this key's time was attributed from a title-guessed
      // (degraded) browser span rather than a real URL — surfaced as an "estimated"
      // badge so the user knows the total is approximate. OR'd across merged rows.
      degraded: Boolean(value.degraded) || Boolean(appMap.get(name)?.degraded),
      timeSpentSeconds: prevTime + value.time
    })
  }

  function formatAppsTime(seconds) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h > 0 ? h + 'h ' : ''}${m}m`
  }

  const result = []
  let id = 1
  for (const app of appMap.values()) {
    result.push({
      id: id++,
      key: app.key,
      name: app.name,
      category: app.category,
      exe: app.exe || '',
      domain: app.domain || '',
      description: app.description || '',
      timeSpent: formatAppsTime(Math.floor(app.timeSpentSeconds / 1000)),
      timeSpentSeconds: Math.floor(app.timeSpentSeconds / 1000),
      // Prefer the resolver productivity carried on the row; fall back to category.
      productivity: productivityForApp(app),
      // Carried to the UI so browser rows whose time was title-guessed can be
      // flagged as an estimate rather than presented as exact.
      degraded: Boolean(app.degraded),
      trend: 'up' // static for now; could be dynamic with historical data
    })
  }

  return result
}

// Add an app's time to the correct productivity bucket of a chart data point.
// BINARY model: exactly two bands, `focused` and `distracted` (seconds), so the chart,
// summary cards, and tooltip all agree and Focused + Distracted == tracked time. It
// ALSO accrues the Level-2 work-mode split into `bucket.modes` (the taxonomy is
// unchanged) so the donut/drill-down still have per-mode detail.
const accumulateProductivity = (bucket, app) => {
  if (!app.category || !app.time) return

  const seconds = app.time / 1000
  // Prefer the resolver productivity carried on the row (span model); fall back to
  // deriving from the category. Only 'Productive' is Focused; everything else counts
  // as Distracted.
  if (productivityForApp(app) === 'Productive') {
    bucket.focused += seconds
  } else {
    bucket.distracted += seconds
  }

  // Level-2 mode accrual (kept for the mode donut/drill-down). Mode is category-
  // derived under the span model.
  if (bucket.modes) {
    const mode = getMode(app.category)
    if (bucket.modes[mode] === undefined) bucket.modes[mode] = 0
    bucket.modes[mode] += seconds
  }
}

// A zero-seed chart point. `focused`/`distracted` are SECONDS accrued from spans;
// `tracked` starts false and is flipped true by the per-view builder when any span
// touches this bucket (untracked != zero — see docs/BUCKET_AGGREGATION_ENGINE.md §2).
// The bucket builders derive `focusedMs`/`distractedMs`/`untrackedMs` from these at
// the end; the raw `focused`/`distracted` seconds are kept for the tooltip.
const emptyPoint = (day) => ({
  day,
  focused: 0,
  distracted: 0,
  tracked: false,
  modes: { 'Deep work': 0, Creative: 0, Collaboration: 0, Break: 0, Distraction: 0 }
})

// Format a Date as a LOCAL YYYY-MM-DD (not UTC). Using toISOString() here would
// shift the day for non-UTC timezones (e.g. a local midnight rolls back a day),
// which is exactly why the month view used to span 06-30..07-30 instead of the
// intended 07-01..07-31.
const toLocalDateStr = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// The list of YYYY-MM-DD dates covered by a given zoom/view level, anchored on
// `date`. Mirrors the ranges the area chart uses so the summary cards and the
// chart always describe the same window:
//   hour/day -> just `date`; week -> the Sun..Sat week containing `date`;
//   month    -> every day of `date`'s calendar month.
export const getDatesForView = (date, viewType = 'day') => {
  const dateObj = new Date(date)
  if (viewType === 'week') {
    const dates = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(dateObj)
      d.setDate(dateObj.getDate() - dateObj.getDay() + i)
      dates.push(toLocalDateStr(d))
    }
    return dates
  }
  if (viewType === 'month') {
    const year = dateObj.getFullYear()
    const month = dateObj.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const dates = []
    for (let day = 1; day <= daysInMonth; day++) {
      dates.push(toLocalDateStr(new Date(year, month, day)))
    }
    return dates
  }
  // 'hour' and 'day' both describe a single day.
  return [typeof date === 'string' ? date : toLocalDateStr(dateObj)]
}

// Aggregate focused / distracted / total SECONDS across the date window for a view
// level. Used by the dashboard summary cards so they reflect the current day/week/month
// view. BINARY model: totalSeconds == focused + distracted (no neutral). The legacy
// keys `productiveSeconds`/`distractingSeconds`/`neutralSeconds` are still returned as
// aliases so existing card code keeps working; `neutralSeconds` is always 0 now.
export const getProductivityTotals = (jsonData, date, viewType = 'day') => {
  const totals = { focused: 0, distracted: 0 }
  if (jsonData) {
    for (const d of getDatesForView(date, viewType)) {
      const apps = jsonData[d]?.apps
      if (!apps) continue
      for (const app of Object.values(apps)) {
        accumulateProductivity(totals, app)
      }
    }
  }
  const productiveSeconds = Math.floor(totals.focused)
  const distractingSeconds = Math.floor(totals.distracted)
  return {
    productiveSeconds,
    distractingSeconds,
    neutralSeconds: 0, // binary model: neutral no longer exists (alias kept at 0)
    focusedSeconds: productiveSeconds,
    distractedSeconds: distractingSeconds,
    totalSeconds: productiveSeconds + distractingSeconds
  }
}

// Resolve an app record's work-mode for aggregation. Prefers the mode stored on
// the record (Phase 2 writes it per app), falling back to the category's default
// mode when absent (old rows, or data written before mode tracking). This is what
// keeps historical data rendering correctly without a backfill.
const modeForApp = (app) => {
  if (app && app.mode) return app.mode
  return getMode(app ? app.category : undefined)
}

// Aggregate SECONDS per work-mode across the date window for a view level, plus a
// verdict rollup that is GUARANTEED to match getProductivityTotals' three buckets
// (each mode's seconds land in its rollup bucket). Used by the mode donut and the
// per-mode stat totals.
//
// Returns:
//   { byMode: { 'Deep work': s, Creative: s, Collaboration: s, Break: s, Distraction: s },
//     rollup: { productive: s, neutral: s, distracting: s },
//     totalSeconds }
export const getModeTotals = (jsonData, date, viewType = 'day') => {
  const byMode = {
    'Deep work': 0,
    Creative: 0,
    Collaboration: 0,
    Break: 0,
    Distraction: 0
  }
  if (jsonData) {
    for (const d of getDatesForView(date, viewType)) {
      const apps = jsonData[d]?.apps
      if (!apps) continue
      for (const app of Object.values(apps)) {
        if (!app || !app.time) continue
        const mode = modeForApp(app)
        const seconds = app.time / 1000
        if (byMode[mode] === undefined) byMode[mode] = 0
        byMode[mode] += seconds
      }
    }
  }

  // Floor each mode and roll it up so the donut segments and the focused/distracted
  // card totals reconcile to the same numbers. BINARY: every mode lands in exactly one
  // of two buckets (getModeRollup is guaranteed binary). `neutral` alias kept at 0.
  const rollup = { productive: 0, distracting: 0, neutral: 0 }
  let totalSeconds = 0
  for (const [mode, secs] of Object.entries(byMode)) {
    const floored = Math.floor(secs)
    byMode[mode] = floored
    totalSeconds += floored
    if (getModeRollup(mode) === 'productive') rollup.productive += floored
    else rollup.distracting += floored
  }

  return { byMode, rollup, totalSeconds }
}

// Bucket durations in ms — the fixed ceiling each bucket type can hold. Hour buckets
// hold 60 min; the day/week/month/custom builders bucket by DAY (one point per day).
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

// Finalize a chart point: convert accrued focused/distracted SECONDS to ms, set the
// `tracked` flag (untracked != zero — §2), and derive `untrackedMs` as the remainder of
// the bucket so the three ALWAYS exhaust `bucketMs` (§1 EXHAUSTION invariant). Mutates
// and returns the point. `focused`/`distracted` seconds are kept for the tooltip.
const finalizeBucket = (point, bucketMs) => {
  const focusedMs = Math.round(point.focused * 1000)
  const distractedMs = Math.round(point.distracted * 1000)
  const trackedMs = focusedMs + distractedMs
  point.focusedMs = focusedMs
  point.distractedMs = distractedMs
  // Clamp: spans can slightly over-attribute a bucket (boundary overlap / float drift);
  // untracked is never negative, and over-attribution is capped at the bucket.
  point.untrackedMs = Math.max(0, bucketMs - trackedMs)
  point.bucketMs = bucketMs
  point.tracked = trackedMs > 0
  return point
}

export const processProductiveChartData = (jsonData, date, viewType = 'day') => {
  if (viewType === 'hour') {
    if (!jsonData || !jsonData[date]) {
      return []
    }

    // Dynamic timeline (mirrors DayTimeline's fit-to-data axis): instead of a
    // fixed 9am–9pm window, find the earliest and latest hours that actually
    // hold activity, pad by one hour on each side, and clamp to [0, 23]. A
    // 50-minute day no longer gets stretched across a static 13-hour axis, and
    // early-morning / late-night usage is no longer clipped off the chart.
    const activeHours = []
    for (const [hourKey, hourData] of Object.entries(jsonData[date])) {
      if (hourKey === 'apps') continue
      const hour = parseInt(hourKey.split(':')[0])
      if (isNaN(hour) || hour < 0 || hour > 23) continue
      // Only count the hour as active if it actually carries usage.
      const hasUsage = Object.values(hourData).some((app) => app && app.time > 0)
      if (hasUsage) activeHours.push(hour)
    }

    // No activity at all → fall back to the conventional working-day window so
    // the chart still renders a sensible empty axis rather than nothing.
    let startHour = 9
    let endHour = 21
    if (activeHours.length > 0) {
      startHour = Math.max(0, Math.min(...activeHours) - 1)
      endHour = Math.min(23, Math.max(...activeHours) + 1)
    }

    const hourlyData = []
    for (let i = startHour; i <= endHour; i++) {
      hourlyData.push(emptyPoint(i === 0 ? '12AM' : i === 12 ? '12PM' : i < 12 ? `${i}AM` : `${i - 12}PM`))
    }

    for (const [hourKey, hourData] of Object.entries(jsonData[date])) {
      if (hourKey === 'apps') continue

      const hour = parseInt(hourKey.split(':')[0])
      if (isNaN(hour) || hour < 0 || hour > 23) continue

      const index = hour - startHour
      if (index < 0 || index >= hourlyData.length) continue

      for (const app of Object.values(hourData)) {
        accumulateProductivity(hourlyData[index], app)
      }
    }

    return hourlyData.map((p) => finalizeBucket(p, HOUR_MS))
  } else if (viewType === 'day') {
    if (!jsonData || !jsonData[date]) {
      return []
    }

    // Dynamic timeline (mirrors DayTimeline's fit-to-data axis): fit the axis to
    // the earliest→latest active hours (padded one hour each side, clamped to
    // [0, 23]) instead of always drawing a mostly-empty 24-hour window. Falls
    // back to the full day when there's no activity.
    const activeHours = []
    for (const [hourKey, hourData] of Object.entries(jsonData[date])) {
      if (hourKey === 'apps') continue
      const hour = parseInt(hourKey.split(':')[0])
      if (isNaN(hour) || hour < 0 || hour > 23) continue
      const hasUsage = Object.values(hourData).some((app) => app && app.time > 0)
      if (hasUsage) activeHours.push(hour)
    }

    let startHour = 0
    let endHour = 23
    if (activeHours.length > 0) {
      startHour = Math.max(0, Math.min(...activeHours) - 1)
      endHour = Math.min(23, Math.max(...activeHours) + 1)
    }

    const fullDayData = []
    for (let i = startHour; i <= endHour; i++) {
      fullDayData.push(
        emptyPoint(i === 0 ? '12AM' : i === 12 ? '12PM' : i < 12 ? `${i}AM` : `${i - 12}PM`)
      )
    }

    for (const [hourKey, hourData] of Object.entries(jsonData[date])) {
      if (hourKey === 'apps') continue

      const hour = parseInt(hourKey.split(':')[0])
      if (isNaN(hour) || hour < 0 || hour > 23) continue

      const index = hour - startHour
      if (index < 0 || index >= fullDayData.length) continue

      for (const app of Object.values(hourData)) {
        accumulateProductivity(fullDayData[index], app)
      }
    }

    // Day view is HOURLY buckets, so each holds at most 60 min.
    return fullDayData.map((p) => finalizeBucket(p, HOUR_MS))
  } else if (viewType === 'week') {
    const weekData = []
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    // Reuse the shared (local-date) window so the chart and the summary cards
    // agree on exactly which days the week covers.
    const weekDates = getDatesForView(date, 'week')

    weekDates.forEach((formattedDate, i) => {
      const dayData = emptyPoint(dayNames[i])

      if (jsonData[formattedDate] && jsonData[formattedDate].apps) {
        for (const app of Object.values(jsonData[formattedDate].apps)) {
          accumulateProductivity(dayData, app)
        }
      }

      weekData.push(dayData)
    })

    return weekData.map((p) => finalizeBucket(p, DAY_MS))
  } else if (viewType === 'month') {
    const monthData = []
    // Shared local-date window (fixes the old toISOString() off-by-one that
    // made the month span the previous day..30th in non-UTC timezones).
    const monthDates = getDatesForView(date, 'month')

    monthDates.forEach((formattedDate, idx) => {
      const day = idx + 1
      const dayData = emptyPoint(day.toString())

      if (jsonData[formattedDate] && jsonData[formattedDate].apps) {
        for (const app of Object.values(jsonData[formattedDate].apps)) {
          accumulateProductivity(dayData, app)
        }
      }

      monthData.push(dayData)
    })

    return monthData.map((p) => finalizeBucket(p, DAY_MS))
  }
}

/**
 * Custom date-range chart series: one point per day between startDate and
 * endDate (inclusive), each holding that day's focused/distracted seconds (binary
 * model) plus the exhaustive bucket fields (focusedMs/distractedMs/untrackedMs/tracked).
 * Same point shape as processProductiveChartData so it drops straight into
 * ProductiveAreaChart. Dates are YYYY-MM-DD; order is auto-corrected if start is after
 * end. Capped at 366 days to keep the axis readable.
 */
export const processCustomRangeChartData = (jsonData, startDate, endDate) => {
  if (!jsonData || !startDate || !endDate) return []

  let start = new Date(startDate + 'T00:00:00')
  let end = new Date(endDate + 'T00:00:00')
  if (isNaN(start) || isNaN(end)) return []
  if (start > end) [start, end] = [end, start]

  const out = []
  const cursor = new Date(start)
  let guard = 0
  while (cursor <= end && guard < 366) {
    const key = toLocalDateStr(cursor)
    // Short "Mon D" label for the x-axis.
    const label = cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const point = emptyPoint(label)

    if (jsonData[key] && jsonData[key].apps) {
      for (const app of Object.values(jsonData[key].apps)) {
        accumulateProductivity(point, app)
      }
    }
    out.push(finalizeBucket(point, DAY_MS))

    cursor.setDate(cursor.getDate() + 1)
    guard++
  }
  return out
}

export const processMostUsedApps = (jsonData, date) => {
  if (!jsonData || !jsonData[date]) {
    return []
  }

  const appTimeMap = {}

  // Use daily aggregated apps data if available (this should be the pre-aggregated total)
  // Only fall back to hourly aggregation if daily data is missing
  if (jsonData[date].apps && Object.keys(jsonData[date].apps).length > 0) {
    // Process daily aggregated apps data (this is already the total for the day)
    for (const [name, data] of Object.entries(jsonData[date].apps)) {
      const displayName = data.domain || data.description || name
      const key = displayName.toLowerCase() // Standardize key for grouping
      const productivity = getProductivity(data.category)

      if (appTimeMap[key]) {
        // Aggregate time for apps with same normalized name
        appTimeMap[key].time += data.time
      } else {
        appTimeMap[key] = {
          name: displayName, // Keep original case for display
          time: data.time,
          category: data.category,
          domain: data.domain,
          description: data.description,
          productivity: productivity
        }
      }
    }
  } else {
    // Fallback: Process hourly data if daily aggregated data is not available
    for (const [hourKey, hourData] of Object.entries(jsonData[date])) {
      // Skip the 'apps' key and only process time-formatted keys
      if (hourKey === 'apps' || !hourKey.match(/^\d{2}:\d{2}$/)) {
        continue
      }

      for (const [name, data] of Object.entries(hourData)) {
        const displayName = data.domain || data.description || name
        const key = displayName.toLowerCase() // Standardize key for grouping
        const productivity = getProductivity(data.category)

        if (appTimeMap[key]) {
          appTimeMap[key].time += data.time
        } else {
          appTimeMap[key] = {
            name: displayName, // Keep original case for display
            time: data.time,
            category: data.category,
            domain: data.domain,
            description: data.description,
            productivity: productivity
          }
        }
      }
    }
  }

  const apps = Object.values(appTimeMap)

  console.log('apps ==>> ', apps)
  apps.sort((a, b) => b.time - a.time)

  const maxTime = apps[0]?.time || 1

  return apps.length > 5
    ? apps.slice(0, 5).map((app) => ({
        name: app.name, // Use the standardized display name
        time: formatTime(app.time),
        usagePercent: app.time / maxTime,
        icon: app.name.charAt(0).toUpperCase(),
        category: app.category,
        productivity: app.productivity
      }))
    : apps.map((app) => ({
        name: app.name, // Use the standardized display name
        time: formatTime(app.time),
        usagePercent: app.time / maxTime,
        icon: app.name.charAt(0).toUpperCase(),
        category: app.category,
        productivity: app.productivity
      }))
}

/**
 * Extract apps from selected time range with detailed usage information
 * @param {Object} rawData - Raw usage data
 * @param {string} selectedDate - Currently selected date
 * @param {Object} selectedRange - Selected range with startIndex and endIndex
 * @param {Array} chartData - Processed chart data for the current view
 * @param {string} zoomLevel - Current zoom level (hour, day, week, month)
 * @returns {Array} Array of apps with their usage details for the selected range
 */
export const getAppsForSelectedRange = (
  rawData,
  selectedDate,
  selectedRange,
  chartData,
  
  zoomLevel
) => {
  if (!rawData || !selectedDate || !selectedRange || !chartData || chartData.length === 0) {
    return []
  }

  const { startIndex, endIndex } = selectedRange
  const appUsageMap = new Map()

  try {
    if (zoomLevel === 'hour' || zoomLevel === 'day') {
      // For hour/day view, extract apps from specific hours
      if (!rawData[selectedDate]) return []

      const selectedHours = chartData.slice(startIndex, endIndex + 1)

      for (const hourData of selectedHours) {
        const hourKey = hourData.day

        // Convert display format back to hour format for lookup
        let hour24Format
        if (hourKey.includes('AM') || hourKey.includes('PM')) {
          const hourNum = parseInt(hourKey.replace(/[AP]M/, ''))
          if (hourKey.includes('AM')) {
            hour24Format = hourNum === 12 ? 0 : hourNum
          } else {
            hour24Format = hourNum === 12 ? 12 : hourNum + 12
          }
        } else {
          hour24Format = parseInt(hourKey)
        }

        const hourString = `${hour24Format}:00`
        const hourlyData = rawData[selectedDate][hourString]

        if (hourlyData) {
          for (const [appKey, appData] of Object.entries(hourlyData)) {
            const appName = appData.domain || appData.description || appKey
            const existingApp = appUsageMap.get(appName)

            if (existingApp) {
              existingApp.timeSpentSeconds += Math.floor(appData.time / 1000)
            } else {
              appUsageMap.set(appName, {
                name: appName,
                key: appKey,
                category: appData.category,
                domain: appData.domain,
                description: appData.description,
                timeSpentSeconds: Math.floor(appData.time / 1000),
                productivity: getProductivity(appData.category)
              })
            }
          }
        }
      }
    } else if (zoomLevel === 'week') {
      // For week view, extract apps from specific days
      const selectedDays = chartData.slice(startIndex, endIndex + 1)
      const dateObj = new Date(selectedDate)
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

      for (const dayData of selectedDays) {
        const dayIndex = dayNames.indexOf(dayData.day)
        if (dayIndex === -1) continue

        const currentDate = new Date(dateObj)
        currentDate.setDate(dateObj.getDate() - dateObj.getDay() + dayIndex)
        const formattedDate = currentDate.toISOString().split('T')[0]

        if (rawData[formattedDate] && rawData[formattedDate].apps) {
          for (const [appKey, appData] of Object.entries(rawData[formattedDate].apps)) {
            const appName = appData.domain || appData.description || appKey
            const existingApp = appUsageMap.get(appName)

            if (existingApp) {
              existingApp.timeSpentSeconds += Math.floor(appData.time / 1000)
            } else {
              appUsageMap.set(appName, {
                name: appName,
                key: appKey,
                category: appData.category,
                domain: appData.domain,
                description: appData.description,
                timeSpentSeconds: Math.floor(appData.time / 1000),
                productivity: getProductivity(appData.category)
              })
            }
          }
        }
      }
    } else if (zoomLevel === 'month') {
      // For month view, extract apps from specific days
      const selectedDays = chartData.slice(startIndex, endIndex + 1)
      const dateObj = new Date(selectedDate)
      const year = dateObj.getFullYear()
      const month = dateObj.getMonth()

      for (const dayData of selectedDays) {
        const dayNum = parseInt(dayData.day)
        if (isNaN(dayNum)) continue

        const currentDate = new Date(year, month, dayNum)
        const formattedDate = currentDate.toISOString().split('T')[0]

        if (rawData[formattedDate] && rawData[formattedDate].apps) {
          for (const [appKey, appData] of Object.entries(rawData[formattedDate].apps)) {
            const appName = appData.domain || appData.description || appKey
            const existingApp = appUsageMap.get(appName)

            if (existingApp) {
              existingApp.timeSpentSeconds += Math.floor(appData.time / 1000)
            } else {
              appUsageMap.set(appName, {
                name: appName,
                key: appKey,
                category: appData.category,
                domain: appData.domain,
                description: appData.description,
                timeSpentSeconds: Math.floor(appData.time / 1000),
                productivity: getProductivity(appData.category)
              })
            }
          }
        }
      }
    }

    // Convert to array and sort by time spent
    const result = Array.from(appUsageMap.values())
      .filter((app) => app.timeSpentSeconds > 0)
      .sort((a, b) => b.timeSpentSeconds - a.timeSpentSeconds)

    console.log('Extracted apps for selected range:', result)
    return result
  } catch (error) {
    console.error('Error extracting apps for selected range:', error)
    return []
  }
}
