/**
 * Work-Mode Scorer (Level 2 classification)
 *
 * Pure, deterministic, dependency-free. Given a `signature` describing one tracked
 * foreground context, it accrues a weighted score for each of the five work-modes
 * and returns the argmax with a confidence and a per-mode breakdown for
 * explainability ("Deep work 0.72 — IDE anchor + long session").
 *
 * This module makes NO decision about overrides or DB rules — that layering lives
 * in the caller (preload getMode). The scorer is layer 3 of the pipeline:
 *   override -> rule.mode -> SCORER -> category default.
 *
 * Being pure means the same signature always yields the same result, so the caller
 * can cache by a signature hash and consult the scorer once per unique context.
 *
 * Signature shape (all fields optional; the scorer degrades gracefully):
 *   {
 *     exe:        'chrome.exe',
 *     appName:    'Google Chrome',
 *     category:   'Browsing',      // Level-0 category from getCategory()
 *     title:      'Fixing null deref · Stack Overflow',
 *     domain:     'stackoverflow.com',
 *     url:        'https://stackoverflow.com/questions/123',
 *     hour:       14,              // 0–23 local
 *     sessionLen: 1_920_000,       // ms continuous run in this app
 *     switchRate: 3                // app switches in the last `windowMs`
 *   }
 */

const { MODES, MODE_ROLLUP, MODE_WEIGHTS } = require('./modeWeights')

// Build the lowercased haystack the keyword lexicon matches against. Combines the
// most signal-rich text fields so a token can hit on title, domain, or url.
function buildHaystack(sig) {
  return [sig.title, sig.domain, sig.url, sig.appName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

// Add `amount` to `scores[mode]`, tracking the contributing signal in `breakdown`
// for explainability. Never lets a score go undefined.
function bump(scores, breakdown, mode, amount, reason) {
  if (!mode || amount === 0) return
  scores[mode] = (scores[mode] || 0) + amount
  if (!breakdown[mode]) breakdown[mode] = []
  breakdown[mode].push({ reason, amount: Math.round(amount * 1000) / 1000 })
}

/**
 * Score a signature into a work-mode.
 * @param {object} signature
 * @param {object} [config] override for MODE_WEIGHTS (used by tests/tuning)
 * @returns {{ mode: string, confidence: number, rollup: string, scores: object, breakdown: object, lowConfidence: boolean }}
 */
function scoreSignature(signature, config = MODE_WEIGHTS) {
  const sig = signature || {}
  const scores = {}
  const breakdown = {}

  // A. Category anchor — base pull from the Level-0 category.
  const anchor = config.categoryAnchor && config.categoryAnchor[sig.category]
  if (anchor) {
    for (const [mode, amount] of Object.entries(anchor)) {
      bump(scores, breakdown, mode, amount, `category:${sig.category}`)
    }
  }

  // B. Keyword lexicon — substring hits in title/domain/url/appName.
  const haystack = buildHaystack(sig)
  if (haystack && config.keywords) {
    for (const [mode, spec] of Object.entries(config.keywords)) {
      if (!spec || !Array.isArray(spec.tokens)) continue
      for (const token of spec.tokens) {
        if (token && haystack.includes(token)) {
          bump(scores, breakdown, mode, spec.weight, `keyword:${token.trim()}`)
        }
      }
    }
  }

  // C. Session length — long uninterrupted run rewards focus modes; a very short
  //    hit nudges toward Distraction. The deep boost is steered toward whichever of
  //    Deep work / Creative the earlier signals already favour, so a long Figma
  //    session boosts Creative, not Deep work.
  const sl = config.sessionLength
  if (sl && typeof sig.sessionLen === 'number') {
    if (sig.sessionLen >= sl.longRunMs) {
      const focusTarget =
        (scores['Creative'] || 0) > (scores['Deep work'] || 0) ? 'Creative' : 'Deep work'
      bump(scores, breakdown, focusTarget, sl.deepBoost, 'long-session')
    } else if (sig.sessionLen <= sl.shortHitMs) {
      bump(scores, breakdown, 'Distraction', sl.shortHitDistractBoost, 'short-hit')
    }
  }

  // D. Switch rate — churn boosts Distraction and penalises focus; a calm foreground
  //    rewards Deep work.
  const sr = config.switchRate
  if (sr && typeof sig.switchRate === 'number') {
    if (sig.switchRate >= sr.churnThreshold) {
      bump(scores, breakdown, 'Distraction', sr.distractBoost, 'high-switch-rate')
      bump(scores, breakdown, 'Deep work', -sr.deepPenalty, 'high-switch-rate')
      bump(scores, breakdown, 'Creative', -sr.deepPenalty, 'high-switch-rate')
    } else if (sig.switchRate <= sr.calmThreshold) {
      bump(scores, breakdown, 'Deep work', sr.calmDeepBoost, 'calm-foreground')
    }
  }

  // E. Time of day — optional late-night nudge.
  const tod = config.timeOfDay
  if (tod && tod.enabled && typeof sig.hour === 'number') {
    const isLate = sig.hour >= tod.lateStartHour || sig.hour <= tod.lateEndHour
    if (isLate) {
      bump(scores, breakdown, 'Break', tod.lateBreakBoost, 'late-night')
      bump(scores, breakdown, 'Distraction', tod.lateDistractBoost, 'late-night')
    }
  }

  // Argmax. Ties resolve by the canonical MODES order (stable, deterministic).
  let bestMode = null
  let bestScore = -Infinity
  for (const mode of MODES) {
    const s = scores[mode] || 0
    if (s > bestScore) {
      bestScore = s
      bestMode = mode
    }
  }

  const floor = typeof config.confidenceFloor === 'number' ? config.confidenceFloor : 0.35
  const lowConfidence = !bestMode || bestScore < floor

  return {
    mode: bestMode,
    confidence: Math.max(0, Math.round(bestScore * 1000) / 1000),
    rollup: bestMode ? MODE_ROLLUP[bestMode] : 'neutral',
    scores,
    breakdown,
    lowConfidence
  }
}

module.exports = { scoreSignature, MODES, MODE_ROLLUP }
