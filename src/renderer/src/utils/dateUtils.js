// Canonical LOCAL-date helpers for the renderer.
//
// Activity spans are written under LOCAL calendar dates (see toLocalDateStr in
// dataProcessor.js / timelineUtils.js, which use getFullYear/getMonth/getDate).
// "Today" must therefore also be computed in LOCAL time. Using
// `new Date().toISOString().split('T')[0]` computes the date in UTC, which for any
// timezone behind UTC rolls the day forward in the evening — so the dashboard would
// select a date with no data. These helpers are the single source of truth for
// "what local day is it" and must be used instead of the toISOString() idiom.

// Format a Date as a LOCAL YYYY-MM-DD string.
export function fmtLocal(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// The current local calendar day as YYYY-MM-DD.
export function todayLocal() {
  return fmtLocal(new Date())
}

// Parse a YYYY-MM-DD string into a Date at LOCAL midnight. `new Date('2026-07-22')`
// parses as UTC midnight, so reading it back with getDate() in a timezone behind UTC
// yields the previous day. Constructing from (year, monthIndex, day) anchors it to
// local midnight, keeping the parse/format round-trip stable across timezones.
export function parseLocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}
