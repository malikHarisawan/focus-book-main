/**
 * Span service — the DB-facing layer of the span-model categorization engine.
 *
 * Separation of concerns:
 *   - normalizeKey.js / resolver.js are PURE (no DB) and hold all the logic.
 *   - THIS module does I/O: write immutable spans, read spans in a time range,
 *     load the rule set, and resolve-in-JS to produce category-labelled results.
 *
 * It takes a `db` with the same minimal interface the rest of the app's services
 * use (`run`, `all`) so it can run against the real SQLiteConnection in production
 * and against a throwaway connection in tests.
 *
 * Nothing here writes a category onto a span. Resolution is applied at read time
 * (getResolvedSpans / getUncategorizedByKey) by joining spans against the CURRENT
 * rules — so editing a rule retroactively re-labels history with no data migration.
 */

const { normalizeKey } = require('./normalizeKey')
const { resolve, UNRATED } = require('./resolver')

class SpanService {
  /**
   * @param {object} db object exposing async run(sql, params) and all(sql, params)
   * @param {object} [config] { preserveQueryParams: { domain: ['param'] } }
   */
  constructor(db, config = {}) {
    this.db = db
    this.config = config
  }

  /**
   * Write ONE immutable span. `raw` is the un-normalized observation; the structured
   * key is derived here at write time. No category/mode is computed or stored.
   *
   * `raw.appName` is the friendly display name (FileDescription) — a FACT about what
   * ran, stored so the dashboard needs no name resolver. Falls back to the raw app.
   *
   * @param {object} raw { source, app, appName?, url?, title? }
   * @param {number} start epoch ms (or ISO string)
   * @param {number} end   epoch ms (or ISO string)
   * @param {boolean} [degraded]
   * @returns {Promise<number>} the new span id
   */
  async writeSpan(raw, start, end, degraded = false) {
    const key = normalizeKey(raw, this.config)
    const appName = (raw && raw.appName ? String(raw.appName).trim() : '') || key.app
    const result = await this.db.run(
      `INSERT INTO span (key_source, key_app, key_app_name, key_domain, key_path, title, start, end, degraded_flag)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        key.source,
        key.app,
        appName,
        key.domain,
        key.path,
        key.title,
        toIso(start),
        toIso(end),
        degraded ? 1 : 0
      ]
    )
    return result && (result.lastID ?? result.lastInsertRowid ?? result.id)
  }

  // Load the full rule set + category/override lookups the resolver needs. Kept as
  // one call so callers resolve many spans against a single consistent snapshot.
  async loadRuleContext() {
    const [rules, cats, overrides] = await Promise.all([
      this.db.all(
        `SELECT id, matcher_type, matcher_value, category_id, is_user_rule FROM rule`
      ),
      this.db.all(`SELECT id, name, default_productivity FROM category`),
      this.db.all(`SELECT category_id, productivity FROM productivity_override`)
    ])
    const categories = {}
    for (const c of cats || []) categories[c.id] = c
    const overrideMap = {}
    for (const o of overrides || []) overrideMap[o.category_id] = o.productivity
    // Normalize is_user_rule to a real boolean for the pure resolver.
    const normRules = (rules || []).map((r) => ({
      ...r,
      is_user_rule: !!r.is_user_rule
    }))
    return { rules: normRules, categories, overrides: overrideMap }
  }

  // --- Category + rule CRUD (Settings panel + correction flow) ---
  // These own the mutable "what we believe it means" side. Because reads resolve
  // live, any change here retroactively re-labels history with no data migration.

  // All categories as [{ id, name, default_productivity }], sorted by name.
  async getCategories() {
    const rows = await this.db.all(
      `SELECT id, name, default_productivity FROM category ORDER BY name ASC`
    )
    return rows || []
  }

  // All rules as [{ id, matcher_type, matcher_value, category_id, category_name, is_user_rule }].
  // Joins the category name so the UI can render the target without a second lookup.
  async getRules() {
    const rows = await this.db.all(
      `SELECT r.id, r.matcher_type, r.matcher_value, r.category_id, c.name AS category_name, r.is_user_rule
       FROM rule r LEFT JOIN category c ON c.id = r.category_id
       ORDER BY r.matcher_type, r.matcher_value`
    )
    return (rows || []).map((r) => ({ ...r, is_user_rule: !!r.is_user_rule }))
  }

  // Resolve a category id by name (case-insensitive), or null.
  async categoryIdByName(name) {
    if (!name) return null
    const row = await this.db.all(`SELECT id FROM category WHERE name = ? COLLATE NOCASE`, [name])
    return row && row[0] ? row[0].id : null
  }

  // Add a category (name + default_productivity). Idempotent on name.
  async addCategory(name, defaultProductivity = 'neutral') {
    if (!name) return false
    await this.db.run(
      `INSERT OR IGNORE INTO category (name, default_productivity) VALUES (?, ?)`,
      [name, defaultProductivity]
    )
    return true
  }

  // Update a category's default_productivity (the judgment axis).
  async updateCategory(id, { default_productivity } = {}) {
    if (!id || !default_productivity) return false
    const res = await this.db.run(
      `UPDATE category SET default_productivity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [default_productivity, id]
    )
    return (res.changes || 0) > 0
  }

  async deleteCategory(id) {
    if (!id) return false
    const res = await this.db.run(`DELETE FROM category WHERE id = ?`, [id])
    return (res.changes || 0) > 0
  }

  /**
   * Upsert a rule — the correction primitive. A "change category" action becomes this:
   * insert (or update the category of) a rule matching the app/domain. Because reads
   * resolve live, the change is instantly retroactive with no history migration.
   * Uniqueness is (matcher_type, matcher_value): the same pattern re-points to the
   * new category rather than creating a duplicate.
   *
   * @returns {{ id, created }}
   */
  async upsertRule({ matcher_type, matcher_value, categoryName, is_user_rule = 1 }) {
    const categoryId = await this.categoryIdByName(categoryName)
    if (!categoryId) return { id: null, created: false }
    const existing = await this.db.all(
      `SELECT id FROM rule WHERE matcher_type = ? AND matcher_value = ? COLLATE NOCASE`,
      [matcher_type, matcher_value]
    )
    if (existing && existing[0]) {
      await this.db.run(
        `UPDATE rule SET category_id = ?, is_user_rule = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [categoryId, is_user_rule ? 1 : 0, existing[0].id]
      )
      return { id: existing[0].id, created: false }
    }
    const res = await this.db.run(
      `INSERT INTO rule (matcher_type, matcher_value, category_id, is_user_rule) VALUES (?, ?, ?, ?)`,
      [matcher_type, matcher_value, categoryId, is_user_rule ? 1 : 0]
    )
    return { id: res.lastID, created: true }
  }

  // Update an existing rule by id (matcher and/or target category).
  async updateRule(id, { matcher_type, matcher_value, categoryName } = {}) {
    if (!id) return false
    const sets = []
    const params = []
    if (matcher_type) { sets.push('matcher_type = ?'); params.push(matcher_type) }
    if (matcher_value) { sets.push('matcher_value = ?'); params.push(matcher_value) }
    if (categoryName) {
      const cid = await this.categoryIdByName(categoryName)
      if (cid) { sets.push('category_id = ?'); params.push(cid) }
    }
    if (sets.length === 0) return false
    params.push(id)
    const res = await this.db.run(
      `UPDATE rule SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      params
    )
    return (res.changes || 0) > 0
  }

  async deleteRule(id) {
    if (!id) return false
    const res = await this.db.run(`DELETE FROM rule WHERE id = ?`, [id])
    return (res.changes || 0) > 0
  }

  // Raw span rows in [startMs, endMs], reconstructed into the pure-resolver key shape.
  // `appName` (friendly display name) is carried alongside the key for the adapter to
  // use as the display key — it is NOT part of the matching key the resolver sees.
  async getSpansInRange(startMs, endMs) {
    const rows = await this.db.all(
      `SELECT id, key_source, key_app, key_app_name, key_domain, key_path, title, start, end, degraded_flag
       FROM span WHERE start >= ? AND start < ? ORDER BY start ASC`,
      [toIso(startMs), toIso(endMs)]
    )
    return (rows || []).map((r) => ({
      id: r.id,
      key: {
        source: r.key_source,
        app: r.key_app,
        domain: r.key_domain,
        path: r.key_path,
        title: r.title
      },
      appName: r.key_app_name || r.key_app,
      start: r.start,
      end: r.end,
      durationMs: msBetween(r.start, r.end),
      degraded: !!r.degraded_flag
    }))
  }

  /**
   * Resolve every span in a range against the CURRENT rules (resolve-in-JS). Returns
   * each span annotated with { category, productivity, winning_rule }. This is the
   * seam the dashboards consume — no category is ever read off the span itself.
   */
  async getResolvedSpans(startMs, endMs) {
    const [spans, ctx] = await Promise.all([
      this.getSpansInRange(startMs, endMs),
      this.loadRuleContext()
    ])
    return spans.map((s) => {
      const r = resolve(s.key, ctx.rules, ctx.categories, ctx.overrides)
      return {
        ...s,
        category: r.category,
        productivity: r.productivity,
        winning_rule: r.winning_rule
      }
    })
  }

  /**
   * Uncategorized time, grouped by key, longest first — the self-service backlog.
   * A span is uncategorized when it resolves to `unrated` (no rule matched). We group
   * by the stable identity of the key (app for app spans, domain+path for web).
   *
   * @returns {Promise<Array<{ key, source, app, domain, path, totalMs, spanCount }>>}
   */
  async getUncategorizedByKey(startMs, endMs) {
    const resolved = await this.getResolvedSpans(startMs, endMs)
    const buckets = new Map()
    for (const s of resolved) {
      if (s.category !== null && s.productivity !== UNRATED) continue
      // Only truly unmatched spans count as "uncategorized".
      if (s.winning_rule) continue
      const k = s.key
      const groupKey =
        k.source === 'web' ? `web|${k.domain || ''}|${k.path || ''}` : `app|${k.app || ''}`
      if (!buckets.has(groupKey)) {
        buckets.set(groupKey, {
          key: groupKey,
          source: k.source,
          app: k.app,
          domain: k.domain,
          path: k.path,
          totalMs: 0,
          spanCount: 0
        })
      }
      const b = buckets.get(groupKey)
      b.totalMs += s.durationMs
      b.spanCount += 1
    }
    return Array.from(buckets.values()).sort((a, b) => b.totalMs - a.totalMs)
  }
}

// --- small helpers (no Date.now / no wall-clock; only convert what's passed in) ---

// Accept epoch-ms number or ISO string; store as ISO for stable text comparison.
function toIso(v) {
  if (typeof v === 'number') return new Date(v).toISOString()
  return String(v)
}

function msBetween(startIso, endIso) {
  const s = new Date(startIso).getTime()
  const e = new Date(endIso).getTime()
  return Number.isFinite(s) && Number.isFinite(e) ? Math.max(0, e - s) : 0
}

module.exports = { SpanService }
