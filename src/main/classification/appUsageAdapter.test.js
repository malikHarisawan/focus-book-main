/**
 * appUsageAdapter tests — resolved spans -> legacy appUsageData shape.
 *   node src/main/classification/appUsageAdapter.test.js
 * Pure, no DB. Verifies the renderer contract: date -> apps/'HH:00' -> appKey ->
 * {time, category, domain, description, timestamps}, correct display keys, and that
 * uncategorized spans surface (time is never dropped).
 */

const { spansToAppUsageData, displayKeyFor } = require('./appUsageAdapter')

let passed = 0, failed = 0
const ok = (c, m) => { c ? (passed++, console.log('  ✓', m)) : (failed++, console.error('  ✗', m)) }

// Build a resolved-span the way SpanService.getResolvedSpans would. start/end are
// optional so display-key-only cases don't need timestamps.
function span(o) {
  const hasTime = typeof o.start === 'number' && typeof o.end === 'number'
  return {
    key: { source: o.source, app: o.app, domain: o.domain || null, path: o.path || null, title: o.title || null },
    appName: o.appName || o.app,
    start: hasTime ? new Date(o.start).toISOString() : null,
    end: hasTime ? new Date(o.end).toISOString() : null,
    durationMs: hasTime ? o.end - o.start : 0,
    category: o.category ?? null,
    productivity: o.productivity || 'unrated',
    winning_rule: o.category ? { id: 1 } : null
  }
}

console.log('\ndisplay keys:')
{
  ok(displayKeyFor(span({ source: 'app', app: 'code.exe', appName: 'Visual Studio Code' })) === 'Visual Studio Code', 'app span -> friendly name')
  ok(displayKeyFor(span({ source: 'app', app: 'weird.exe' })) === 'weird.exe', 'app span w/o friendly -> raw exe')
  ok(displayKeyFor(span({ source: 'web', app: 'chrome.exe', domain: 'github.com' })) === 'github.com', 'web span -> domain')
}

console.log('\nshape + aggregation:')
{
  const base = Date.UTC(2026, 2, 10, 14, 0, 0) // local date/hour derived in adapter
  const spans = [
    span({ source: 'app', app: 'code.exe', appName: 'Visual Studio Code', category: 'Coding', productivity: 'productive', start: base, end: base + 600000 }),
    span({ source: 'app', app: 'code.exe', appName: 'Visual Studio Code', category: 'Coding', productivity: 'productive', start: base + 600000, end: base + 900000 }),
    span({ source: 'web', app: 'chrome.exe', domain: 'reddit.com', category: 'Social', productivity: 'distracting', start: base, end: base + 300000 })
  ]
  const data = spansToAppUsageData(spans)
  const dates = Object.keys(data)
  ok(dates.length === 1, 'one date bucket produced')
  const day = data[dates[0]]
  ok(!!day.apps['Visual Studio Code'], 'app grouped under friendly name')
  ok(day.apps['Visual Studio Code'].time === 900000, 'two code spans summed (15 min)')
  ok(day.apps['Visual Studio Code'].category === 'Coding', 'category attached from resolver')
  ok(day.apps['Visual Studio Code'].productivity === 'productive', 'resolver productivity carried onto the row')
  ok(day.apps['Visual Studio Code'].exe === 'code.exe', 'raw exe carried onto the row (for corrections)')
  ok(!!day.apps['reddit.com'], 'web grouped under domain')
  ok(day.apps['reddit.com'].category === 'Social', 'web category attached')
  ok(day.apps['reddit.com'].productivity === 'distracting', 'distracting productivity carried through')
  // hourly bucket exists and mirrors the daily entry
  const hourKey = Object.keys(day).find((k) => /^\d{2}:00$/.test(k))
  ok(!!hourKey && !!day[hourKey]['Visual Studio Code'], 'hourly bucket populated')
  ok(day[hourKey]['Visual Studio Code'].time === 900000, 'hourly time aggregated')
}

console.log('\nuncategorized time is surfaced, not dropped:')
{
  const base = Date.UTC(2026, 2, 11, 9, 0, 0)
  const data = spansToAppUsageData([
    span({ source: 'app', app: 'mystery.exe', category: null, start: base, end: base + 120000 })
  ])
  const day = data[Object.keys(data)[0]]
  ok(!!day.apps['mystery.exe'], 'unmatched app still appears')
  ok(day.apps['mystery.exe'].category === 'Uncategorized', 'null category -> Uncategorized (time preserved)')
  ok(day.apps['mystery.exe'].time === 120000, 'uncategorized time counted')
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
