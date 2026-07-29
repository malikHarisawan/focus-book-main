/**
 * presenceUsageAdapter tests — labelled presence -> appUsageData shape, and the merge.
 *   node src/main/classification/presenceUsageAdapter.test.js
 *
 * Proves the confirmed crediting rules:
 *   - only LABELLED absences are emitted (unanswered away-time is dropped),
 *   - working/meeting -> productive, break -> neutral,
 *   - daily and hourly buckets agree, and the merge sums beside real app rows.
 */

const {
  presenceToAppUsageData,
  mergePresenceIntoUsage,
  LABEL_PRODUCTIVITY
} = require('./presenceUsageAdapter')

let passed = 0
let failed = 0
function ok(cond, label) {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.error(`  ✗ ${label}`) }
}

const MIN = 60 * 1000
// Use a fixed LOCAL wall-clock so date/hour bucketing is deterministic regardless of TZ.
const base = new Date(2026, 6, 16, 10, 0, 0) // 2026-07-16 10:00 local
const T0 = base.getTime()
const iso = (ms) => new Date(ms).toISOString()

// Build a resolved-presence row the way PresenceService.getResolvedPresence would.
function span(type, startMs, durMs, userLabel = null) {
  return { id: startMs, type, start: iso(startMs), end: iso(startMs + durMs), durationMs: durMs, userLabel }
}

function main() {
  // --- label → productivity mapping ---
  {
    ok(LABEL_PRODUCTIVITY.working === 'productive', 'working → productive')
    ok(LABEL_PRODUCTIVITY.meeting === 'productive', 'meeting → productive')
    ok(LABEL_PRODUCTIVITY.break === 'neutral', 'break → neutral')
  }

  // --- only labelled absences are emitted ---
  {
    const usage = presenceToAppUsageData([
      span('idle', T0, 30 * MIN, null),               // unlabelled → dropped
      span('active', T0 + 30 * MIN, 10 * MIN, null),  // active → dropped
      span('locked', T0 + 40 * MIN, 40 * MIN, 'working') // labelled → kept
    ])
    const day = usage['2026-07-16']
    const keys = Object.keys(day.apps)
    ok(keys.length === 1, 'only the one labelled absence becomes a row')
    ok(keys[0] === 'Working (away)', 'labelled row uses the friendly away key')
    ok(day.apps['Working (away)'].productivity === 'productive', 'working row is productive')
    ok(day.apps['Working (away)'].time === 40 * MIN, 'row carries the absence duration')
    ok(day.apps['Working (away)'].isAway === true, 'row is flagged isAway')
  }

  // --- break → neutral, meeting → productive; daily == hourly ---
  {
    const usage = presenceToAppUsageData([
      span('idle', T0, 20 * MIN, 'break'),
      span('locked', T0 + 20 * MIN, 25 * MIN, 'meeting')
    ])
    const day = usage['2026-07-16']
    ok(day.apps['Break (away)'].productivity === 'neutral', 'break row is neutral')
    ok(day.apps['Meeting (away)'].productivity === 'productive', 'meeting row is productive')
    const dailyTotal = Object.values(day.apps).reduce((a, e) => a + e.time, 0)
    let hourlyTotal = 0
    for (const k of Object.keys(day)) {
      if (k === 'apps') continue
      hourlyTotal += Object.values(day[k]).reduce((a, e) => a + e.time, 0)
    }
    ok(dailyTotal === hourlyTotal, 'daily total === sum of hourly totals')
    ok(dailyTotal === 45 * MIN, 'total credited = 20 + 25 min')
  }

  // --- unknown/free-text label defaults to neutral (never inflates productive) ---
  {
    const usage = presenceToAppUsageData([span('idle', T0, 15 * MIN, 'lunchroom chat')])
    const row = Object.values(usage['2026-07-16'].apps)[0]
    ok(row.productivity === 'neutral', 'unrecognised label → neutral (safe default)')
  }

  // --- merge sums beside real app rows, keeps away rows separate ---
  {
    const usage = {
      '2026-07-16': {
        apps: { 'Visual Studio Code': { time: 60 * MIN, category: 'Coding', productivity: 'productive', timestamps: [] } },
        '10:00': { 'Visual Studio Code': { time: 60 * MIN, category: 'Coding', productivity: 'productive', timestamps: [] } }
      }
    }
    const presence = presenceToAppUsageData([span('locked', T0, 40 * MIN, 'working')])
    mergePresenceIntoUsage(usage, presence)
    const apps = usage['2026-07-16'].apps
    ok(apps['Visual Studio Code'].time === 60 * MIN, 'real app row untouched by merge')
    ok(apps['Working (away)'].time === 40 * MIN, 'away row added alongside')
    ok(Object.keys(apps).length === 2, 'no key collision — separate rows')
  }

  // --- merge is defensive: same away key summed rather than lost ---
  {
    const usage = presenceToAppUsageData([span('idle', T0, 10 * MIN, 'break')])
    const more = presenceToAppUsageData([span('idle', T0 + 30 * MIN, 5 * MIN, 'break')])
    mergePresenceIntoUsage(usage, more)
    ok(usage['2026-07-16'].apps['Break (away)'].time === 15 * MIN, 'duplicate away key sums to 15 min')
  }

  // --- empty / non-array input is safe ---
  {
    ok(Object.keys(presenceToAppUsageData(null)).length === 0, 'null input → empty tree')
    ok(Object.keys(presenceToAppUsageData([])).length === 0, 'empty input → empty tree')
    const u = { '2026-07-16': { apps: {} } }
    ok(mergePresenceIntoUsage(u, null) === u, 'merge with null presence returns usage unchanged')
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main()
