/**
 * Activity-key normalization (span-write time)
 *
 * A span records WHAT HAPPENED. Before it is written, the raw signals (exe name,
 * URL, window title) are reduced to a small set of stable, structured components —
 * NEVER a raw URL string. Matching later happens against these components, so the
 * normalization here defines the vocabulary rules can target.
 *
 * Pure and dependency-free (no Electron, no DB) so it runs under plain `node` and is
 * unit-testable in isolation. `URL` is a Node/global built-in, safe to use here.
 *
 * Output shape (the span key):
 *   {
 *     source: 'app' | 'web',
 *     app:    'chrome.exe',        // always present — web activity still ran in an app
 *     domain: 'github.com' | null, // lowercased, leading 'www.' stripped
 *     path:   '/acme/api/pull/42' | null, // query + fragment dropped by default
 *     title:  'Fix null deref …' | null   // weak signal, retained verbatim (trimmed)
 *   }
 *
 * ### Query strings
 * Query params are tracking junk and explode key cardinality, so the DEFAULT is to
 * DROP them. A specific domain may opt INTO preserving ONE named param via
 * `preserveQueryParams` config: `{ 'youtube.com': ['v'] }`. The default is strip;
 * the exception is opt-in. A preserved param is appended back onto the path as
 * `?name=value` so it participates in path-prefix/regex matching, keeping the key a
 * single comparable string per (domain, path).
 */

// Lowercase a hostname and strip a single leading 'www.'. Returns null for empty.
function normalizeDomain(host) {
  if (!host) return null
  let h = String(host).toLowerCase().trim()
  if (!h) return null
  if (h.startsWith('www.')) h = h.slice(4)
  return h || null
}

// Parse a URL into { domain, path } with the query/fragment policy applied.
// Returns { domain: null, path: null } when the input isn't a parseable http(s) URL
// (e.g. 'chrome://newtab', '', a bare title) — the caller then falls back to app-only.
function parseUrl(rawUrl, preserveQueryParams) {
  if (!rawUrl) return { domain: null, path: null }
  let u
  try {
    u = new URL(String(rawUrl))
  } catch (e) {
    return { domain: null, path: null }
  }
  // Only http(s) carry a meaningful domain/path for our purposes. Custom schemes
  // (chrome://, file://, about:) have no registrable host we want to match on.
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { domain: null, path: null }
  }

  const domain = normalizeDomain(u.hostname)
  // Path without trailing slash noise collapsed to '/'. Keep it as-is otherwise.
  let path = u.pathname || '/'

  // Query policy: default drop. Opt-in preserve of ONE named param per domain.
  const allow =
    domain && preserveQueryParams && Array.isArray(preserveQueryParams[domain])
      ? preserveQueryParams[domain]
      : null
  if (allow && allow.length > 0 && u.search) {
    // Preserve the FIRST allowed param that is present, appended to the path so the
    // key stays a single comparable string. (One param by design — see module doc.)
    for (const name of allow) {
      const val = u.searchParams.get(name)
      if (val !== null) {
        path = `${path}?${name}=${val}`
        break
      }
    }
  }

  return { domain, path }
}

/**
 * Normalize a raw activity observation into a structured span key.
 *
 * @param {object} raw
 * @param {'app'|'web'} raw.source
 * @param {string} raw.app    exe/app name; always required (web still ran in an app)
 * @param {string} [raw.url]  full URL for web activity
 * @param {string} [raw.title] window/page title (weak signal)
 * @param {object} [config]
 * @param {object} [config.preserveQueryParams] { domain: ['paramName', ...] }
 * @returns {{source, app, domain, path, title}}
 */
function normalizeKey(raw, config = {}) {
  const r = raw || {}
  const source = r.source === 'web' ? 'web' : 'app'
  const app = r.app ? String(r.app).toLowerCase().trim() : null
  const title = r.title ? String(r.title).trim() : null

  let domain = null
  let path = null
  if (source === 'web') {
    const parsed = parseUrl(r.url, config.preserveQueryParams)
    domain = parsed.domain
    path = parsed.path
  }

  return { source, app, domain, path, title }
}

module.exports = { normalizeKey, normalizeDomain, parseUrl }
