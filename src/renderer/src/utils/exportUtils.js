// Serializers for exporting the user's app-usage history.
//
// Input is the nested object returned by getAllAggregatedData():
//   { "2026-07-06": { apps: { "<name>": {time,category,description,domain} },
//                     "09:00": { "<name>": {...} }, ... }, ... }
// where `apps` is the daily aggregate (hour = null) and "HH:00" keys are hourly.
//
// For export we use the HOURLY rows (not the daily `apps` aggregate) so each row
// has a real hour and we don't double-count. Times are stored in ms; we also emit
// a human-friendly minutes column.

const HOUR_KEY_RE = /^\d{1,2}:00$/

// Flatten the nested structure into an array of flat rows for CSV/tabular use.
export function flattenUsage(data) {
  const rows = []
  if (!data || typeof data !== 'object') return rows

  for (const [date, dayData] of Object.entries(data)) {
    if (!dayData || typeof dayData !== 'object') continue
    for (const [key, bucket] of Object.entries(dayData)) {
      // Only the hourly buckets; skip the 'apps' daily aggregate to avoid
      // double-counting the same time.
      if (!HOUR_KEY_RE.test(key)) continue
      const hour = parseInt(key.split(':')[0], 10)
      for (const [appName, app] of Object.entries(bucket || {})) {
        if (!app) continue
        const ms = app.time || 0
        rows.push({
          date,
          hour,
          app: appName,
          category: app.category || '',
          domain: app.domain || '',
          description: app.description || '',
          time_ms: ms,
          minutes: Math.round((ms / 60000) * 10) / 10
        })
      }
    }
  }

  // Stable, human-friendly ordering: newest date first, then hour, then app.
  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    if (a.hour !== b.hour) return a.hour - b.hour
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
    'Hour',
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
      [r.date, r.hour, r.app, r.category, r.domain, r.description, r.time_ms, r.minutes]
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
