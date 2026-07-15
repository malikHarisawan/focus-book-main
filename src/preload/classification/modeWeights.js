/**
 * Work-Mode Scorer — Tunable Weight Configuration
 *
 * This is the ONLY place tuning happens. `modeScorer.js` reads these values and
 * contains no magic numbers of its own, so behaviour can be adjusted without
 * touching logic. Pure data — no imports, no Electron, safe to require from both
 * the preload (tracking loop) and main, and to unit-test in plain Node.
 *
 * The scorer accrues a weighted score per mode from several independent signals
 * and takes the argmax. See modeScorer.js for how each signal is applied.
 *
 * The five modes (Level 2) and their Level-1 rollup (must match the `modes` table
 * seeded in schema.sql):
 *   Deep work     -> productive
 *   Creative      -> productive
 *   Collaboration -> productive
 *   Break         -> neutral
 *   Distraction   -> distracted
 */

const MODES = ['Deep work', 'Creative', 'Collaboration', 'Break', 'Distraction']

// Mode -> Level-1 verdict. Kept here as the offline/source-of-truth mirror of the
// modes.rollup column so the scorer can return a rollup without a DB round-trip.
const MODE_ROLLUP = {
  'Deep work': 'productive',
  Creative: 'productive',
  Collaboration: 'productive',
  Break: 'neutral',
  Distraction: 'distracted'
}

const MODE_WEIGHTS = {
  // A. Category anchor — the base pull from the existing Level-0 category. This is
  //    the floor: even with no other signal, an app lands on a sensible mode. A
  //    genuinely ambiguous category (Browsing) is deliberately weak so title/domain
  //    signals decide it.
  categoryAnchor: {
    Code: { 'Deep work': 0.5 },
    Communication: { Collaboration: 0.5 },
    'Social Media': { Distraction: 0.6 },
    Entertainment: { Distraction: 0.45, Break: 0.2 },
    Utilities: { Break: 0.25 },
    Browsing: { 'Deep work': 0.15, Distraction: 0.1 }, // weak & split — let content decide
    Miscellaneous: { Break: 0.1 }
  },

  // B. Keyword lexicon — substring signals from the window title / url / domain.
  //    Each entry adds its weight to the mode when the token appears. Tokens are
  //    matched case-insensitively against a single lowercased haystack
  //    (title + ' ' + domain + ' ' + url). Order does not matter; all matches sum.
  keywords: {
    'Deep work': {
      weight: 0.4,
      tokens: [
        'debug', 'compile', 'build', 'pull request', ' pr ', 'ticket', 'jira',
        'stack overflow', 'stackoverflow', 'documentation', ' docs', 'localhost',
        'terminal', 'refactor', 'commit', 'merge request', 'leetcode', 'algorithm'
      ]
    },
    Creative: {
      weight: 0.45,
      tokens: [
        'figma', 'canva', 'photoshop', 'illustrator', 'premiere', 'after effects',
        'blender', 'sketch', 'mockup', 'wireframe', 'design', 'davinci', 'lightroom',
        'audition', 'logic pro', 'ableton', 'fl studio', '.fig', '.psd', '.ai'
      ]
    },
    Collaboration: {
      weight: 0.45,
      tokens: [
        'meeting', 'standup', 'stand-up', 'call', 'zoom', 'google meet', ' meet',
        'teams', 'slack', 'huddle', 'email', 'inbox', 'gmail', 'outlook', 'calendar',
        'invite', 'webinar', 'conference'
      ]
    },
    Break: {
      weight: 0.35,
      tokens: [
        'spotify', 'music', 'playlist', 'podcast', 'lock screen', 'lockapp',
        'idle', 'weather', 'news break'
      ]
    },
    Distraction: {
      weight: 0.5,
      tokens: [
        'youtube', 'netflix', 'twitch', 'reddit', 'twitter', 'x.com', 'facebook',
        'instagram', 'tiktok', 'snapchat', ' feed', 'shorts', 'reels', 'meme',
        'gossip', 'shopping', 'amazon deal', 'game', 'stream'
      ]
    }
  },

  // C. Session length — a long, uninterrupted run in one app is evidence of focus;
  //    a barrage of very short hits leans distracting. Applied only when the mode
  //    is not already pinned by a strong signal (the scorer treats it as a boost).
  sessionLength: {
    longRunMs: 15 * 60 * 1000, // >= 15 min continuous -> focus boost
    deepBoost: 0.3, // added to Deep work AND Creative (whichever the anchor favours)
    shortHitMs: 60 * 1000, // <= 60s in the app...
    shortHitDistractBoost: 0.2 // ...adds a nudge toward Distraction
  },

  // D. Switch rate — churn across many apps in a short window is the signature of
  //    distracted context-switching; a calm foreground boosts deep focus.
  switchRate: {
    windowMs: 5 * 60 * 1000, // rolling window the preload counts switches over
    churnThreshold: 6, // >= this many switches in the window -> distracted
    distractBoost: 0.3,
    deepPenalty: 0.25, // subtracted from Deep work / Creative under high churn
    calmThreshold: 1, // <= this many switches -> calm
    calmDeepBoost: 0.15
  },

  // E. Time of day — off by default; when enabled, late-night nudges Break/Distraction.
  timeOfDay: {
    enabled: false,
    lateStartHour: 23,
    lateEndHour: 5,
    lateBreakBoost: 0.1,
    lateDistractBoost: 0.1
  },

  // Confidence floor: if the winning score is below this, the scorer reports low
  // confidence and the caller should fall back to the category's default_mode
  // rather than trust a weak guess.
  confidenceFloor: 0.35
}

module.exports = { MODES, MODE_ROLLUP, MODE_WEIGHTS }
