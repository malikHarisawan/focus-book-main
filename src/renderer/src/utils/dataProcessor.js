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
let modeColorMap = {} // mode name -> hex color
let modeIconMap = {} // mode name -> lucide icon name
let modeList = [] // [{ name, rollup, color, icon }, ...]

// Sensible defaults when the DB has no color/icon for a category, or is offline.
const DEFAULT_CATEGORY_COLOR = '#7a7a7a'
const DEFAULT_CATEGORY_ICON = 'Package'

// Fallbacks so the mode seam degrades gracefully when the DB is unreachable. These
// mirror the schema seed (modes table + categories.default_mode) so behaviour is
// identical offline. Break is the safe default mode (rolls up to neutral).
const DEFAULT_MODE = 'Break'
const DEFAULT_MODE_ROLLUP = 'neutral'
const FALLBACK_MODE_ROLLUP = {
  'Deep work': 'productive',
  Creative: 'productive',
  Collaboration: 'productive',
  Break: 'neutral',
  Distraction: 'distracted'
}
const FALLBACK_MODE_COLOR = {
  'Deep work': '#00d8ff',
  Creative: '#a855f7',
  Collaboration: '#5ac26d',
  Break: '#f59e0b',
  Distraction: '#ff6384'
}
const FALLBACK_MODE_ICON = {
  'Deep work': 'Brain',
  Creative: 'Palette',
  Collaboration: 'Users',
  Break: 'Coffee',
  Distraction: 'AlertTriangle'
}
const FALLBACK_CATEGORY_MODE = {
  Code: 'Deep work',
  Browsing: 'Deep work',
  Communication: 'Collaboration',
  Utilities: 'Break',
  Entertainment: 'Distraction',
  'Social Media': 'Distraction',
  Miscellaneous: 'Break'
}

// Function to load category metadata from main process
async function loadCategoryProductivityMapping() {
  try {
    // Prefer the rich metadata source (name, type, color, icon).
    let cats = []
    if (window.activeWindow?.loadAllCategories) {
      cats = await window.activeWindow.loadAllCategories()
    }

    if (Array.isArray(cats) && cats.length > 0) {
      const pMap = {}
      const cMap = {}
      const iMap = {}
      const catModeMap = {}
      cats.forEach((c) => {
        if (!c || !c.name) return
        // Store productive/distracted; neutral is the default so we can omit it.
        if (c.type === 'productive' || c.type === 'distracted') pMap[c.name] = c.type
        if (c.color) cMap[c.name] = c.color
        if (c.icon) iMap[c.name] = c.icon
        // Level-2 default mode for this category (may be absent on old rows).
        if (c.default_mode) catModeMap[c.name] = c.default_mode
      })
      categoryProductivityMap = pMap
      categoryColorMap = cMap
      categoryIconMap = iMap
      categoryModeMap = catModeMap
      categoryList = cats
      console.log('Category metadata loaded:', categoryList.length, 'categories')

      // Load the work-mode (Level 2) metadata alongside categories. Additive: on
      // failure the getMode* fallbacks kick in, so the verdict path is unaffected.
      await loadModeMetadata()
      return
    }

    // Fallback: the older [productive[], distracted[]] shape (no color/icon).
    const categories = await window.activeWindow.loadCategories()
    if (Array.isArray(categories)) {
      const [productive = [], distracted = []] = categories
      const map = {}
      productive.forEach((name) => {
        map[name] = 'productive'
      })
      distracted.forEach((name) => {
        map[name] = 'distracted'
      })
      categoryProductivityMap = map
    }
  } catch (error) {
    console.error('Error loading category metadata:', error)
  }
}

// Load the work-mode (Level 2) metadata: the modes table (name/rollup/color/icon)
// and the category -> default_mode map. Populates the module-level mode caches used
// by getMode/getModeRollup/getModeColor/getModeIcon. Never throws — leaves the
// caches empty on failure so the getMode* fallbacks take over.
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
      const mcMap = {}
      const miMap = {}
      modes.forEach((m) => {
        if (!m || !m.name) return
        if (m.rollup) rMap[m.name] = m.rollup
        if (m.color) mcMap[m.name] = m.color
        if (m.icon) miMap[m.name] = m.icon
      })
      modeRollupMap = rMap
      modeColorMap = mcMap
      modeIconMap = miMap
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

// Map a category to its display productivity level.
// Canonical labels: 'Productive' | 'Neutral' | 'Distracting'. Exported so all
// components share this one mapping instead of hardcoding their own.
export const getProductivity = (category) => {
  switch (categoryProductivityMap[category]) {
    case 'productive':
      return 'Productive'
    case 'distracted':
      return 'Distracting'
    default:
      return 'Neutral'
  }
}

// Export getProductivityType for external use — returns the raw DB type
// ('productive' | 'distracted' | 'neutral').
export const getProductivityType = (category) => {
  return categoryProductivityMap[category] || 'neutral'
}

// --- Work-mode (Level 2) seam ---
// These are ADDITIVE lookups that sit beside the verdict seam above. In Phase 1
// the mode of an app is derived from its category's default_mode; Phase 2 will
// pass a richer signature through the scorer, but the getMode* API stays the same.

// Resolve the work-mode for a category. Falls back to the DB-less default map and
// finally to Break (a safe neutral) so this never returns undefined.
export const getMode = (category) => {
  return categoryModeMap[category] || FALLBACK_CATEGORY_MODE[category] || DEFAULT_MODE
}

// Roll a mode up to its Level-1 verdict ('productive' | 'distracted' | 'neutral').
// This is the bridge that keeps the AreaChart's bands equal to the sum of their
// modes — always drive band membership through this, never a hardcoded map.
export const getModeRollup = (mode) => {
  return modeRollupMap[mode] || FALLBACK_MODE_ROLLUP[mode] || DEFAULT_MODE_ROLLUP
}

// Convenience: category -> verdict via its mode. Equivalent to the category's own
// type for the built-in seed, but lets mode overrides (Phase 2+) flow into the
// verdict without a second mapping.
export const getModeRollupForCategory = (category) => {
  return getModeRollup(getMode(category))
}

// Mode presentation for the new donut/drill-down. DB-driven with seed fallbacks.
export const getModeColor = (mode) => {
  return modeColorMap[mode] || FALLBACK_MODE_COLOR[mode] || DEFAULT_CATEGORY_COLOR
}

export const getModeIcon = (mode) => {
  return modeIconMap[mode] || FALLBACK_MODE_ICON[mode] || DEFAULT_CATEGORY_ICON
}

// The full list of modes [{ name, rollup, color, icon }] for legends/menus. Falls
// back to the seed set (in canonical order) when the DB hasn't loaded yet.
export const getModeList = () => {
  if (Array.isArray(modeList) && modeList.length > 0) return modeList
  return ['Deep work', 'Creative', 'Collaboration', 'Break', 'Distraction'].map((name) => ({
    name,
    rollup: FALLBACK_MODE_ROLLUP[name],
    color: FALLBACK_MODE_COLOR[name],
    icon: FALLBACK_MODE_ICON[name]
  }))
}

// Extract domain name from URL or app identifier
export const extractDomainName = (domain, fallbackName = '') => {
  if (!domain) return fallbackName

  try {
    // Handle special browser protocols
    if (domain.startsWith('chrome://') || domain.startsWith('edge://') || domain.startsWith('brave://')) {
      return domain.split('://')[1].split('/')[0] || domain
    }

    // Remove protocol
    let d = domain.replace(/^https?:\/\//i, '').replace(/^ftp:\/\//i, '')

    // Remove www prefix
    d = d.replace(/^www\./i, '')

    // Remove path, query, and hash
    d = d.split('/')[0].split('?')[0].split('#')[0]

    // Remove port if present
    d = d.split(':')[0]

    return d || fallbackName
  } catch (e) {
    return fallbackName
  }
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
      // Level-2 work-mode: prefer the stored per-row mode, else derive from category
      // so old/unlabelled rows still show a sensible mode. Keep the first non-empty.
      mode: value.mode || appMap.get(name)?.mode || getMode(value.category),
      domain: value.domain || appMap.get(name)?.domain || '',
      description: value.description || appMap.get(name)?.description || '',
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
      mode: app.mode || getMode(app.category),
      domain: app.domain || '',
      description: app.description || '',
      timeSpent: formatAppsTime(Math.floor(app.timeSpentSeconds / 1000)),
      timeSpentSeconds: Math.floor(app.timeSpentSeconds / 1000),
      productivity: getProductivity(app.category),
      trend: 'up' // static for now; could be dynamic with historical data
    })
  }

  return result
}

export const processUsageChartData = (jsonData, date, viewType = 'day') => {
  if (viewType === 'day') {
    if (!jsonData || !jsonData[date]) {
      return []
    }

    console.log('data in the utility function ', jsonData)
    const hourlyData = []

    // Cover the full 24-hour day (12AM–11PM) so activity outside the old
    // 9AM–9PM window is no longer silently dropped.
    for (let i = 0; i < 24; i++) {
      hourlyData.push({
        name: i === 0 ? '12AM' : i === 12 ? '12PM' : i < 12 ? `${i}AM` : `${i - 12}PM`,
        Code: 0,
        Browsing: 0,
        Communication: 0,
        Utilities: 0,
        Entertainment: 0,
        Miscellaneous: 0
      })
    }

    for (const [hourKey, hourData] of Object.entries(jsonData[date])) {
      if (hourKey === 'apps') continue

      const hour = parseInt(hourKey.split(':')[0])
      if (isNaN(hour) || hour < 0 || hour >= 24) continue

      const index = hour
      if (index < 0 || index >= hourlyData.length) continue

      for (const app of Object.values(hourData)) {
        if (app.category) {
          if (hourlyData[index][app.category] !== undefined) {
            hourlyData[index][app.category] += app.time / 1000
          } else {
            hourlyData[index][app.category] = app.time / 1000
          }
        }
      }
    }

    return hourlyData
  } else {
    // if (!jsonData || !jsonData[date]) {
    //   return [];
    // }

    const weekData = []
    const dateObj = new Date(date)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(dateObj)
      currentDate.setDate(dateObj.getDate() - dateObj.getDay() + i)

      const formattedDate = currentDate.toISOString().split('T')[0]

      const dayData = {
        name: dayNames[i],
        Code: 0,
        Browsing: 0,
        Communication: 0,
        Utilities: 0,
        Entertainment: 0,
        Miscellaneous: 0
      }

      if (jsonData[formattedDate] && jsonData[formattedDate].apps) {
        for (const app of Object.values(jsonData[formattedDate].apps)) {
          if (app.category) {
            if (dayData[app.category] !== undefined) {
              dayData[app.category] += app.time / 1000
            } else {
              dayData[app.category] = app.time / 1000
            }
          }
        }
      }

      weekData.push(dayData)
    }
    console.log('week', weekData)
    return weekData
  }
}

// Add an app's time to the correct productivity bucket of a chart data point.
// Buckets mirror the three DB-driven labels so the chart, summary cards, and
// tooltip all agree: productive / neutral / distracting. It ALSO accrues the
// Level-2 work-mode split into `bucket.modes`, so every chart point carries a mode
// breakdown for the tooltip drill-down — no change needed in the per-view builders.
const accumulateProductivity = (bucket, app) => {
  if (!app.category || !app.time) return

  const seconds = app.time / 1000
  switch (getProductivity(app.category)) {
    case 'Productive':
      bucket.productive += seconds
      break
    case 'Distracting':
      bucket.distracting += seconds
      break
    default:
      bucket.neutral += seconds
  }

  // Level-2 mode accrual. Prefer the per-app stored mode; fall back to the
  // category default so old/unlabelled data still splits sensibly.
  if (bucket.modes) {
    const mode = app.mode || getMode(app.category)
    if (bucket.modes[mode] === undefined) bucket.modes[mode] = 0
    bucket.modes[mode] += seconds
  }
}

const emptyPoint = (day) => ({
  day,
  productive: 0,
  neutral: 0,
  distracting: 0,
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

// Aggregate productive / neutral / distracting / total SECONDS across the date
// window for a view level. Used by the dashboard summary cards so they reflect
// the current day/week/month view instead of always showing the selected day.
export const getProductivityTotals = (jsonData, date, viewType = 'day') => {
  const totals = { productive: 0, neutral: 0, distracting: 0 }
  if (jsonData) {
    for (const d of getDatesForView(date, viewType)) {
      const apps = jsonData[d]?.apps
      if (!apps) continue
      for (const app of Object.values(apps)) {
        accumulateProductivity(totals, app)
      }
    }
  }
  const productiveSeconds = Math.floor(totals.productive)
  const neutralSeconds = Math.floor(totals.neutral)
  const distractingSeconds = Math.floor(totals.distracting)
  return {
    productiveSeconds,
    neutralSeconds,
    distractingSeconds,
    totalSeconds: productiveSeconds + neutralSeconds + distractingSeconds
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

  // Floor each mode and roll it up so the donut segments and the productive/
  // neutral/distracting card totals reconcile to the same numbers.
  const rollup = { productive: 0, neutral: 0, distracting: 0 }
  let totalSeconds = 0
  for (const [mode, secs] of Object.entries(byMode)) {
    const floored = Math.floor(secs)
    byMode[mode] = floored
    totalSeconds += floored
    const verdict = getModeRollup(mode)
    if (verdict === 'productive') rollup.productive += floored
    else if (verdict === 'distracted') rollup.distracting += floored
    else rollup.neutral += floored
  }

  return { byMode, rollup, totalSeconds }
}

export const processProductiveChartData = (jsonData, date, viewType = 'day') => {
  if (viewType === 'hour') {
    if (!jsonData || !jsonData[date]) {
      return []
    }
    const hourlyData = []

    for (let i = 9; i <= 21; i++) {
      hourlyData.push(emptyPoint(i === 12 ? '12PM' : i < 12 ? `${i}AM` : `${i - 12}PM`))
    }

    for (const [hourKey, hourData] of Object.entries(jsonData[date])) {
      if (hourKey === 'apps') continue

      const hour = parseInt(hourKey.split(':')[0])
      if (isNaN(hour) || hour < 0 || hour > 23) continue

      const index = hour - 9
      if (index < 0 || index >= hourlyData.length) continue

      for (const app of Object.values(hourData)) {
        accumulateProductivity(hourlyData[index], app)
      }
    }

    return hourlyData
  } else if (viewType === 'day') {
    if (!jsonData || !jsonData[date]) {
      return []
    }
    const fullDayData = []

    for (let i = 0; i < 24; i++) {
      fullDayData.push(
        emptyPoint(i === 0 ? '12AM' : i === 12 ? '12PM' : i < 12 ? `${i}AM` : `${i - 12}PM`)
      )
    }

    for (const [hourKey, hourData] of Object.entries(jsonData[date])) {
      if (hourKey === 'apps') continue

      const hour = parseInt(hourKey.split(':')[0])
      if (isNaN(hour) || hour < 0 || hour > 23) continue

      for (const app of Object.values(hourData)) {
        accumulateProductivity(fullDayData[hour], app)
      }
    }

    return fullDayData
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

    return weekData
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

    return monthData
  }
}

/**
 * Custom date-range chart series: one point per day between startDate and
 * endDate (inclusive), each holding that day's productive/neutral/distracting
 * seconds. Same point shape as processProductiveChartData so it drops straight
 * into ProductiveAreaChart. Dates are YYYY-MM-DD; order is auto-corrected if
 * start is after end. Capped at 366 days to keep the axis readable.
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
    out.push(point)

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

const isProductiveCategory = (category) => {
  return categoryProductivityMap[category] === 'productive'
}

export const getTotalFocusTime = (jsonData, date, processedChartData, view) => {
  let totalTime = 0

  if (view === 'day') {
    if (!jsonData || !jsonData[date] || !jsonData[date].apps) {
      return '0'
    }
    for (const app of Object.values(jsonData[date].apps)) {
      if (isProductiveCategory(app.category)) {
        totalTime += app.time
      }
    }
    return formatTime(totalTime)
  } else {
    for (const day of processedChartData) {
      for (const key in day) {
        if (key !== 'name') {
          console.log(day[key])
          totalTime += day[key]
        }
      }
    }
    const average = formatTime((totalTime * 1000) / processedChartData.length)
    console.log('average', processedChartData.length)
    return average
  }
}

export const getTotalScreenTime = (jsonData, date, processedChartData, view) => {
  let totalTime = 0

  if (view === 'day') {
    if (!jsonData || !jsonData[date] || !jsonData[date].apps) {
      return '0h 0m'
    }
    for (const app of Object.values(jsonData[date].apps)) {
      totalTime += app.time
    }
    console.log('totaltime ', formatTime(totalTime))
    return formatTime(totalTime)
  } else {
    for (const day of processedChartData) {
      for (const key in day) {
        if (key !== 'name') {
          console.log(day[key])
          totalTime += day[key]
        }
      }
    }
    const average = formatTime((totalTime * 1000) / processedChartData.length)
    console.log('average', processedChartData.length)
    return average
  }
}

export const getCategoryBreakdown = (jsonData, date) => {
  if (!jsonData || !jsonData[date] || !jsonData[date].apps) {
    return []
  }

  const categories = {
    Code: { time: 0, color: 'text-green-400' },
    Browsing: { time: 0, color: 'text-purple-400' },
    Communication: { time: 0, color: 'text-blue-500' },
    Utilities: { time: 0, color: 'text-sky-400' },
    Entertainment: { time: 0, color: 'text-rose-400' },
    Miscellaneous: { time: 0, color: 'text-gray-500' }
  }

  for (const app of Object.values(jsonData[date].apps)) {
    if (app.category && categories[app.category]) {
      categories[app.category].time += app.time
    }
  }

  return Object.entries(categories)
    .filter(([_, data]) => data.time > 60000)
    .sort((a, b) => b[1].time - a[1].time)
    .map(([name, data]) => ({
      name: name,
      time: formatTime(data.time),
      color: data.color
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
