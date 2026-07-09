// Serializers for exporting the user's app-usage history.
//
// Input is the nested object returned by getAllAggregatedData():
//   { "2026-07-06": { apps: { "<name>": {time,category,description,domain} },
//                     "09:00": { "<name>": {...} }, ... }, ... }
// where `apps` is the daily aggregate (hour = null) and "HH:00" keys are hourly.
//
// Export mirrors the dashboard's Apps table: ONE row per app per day, using the
// pre-aggregated daily `apps` bucket. When a date is missing that bucket we fall
// back to summing the hourly buckets ourselves. Times are stored in ms; we also
// emit a human-friendly minutes column.

const HOUR_KEY_RE = /^\d{1,2}:00$/

// Sum the hourly buckets for a date into a per-app daily total. Used only as a
// fallback when the pre-aggregated `apps` bucket is absent.
function aggregateHourly(dayData) {
  const byApp = {}
  for (const [key, bucket] of Object.entries(dayData)) {
    if (!HOUR_KEY_RE.test(key)) continue
    for (const [appName, app] of Object.entries(bucket || {})) {
      if (!app) continue
      if (byApp[appName]) {
        byApp[appName].time += app.time || 0
      } else {
        byApp[appName] = {
          time: app.time || 0,
          category: app.category || '',
          domain: app.domain || '',
          description: app.description || ''
        }
      }
    }
  }
  return byApp
}

// Flatten the nested structure into an array of flat rows for CSV/tabular use.
export function flattenUsage(data) {
  const rows = []
  if (!data || typeof data !== 'object') return rows

  for (const [date, dayData] of Object.entries(data)) {
    if (!dayData || typeof dayData !== 'object') continue

    // Prefer the daily aggregate; fall back to summing hourly if it's missing.
    const apps =
      dayData.apps && Object.keys(dayData.apps).length > 0
        ? dayData.apps
        : aggregateHourly(dayData)

    for (const [appName, app] of Object.entries(apps)) {
      if (!app) continue
      const ms = app.time || 0
      rows.push({
        date,
        app: appName,
        category: app.category || '',
        domain: app.domain || '',
        description: app.description || '',
        time_ms: ms,
        minutes: Math.round((ms / 60000) * 10) / 10
      })
    }
  }

  // Stable, human-friendly ordering: newest date first, then app.
  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return a.app.localeCompare(b.app)
  })
  return rows
}

// Escape a single CSV field per RFC 4180 (quote if it contains comma/quote/newline).
function csvField(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function toCSV(data) {
  const rows = flattenUsage(data)
  const headers = [
    'Date',
    'Application',
    'Category',
    'Domain',
    'Description',
    'Time (ms)',
    'Minutes'
  ]
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push(
      [r.date, r.app, r.category, r.domain, r.description, r.time_ms, r.minutes]
        .map(csvField)
        .join(',')
    )
  }
  // CRLF line endings so the file opens cleanly in Excel.
  return lines.join('\r\n')
}

export function toJSON(data, exportedAt) {
  // Full-fidelity: keep the nested structure, plus a flat rows array for
  // convenience, wrapped with a small metadata header.
  return JSON.stringify(
    {
      exportedAt: exportedAt || null,
      source: 'FocusBook',
      schemaVersion: 1,
      usageByDate: data || {},
      rows: flattenUsage(data)
    },
    null,
    2
  )
}
