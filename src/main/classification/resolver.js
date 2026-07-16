/**
 * Categorization resolver (QUERY time)
 *
 * The span table records what happened; the rule table records what we currently
 * believe it means. This module is the bridge: given a normalized span key and the
 * CURRENT rules, it computes a category + productivity WITHOUT reading anything off
 * the span but its key. Because resolution happens at read time, editing a rule
 * retroactively changes every past span's category with zero data migration — that
 * property is the entire point, and `resolver.test.js` proves it.
 *
 * Pure and dependency-free (no Electron, no DB) so it runs under plain `node`.
 *
 * ### Conflict resolution — most-specific-wins, NOT first-match
 * Every rule whose matcher matches the key is scored by SPECIFICITY (derived from
 * matcher_type, not stored). The highest score wins. At equal specificity, a user
 * rule beats a built-in rule. This is deterministic and ORDER-INDEPENDENT — rule
 * position never matters, so there is no drag-to-reorder UI and "why didn't my
 * override fire?" always has an answer (return value 3, `winning_rule`).
 *
 * ### Return type — (category, productivity, winning_rule)
 * winning_rule is load-bearing: it powers a "why is this categorized as X?"
 * affordance. Trivial to include now, near-impossible to retrofit later.
 *
 * ### Category vs productivity — separate axes
 * category is taxonomy; productivity is judgment and is independently overridable per
 * user without redefining the taxonomy. productivity is one of exactly
 * 'productive' | 'neutral' | 'distracting', plus the implicit 'unrated' when nothing
 * matched.
 */

// Matcher types in ASCENDING specificity. The array index IS the specificity score,
// so adding a type is a one-line change and scoring can never drift from this list.
const MATCHER_SPECIFICITY = [
  'title_contains', // 0 — lowest; escape hatch for title-only apps
  'app', // 1
  'domain', // 2
  'domain_path_prefix', // 3
  'domain_path_regex' // 4 — highest; rare, precise
]

const UNRATED = 'unrated'
const VALID_PRODUCTIVITY = new Set(['productive', 'neutral', 'distracting'])

// Specificity rank for a matcher type; -1 for an unknown type (treated as no match).
function specificityOf(matcherType) {
  return MATCHER_SPECIFICITY.indexOf(matcherType)
}

// Does one rule match the key? Pure predicate per matcher_type. Case-insensitive on
// the textual signals (matcher_value is normalized to lowercase by the caller's data,
// but we lowercase defensively so a hand-entered rule still matches).
function ruleMatches(rule, key) {
  if (!rule || !key) return false
  const value = String(rule.matcher_value || '').toLowerCase()
  if (!value) return false

  switch (rule.matcher_type) {
    case 'title_contains': {
      const title = (key.title || '').toLowerCase()
      return title.includes(value)
    }
    case 'app': {
      const app = (key.app || '').toLowerCase()
      // Whole-token app match: exact, or the value as the exe base (strip .exe both
      // sides) so 'code' matches 'code.exe' but not 'vscode.exe'.
      const appBase = app.replace(/\.exe$/, '')
      const valBase = value.replace(/\.exe$/, '')
      return app === value || appBase === valBase
    }
    case 'domain': {
      // Exact registrable-domain match against the key's normalized domain.
      return !!key.domain && key.domain === value
    }
    case 'domain_path_prefix': {
      // value is 'domain/pathprefix' (e.g. 'github.com/*/pulls' is expressed as a
      // literal prefix here — regex lives in domain_path_regex). Compare against
      // 'domain + path'. A leading segment before the first '/' is the domain.
      if (!key.domain) return false
      const slash = value.indexOf('/')
      if (slash === -1) return key.domain === value // degenerate: domain-only value
      const vDomain = value.slice(0, slash)
      const vPrefix = value.slice(slash) // includes leading '/'
      if (key.domain !== vDomain) return false
      const path = key.path || '/'
      return path.startsWith(vPrefix)
    }
    case 'domain_path_regex': {
      // value is 'domain/<regex against path>'. Split on the first '/'.
      if (!key.domain) return false
      const slash = value.indexOf('/')
      if (slash === -1) return false
      const vDomain = value.slice(0, slash)
      const vPattern = value.slice(slash + 1)
      if (key.domain !== vDomain) return false
      let re
      try {
        re = new RegExp(vPattern)
      } catch (e) {
        return false // a malformed rule never matches, never throws
      }
      return re.test(key.path || '/')
    }
    default:
      return false
  }
}

// Compare two matching rules; return the winner. Higher specificity wins; at equal
// specificity a user rule beats a built-in. Fully deterministic (no reliance on
// input order): equal on both axes is impossible to reach with distinct rules unless
// two identical rules exist, in which case either is a correct, stable answer.
function moreSpecific(a, b) {
  const sa = specificityOf(a.matcher_type)
  const sb = specificityOf(b.matcher_type)
  if (sa !== sb) return sa > sb ? a : b
  const ua = a.is_user_rule ? 1 : 0
  const ub = b.is_user_rule ? 1 : 0
  if (ua !== ub) return ua > ub ? a : b
  return a // stable: keep the incumbent on a true tie
}

/**
 * Resolve a span key into a category + productivity + the winning rule.
 *
 * @param {object} key normalized span key (from normalizeKey)
 * @param {Array}  rules      [{ id, matcher_type, matcher_value, category_id, is_user_rule }]
 * @param {object} categories map { category_id: { id, name, default_productivity } }
 * @param {object} [overrides] map { category_id: productivity } — per-user prod overrides
 * @returns {{ category: string|null, productivity: string, winning_rule: object|null }}
 */
function resolve(key, rules, categories, overrides = {}) {
  let winner = null
  if (Array.isArray(rules)) {
    for (const rule of rules) {
      if (specificityOf(rule.matcher_type) === -1) continue // unknown type: skip
      if (!ruleMatches(rule, key)) continue
      winner = winner === null ? rule : moreSpecific(winner, rule)
    }
  }

  if (!winner) {
    return { category: null, productivity: UNRATED, winning_rule: null }
  }

  const cat = categories ? categories[winner.category_id] : null
  const categoryName = cat ? cat.name : null

  // Productivity: per-user override wins, else the category default, else unrated
  // (a matched-but-unrated category is possible if data is incomplete).
  let productivity = UNRATED
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, winner.category_id)) {
    productivity = overrides[winner.category_id]
  } else if (cat && cat.default_productivity) {
    productivity = cat.default_productivity
  }
  if (!VALID_PRODUCTIVITY.has(productivity)) productivity = UNRATED

  return { category: categoryName, productivity, winning_rule: winner }
}

module.exports = {
  resolve,
  ruleMatches,
  specificityOf,
  moreSpecific,
  MATCHER_SPECIFICITY,
  UNRATED
}
