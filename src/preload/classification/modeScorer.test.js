/**
 * Lightweight assertion harness for the mode scorer. No test framework required —
 * run with `node src/preload/classification/modeScorer.test.js`. Exits non-zero on any
 * failure so it can gate a build. Each case documents WHY the expected mode is right.
 */

const { scoreSignature } = require('./modeScorer')

let passed = 0
let failed = 0

function expectMode(label, signature, expectedMode) {
  const result = scoreSignature(signature)
  const ok = result.mode === expectedMode
  if (ok) {
    passed++
    console.log(
      `  ✓ ${label}  ->  ${result.mode} (${result.confidence}${result.lowConfidence ? ', low-conf' : ''})`
    )
  } else {
    failed++
    console.error(`  ✗ ${label}`)
    console.error(`      expected: ${expectedMode}`)
    console.error(`      got:      ${result.mode} (${result.confidence})`)
    console.error(`      scores:   ${JSON.stringify(result.scores)}`)
  }
}

console.log('Mode scorer cases:\n')

// IDE, long focused run -> Deep work
expectMode(
  'VS Code, 30min run',
  { exe: 'code.exe', appName: 'Visual Studio Code', category: 'Code', title: 'index.js — focusbook', sessionLen: 30 * 60 * 1000, switchRate: 1 },
  'Deep work'
)

// Browser on Stack Overflow while debugging -> Deep work (keyword beats weak anchor)
expectMode(
  'Browser on Stack Overflow',
  { exe: 'chrome.exe', appName: 'Google Chrome', category: 'Browsing', title: 'Fixing null deref · Stack Overflow', domain: 'stackoverflow.com', sessionLen: 8 * 60 * 1000, switchRate: 2 },
  'Deep work'
)

// Figma, long run -> Creative (and the long-session boost steers to Creative, not Deep work)
expectMode(
  'Figma design session',
  { exe: 'figma.exe', appName: 'Figma', category: 'Miscellaneous', title: 'Dashboard mockup – Figma', sessionLen: 20 * 60 * 1000, switchRate: 1 },
  'Creative'
)

// Slack -> Collaboration
expectMode(
  'Slack',
  { exe: 'slack.exe', appName: 'Slack', category: 'Communication', title: 'team-standup | Slack', sessionLen: 5 * 60 * 1000, switchRate: 3 },
  'Collaboration'
)

// Zoom meeting via browser -> Collaboration (keyword)
expectMode(
  'Zoom meeting in browser',
  { exe: 'chrome.exe', appName: 'Google Chrome', category: 'Browsing', title: 'Zoom Meeting', domain: 'zoom.us', sessionLen: 25 * 60 * 1000, switchRate: 1 },
  'Collaboration'
)

// YouTube entertainment -> Distraction
expectMode(
  'YouTube',
  { exe: 'chrome.exe', appName: 'Google Chrome', category: 'Entertainment', title: 'lofi beats - YouTube', domain: 'youtube.com', sessionLen: 12 * 60 * 1000, switchRate: 2 },
  'Distraction'
)

// Twitter/X, rapid switching -> Distraction
expectMode(
  'X/Twitter with high churn',
  { exe: 'chrome.exe', appName: 'Google Chrome', category: 'Social Media', title: 'Home / X', domain: 'x.com', sessionLen: 40 * 1000, switchRate: 9 },
  'Distraction'
)

// Spotify -> Break
expectMode(
  'Spotify',
  { exe: 'spotify.exe', appName: 'Spotify', category: 'Entertainment', title: 'Spotify – Focus Playlist', sessionLen: 60 * 60 * 1000, switchRate: 0 },
  'Break'
)

// Utilities (File Explorer) -> Break
expectMode(
  'File Explorer',
  { exe: 'explorer.exe', appName: 'Windows Explorer', category: 'Utilities', title: 'Downloads', sessionLen: 30 * 1000, switchRate: 4 },
  'Break'
)

// Low-signal: unknown app, generic browser tab with no keyword -> low confidence flag set
;(function lowConfidenceCase() {
  const result = scoreSignature({
    exe: 'chrome.exe',
    appName: 'Google Chrome',
    category: 'Browsing',
    title: 'New Tab',
    sessionLen: 2 * 60 * 1000,
    switchRate: 2
  })
  const ok = result.lowConfidence === true
  if (ok) {
    passed++
    console.log(`  ✓ Generic New Tab flagged low-confidence -> ${result.mode} (${result.confidence})`)
  } else {
    failed++
    console.error(`  ✗ Generic New Tab should be low-confidence; got conf ${result.confidence}`)
  }
})()

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
