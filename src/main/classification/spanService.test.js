/**
 * SpanService DB-backed tests, including THE INVARIANT TEST.
 *
 *   node src/main/classification/spanService.test.js
 *
 * Uses a real in-memory sqlite3 database with the real span-model tables, so the
 * write path, resolve-in-JS read path, and the retroactive-recategorization
 * invariant are all exercised against actual SQL. No Electron.
 *
 * THE INVARIANT (the load-bearing test): write a span, resolve it -> category A;
 * edit a rule; resolve the SAME already-written span -> category B, and assert the
 * span row itself was never UPDATEd. This is an executable statement of the core
 * architecture: the event log is immutable and re-categorization is retroactive for
 * free. If someone later denormalizes the category onto the span for a perf win,
 * this test fails loudly.
 */

const sqlite3 = require('sqlite3')
const { SpanService } = require('./spanService')

// --- Minimal db adapter exposing the run/all interface SpanService expects, backed
//     by a real in-memory sqlite3 db. Mirrors SQLiteConnection.run/all semantics
//     (run -> { lastID, changes }; all -> rows).
function makeDb() {
  const db = new sqlite3.Database(':memory:')
  return {
    _raw: db,
    run(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) reject(err)
          else resolve({ lastID: this.lastID, changes: this.changes })
        })
      })
    },
    all(sql, params = []) {
      return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
      })
    },
    exec(sql) {
      return new Promise((resolve, reject) => {
        db.exec(sql, (err) => (err ? reject(err) : resolve()))
      })
    },
    close() {
      return new Promise((resolve) => db.close(() => resolve()))
    }
  }
}

let passed = 0
let failed = 0
function ok(cond, label) {
  if (cond) { passed++; console.log(`  ✓ ${label}`) }
  else { failed++; console.error(`  ✗ ${label}`) }
}

// The span-model DDL, kept in sync with schema.sql (the four tables the engine owns).
// Defined inline so the test builds exactly these tables without parsing the full
// schema file (which contains triggers that don't split cleanly on ';').
const SPAN_SCHEMA = `
CREATE TABLE span (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_source TEXT NOT NULL CHECK (key_source IN ('app', 'web')),
    key_app TEXT NOT NULL,
    key_app_name TEXT,
    key_domain TEXT,
    key_path TEXT,
    title TEXT,
    start DATETIME NOT NULL,
    end DATETIME NOT NULL,
    degraded_flag INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE category (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    default_productivity TEXT NOT NULL
        CHECK (default_productivity IN ('productive', 'neutral', 'distracting'))
);
CREATE TABLE rule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    matcher_type TEXT NOT NULL CHECK (matcher_type IN
        ('title_contains', 'app', 'domain', 'domain_path_prefix', 'domain_path_regex')),
    matcher_value TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    is_user_rule INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE CASCADE
);
CREATE TABLE productivity_override (
    category_id INTEGER PRIMARY KEY,
    productivity TEXT NOT NULL
        CHECK (productivity IN ('productive', 'neutral', 'distracting')),
    FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE CASCADE
);
`

async function main() {
  const db = makeDb()
  await db.exec('PRAGMA foreign_keys = ON;')
  await db.exec(SPAN_SCHEMA)

  // Seed a tiny catalog: two categories.
  await db.run(`INSERT INTO category (name, default_productivity) VALUES ('Coding','productive')`)
  await db.run(`INSERT INTO category (name, default_productivity) VALUES ('Social','distracting')`)
  const cats = await db.all(`SELECT id, name FROM category`)
  const codingId = cats.find((c) => c.name === 'Coding').id
  const socialId = cats.find((c) => c.name === 'Social').id

  const svc = new SpanService(db)

  console.log('\nwrite path stores structured key, no category column:')
  {
    const t0 = Date.UTC(2026, 0, 1, 10, 0, 0)
    const t1 = Date.UTC(2026, 0, 1, 10, 15, 0)
    const id = await svc.writeSpan(
      { source: 'web', app: 'Chrome.exe', url: 'https://www.reddit.com/r/programming?sort=hot', title: 'r/programming' },
      t0,
      t1
    )
    ok(typeof id === 'number' && id > 0, 'writeSpan returns an id')
    const row = await db.all(`SELECT * FROM span WHERE id = ?`, [id])
    ok(row[0].key_domain === 'reddit.com', 'stored normalized domain (www stripped)')
    ok(row[0].key_path === '/r/programming', 'stored path with query dropped')
    ok(!('category' in row[0]) && !('mode' in row[0]), 'span row has NO category/mode column')
  }

  console.log('\nfriendly app name is stored and read back:')
  {
    const t0 = Date.UTC(2026, 0, 1, 11, 0, 0)
    const id = await svc.writeSpan(
      { source: 'app', app: 'Code.exe', appName: 'Visual Studio Code', title: 'index.js' },
      t0,
      t0 + 60000
    )
    const row = (await db.all(`SELECT * FROM span WHERE id = ?`, [id]))[0]
    ok(row.key_app === 'code.exe', 'raw exe stored lowercased in key_app')
    ok(row.key_app_name === 'Visual Studio Code', 'friendly name stored in key_app_name')
    const spans = await svc.getSpansInRange(t0, t0 + 120000)
    ok(spans.find((s) => s.id === id).appName === 'Visual Studio Code', 'getSpansInRange returns appName')
  }

  console.log('\nappName falls back to raw app when absent:')
  {
    const t0 = Date.UTC(2026, 0, 1, 12, 0, 0)
    const id = await svc.writeSpan({ source: 'app', app: 'weirdtool.exe', title: 'x' }, t0, t0 + 5000)
    const row = (await db.all(`SELECT * FROM span WHERE id = ?`, [id]))[0]
    ok(row.key_app_name === 'weirdtool.exe', 'key_app_name falls back to key_app when no appName given')
  }

  // ---- THE INVARIANT TEST ----
  console.log('\nINVARIANT: editing a rule re-labels an already-written span, no migration:')
  {
    const t0 = Date.UTC(2026, 0, 2, 9, 0, 0)
    const t1 = Date.UTC(2026, 0, 2, 9, 30, 0)
    // A span for reddit.com, written ONCE and never touched again.
    const spanId = await svc.writeSpan(
      { source: 'web', app: 'chrome.exe', url: 'https://reddit.com/r/rust', title: 'r/rust' },
      t0,
      t1
    )

    // Rule v1: reddit.com -> Coding. Resolve -> A.
    await db.run(
      `INSERT INTO rule (matcher_type, matcher_value, category_id, is_user_rule) VALUES ('domain','reddit.com',?,0)`,
      [codingId]
    )
    const rangeStart = Date.UTC(2026, 0, 2, 0, 0, 0)
    const rangeEnd = Date.UTC(2026, 0, 3, 0, 0, 0)
    let resolved = await svc.getResolvedSpans(rangeStart, rangeEnd)
    let mine = resolved.find((s) => s.id === spanId)
    ok(mine && mine.category === 'Coding', 'span resolves to Coding under rule v1 (category A)')

    // Capture the span row's raw state BEFORE editing the rule.
    const before = (await db.all(`SELECT * FROM span WHERE id = ?`, [spanId]))[0]

    // Edit the SAME rule to point reddit.com -> Social. No touch to the span.
    await db.run(`UPDATE rule SET category_id = ? WHERE matcher_type='domain' AND matcher_value='reddit.com'`, [socialId])

    resolved = await svc.getResolvedSpans(rangeStart, rangeEnd)
    mine = resolved.find((s) => s.id === spanId)
    ok(mine && mine.category === 'Social', 'SAME span now resolves to Social under rule v2 (category B)')

    // Prove the span row was NOT mutated by the re-categorization.
    const after = (await db.all(`SELECT * FROM span WHERE id = ?`, [spanId]))[0]
    ok(
      JSON.stringify(before) === JSON.stringify(after),
      'span row is byte-identical before/after — zero data migration'
    )
  }

  console.log('\nuncategorized aggregate surfaces unmatched time, longest first:')
  {
    const day = 5
    const base = Date.UTC(2026, 0, day, 8, 0, 0)
    // Two unmatched app spans (no rule for them) + one matched (code.exe -> Coding).
    await db.run(`INSERT INTO rule (matcher_type, matcher_value, category_id, is_user_rule) VALUES ('app','code.exe',?,0)`, [codingId])
    await svc.writeSpan({ source: 'app', app: 'mystery-tool.exe', title: 'x' }, base, base + 20 * 60000) // 20m
    await svc.writeSpan({ source: 'app', app: 'mystery-tool.exe', title: 'x' }, base + 30 * 60000, base + 35 * 60000) // 5m
    await svc.writeSpan({ source: 'app', app: 'other-tool.exe', title: 'y' }, base, base + 10 * 60000) // 10m
    await svc.writeSpan({ source: 'app', app: 'code.exe', title: 'index.js' }, base, base + 60 * 60000) // matched, excluded

    const rangeStart = Date.UTC(2026, 0, day, 0, 0, 0)
    const rangeEnd = Date.UTC(2026, 0, day + 1, 0, 0, 0)
    const uncat = await svc.getUncategorizedByKey(rangeStart, rangeEnd)
    ok(uncat.length === 2, 'exactly the two unmatched keys are surfaced (matched code.exe excluded)')
    ok(uncat[0].app === 'mystery-tool.exe', 'longest-uncategorized key sorts first')
    ok(uncat[0].totalMs === 25 * 60000 && uncat[0].spanCount === 2, 'aggregates duration + span count across a key')
  }

  await db.close()
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
