/**
 * Resolver + normalization unit tests. Pure — no DB, no Electron. Run with:
 *   node src/main/classification/resolver.test.js
 * Exits non-zero on any failure so it can gate a build.
 *
 * Covers (per spec): specificity ordering, user-rule-beats-built-in at equal
 * specificity, no-match -> unrated, and key normalization (www strip, query drop,
 * case). The cross-cutting invariant "editing a rule re-labels an already-written
 * span with no data migration" is proved against the real DB in spanService.test.js.
 */

const { resolve, ruleMatches, specificityOf, UNRATED } = require('./resolver')
const { normalizeKey } = require('./normalizeKey')

let passed = 0
let failed = 0
function ok(cond, label) {
  if (cond) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.error(`  ✗ ${label}`)
  }
}
function eq(actual, expected, label) {
  ok(actual === expected, `${label} (got ${JSON.stringify(actual)})`)
}

// Shared category catalog for resolver cases.
const CATEGORIES = {
  1: { id: 1, name: 'Coding', default_productivity: 'productive' },
  2: { id: 2, name: 'Code Review', default_productivity: 'productive' },
  3: { id: 3, name: 'Communication', default_productivity: 'neutral' },
  4: { id: 4, name: 'Social', default_productivity: 'distracting' }
}

console.log('\nnormalizeKey:')
{
  const k = normalizeKey({ source: 'web', app: 'Chrome.exe', url: 'https://www.GitHub.com/acme/api/pull/42?tab=files#top', title: 'PR #42' })
  eq(k.domain, 'github.com', 'strips www. and lowercases domain')
  eq(k.path, '/acme/api/pull/42', 'drops query string and fragment by default')
  eq(k.app, 'chrome.exe', 'lowercases app')
  eq(k.source, 'web', 'source preserved')

  const appOnly = normalizeKey({ source: 'app', app: 'Code.exe', title: 'index.js' })
  eq(appOnly.domain, null, 'app span has no domain')
  eq(appOnly.path, null, 'app span has no path')

  // Opt-in query param preservation for a specific domain, one param only.
  const yt = normalizeKey(
    { source: 'web', app: 'chrome.exe', url: 'https://youtube.com/watch?v=abc123&t=90s' },
    { preserveQueryParams: { 'youtube.com': ['v'] } }
  )
  eq(yt.path, '/watch?v=abc123', 'preserves ONLY the opted-in query param')

  // A non-opted domain still drops everything.
  const other = normalizeKey(
    { source: 'web', app: 'chrome.exe', url: 'https://example.com/x?v=abc' },
    { preserveQueryParams: { 'youtube.com': ['v'] } }
  )
  eq(other.path, '/x', 'non-opted domain still drops query')

  // Non-http scheme -> app-only fallback (no domain/path).
  const chrome = normalizeKey({ source: 'web', app: 'chrome.exe', url: 'chrome://newtab' })
  eq(chrome.domain, null, 'chrome:// yields no domain')
}

console.log('\nspecificity ordering:')
{
  eq(specificityOf('title_contains') < specificityOf('app'), true, 'title_contains < app')
  eq(specificityOf('app') < specificityOf('domain'), true, 'app < domain')
  eq(specificityOf('domain') < specificityOf('domain_path_prefix'), true, 'domain < domain_path_prefix')
  eq(specificityOf('domain_path_prefix') < specificityOf('domain_path_regex'), true, 'domain_path_prefix < domain_path_regex')

  // A domain_path_prefix rule and a plain domain rule both match github.com/acme/pulls;
  // the more specific path-prefix rule must win regardless of array order.
  const key = normalizeKey({ source: 'web', app: 'chrome.exe', url: 'https://github.com/acme/repo/pulls' })
  const domainRule = { id: 10, matcher_type: 'domain', matcher_value: 'github.com', category_id: 1, is_user_rule: false }
  const prefixRule = { id: 11, matcher_type: 'domain_path_prefix', matcher_value: 'github.com/acme/repo/pulls', category_id: 2, is_user_rule: false }

  eq(resolve(key, [domainRule, prefixRule], CATEGORIES).category, 'Code Review', 'more specific path-prefix wins (order A)')
  eq(resolve(key, [prefixRule, domainRule], CATEGORIES).category, 'Code Review', 'more specific path-prefix wins (order B) — order-independent')
}

console.log('\nuser rule beats built-in at equal specificity:')
{
  const key = normalizeKey({ source: 'app', app: 'slack.exe', title: 'general' })
  const builtin = { id: 20, matcher_type: 'app', matcher_value: 'slack.exe', category_id: 3, is_user_rule: false }
  const userRule = { id: 21, matcher_type: 'app', matcher_value: 'slack.exe', category_id: 4, is_user_rule: true }
  eq(resolve(key, [builtin, userRule], CATEGORIES).category, 'Social', 'user rule wins (order A)')
  eq(resolve(key, [userRule, builtin], CATEGORIES).category, 'Social', 'user rule wins (order B) — order-independent')
}

console.log('\nno match -> unrated:')
{
  const key = normalizeKey({ source: 'app', app: 'some-random-internal-tool.exe', title: 'x' })
  const r = resolve(key, [{ id: 30, matcher_type: 'app', matcher_value: 'code.exe', category_id: 1, is_user_rule: false }], CATEGORIES)
  eq(r.category, null, 'no matching rule -> null category')
  eq(r.productivity, UNRATED, 'no matching rule -> unrated productivity')
  eq(r.winning_rule, null, 'no matching rule -> null winning_rule')
}

console.log('\nwinning_rule is returned for the "why?" affordance:')
{
  const key = normalizeKey({ source: 'web', app: 'chrome.exe', url: 'https://github.com/x' })
  const rule = { id: 40, matcher_type: 'domain', matcher_value: 'github.com', category_id: 1, is_user_rule: false }
  const r = resolve(key, [rule], CATEGORIES)
  eq(r.winning_rule && r.winning_rule.id, 40, 'resolver returns the winning rule object')
}

console.log('\nproductivity is a separate axis (override wins over category default):')
{
  const key = normalizeKey({ source: 'app', app: 'slack.exe' })
  const rule = { id: 50, matcher_type: 'app', matcher_value: 'slack.exe', category_id: 3, is_user_rule: false }
  eq(resolve(key, [rule], CATEGORIES).productivity, 'neutral', 'uses category default_productivity')
  eq(resolve(key, [rule], CATEGORIES, { 3: 'distracting' }).productivity, 'distracting', 'per-user override wins')
}

console.log('\nmatcher edge cases:')
{
  // app matcher is whole-token: 'code' matches code.exe but not vscode.exe
  ok(ruleMatches({ matcher_type: 'app', matcher_value: 'code.exe' }, { app: 'code.exe' }), 'app exact match')
  ok(!ruleMatches({ matcher_type: 'app', matcher_value: 'code' }, { app: 'vscode.exe' }), "app 'code' does NOT match vscode.exe")
  // malformed regex rule never throws, just doesn't match
  ok(!ruleMatches({ matcher_type: 'domain_path_regex', matcher_value: 'x.com/[' }, { domain: 'x.com', path: '/a' }), 'malformed regex rule safely does not match')
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
