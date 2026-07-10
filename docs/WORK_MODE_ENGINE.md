# Work-Mode Categorization Engine — Design

Adds a **second classification level** on top of the existing productivity verdict.
Nothing about the current productive/neutral/distracting axis is removed — the AreaChart
and every component that reads it keep working unchanged. The 5 modes are a *finer* level
that **rolls up** into the existing verdict.

## The two levels

```
Level 0  CATEGORY  what kind of app        Code, Browsing, Communication, ...   (unchanged)
Level 1  VERDICT   productive | neutral | distracting                          (unchanged — AreaChart uses this)
Level 2  MODE      Deep work | Creative | Collaboration | Break | Distraction  (NEW)
```

Level 2 → Level 1 rollup (fixed):

| Mode | Meaning | Rolls up to |
|------|---------|-------------|
| **Deep work** | Focused solo work — coding, writing, analysis | **productive** |
| **Creative** | Generative/design — design tools, music production | **productive** |
| **Collaboration** | Working *with* people — chat, calls, email, meetings | **productive** |
| **Break** | Intentional rest — music, idle, short breaks | **neutral** |
| **Distraction** | Off-task — social media, entertainment, doomscrolling | **distracting** |

Because the rollup reproduces the exact 3-bucket verdict, **the AreaChart's
productive/neutral/distracting series is unchanged** — mode is purely additive.

Classification is **100% local and deterministic** — a heuristic scorer, no LLM, no
network. Offline, private, reproducible.

---

## 1. Data model

Keep `categories.type` (`productive|neutral|distracted`) **exactly as-is** — that is
Level 1 and everything downstream depends on it. Add mode as a new, independent piece of
metadata.

### 1a. Mode is derived, verdict stays stored

The verdict is already derived at read time from the category (via
`getProductivityType(category)`), never stored per `app_usage` row. Mode works the same
way: **derived from the signature at read/track time, not backfilled into history.** So
there is *no* migration of `app_usage` rows.

### 1b. New `modes` metadata table (color/icon, mirrors `categories`)

```sql
CREATE TABLE IF NOT EXISTS modes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
        CHECK (name IN ('Deep work','Creative','Collaboration','Break','Distraction')),
    rollup TEXT NOT NULL CHECK (rollup IN ('productive','neutral','distracted')),
    color TEXT,
    icon TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO modes (name, rollup, color, icon) VALUES
    ('Deep work',     'productive',  '#00d8ff', 'Brain'),
    ('Creative',      'productive',  '#a855f7', 'Palette'),
    ('Collaboration', 'productive',  '#5ac26d', 'Users'),
    ('Break',         'neutral',     '#f59e0b', 'Coffee'),
    ('Distraction',   'distracted',  '#ff6384', 'AlertTriangle');
```

The `rollup` column is the source of truth for Level 2 → Level 1, so the mapping is
data-driven and can't drift from the verdict logic.

### 1c. Default category → mode mapping

Each existing category gets a default mode (used by the fallback layer). This does **not**
touch `categories.type`; it's a separate lookup (a `default_mode` column on `categories`,
or a small seed map in the scorer config).

```
Code          → Deep work        Entertainment → Distraction
Browsing      → Deep work        Social Media  → Distraction
Communication → Collaboration    Utilities     → Break
Miscellaneous → Break
```

### 1d. Mode-pinning rules

`category_rules` already maps pattern → category. Add an optional `mode` column so a rule
can pin a mode directly (e.g. title contains "figma" → Creative regardless of category):

```sql
ALTER TABLE category_rules ADD COLUMN mode TEXT;   -- nullable; when set, overrides the category's default mode
```

---

## 2. Layered classifier

`getMode(signature)` — first hit wins:

```
  1. USER OVERRIDE   per-app mode mapping (if the user pinned one)      always wins
  2. RULE            category_rules.mode where pattern matches
  3. HEURISTIC SCORE score(signature) → argmax over 5 modes            the new engine
  4. FALLBACK        category → default mode (§1c)
```

A **signature** (built in `src/preload/index.js`, mostly from fields that already exist):

```js
{
  exe: 'chrome.exe', appName: 'Google Chrome',
  category: 'Browsing',                         // from existing getCategory()
  title: 'Fixing null deref · Stack Overflow',
  domain: 'stackoverflow.com', hour: 14,
  sessionLen: 1_920_000,   // ms continuous run in this app (new, from existing timestamps)
  switchRate: 3            // app switches in last 5 min (new, in-memory ring buffer)
}
```

---

## 3. The heuristic scorer

Each signature accrues weighted scores for all five modes; argmax wins. Explainable
("Deep work 0.72 — IDE exe + long session"), tunable, no LLM.

### Signals

```
A. category anchor   Code→Deep work, Communication→Collaboration,
                     Entertainment/Social Media→Distraction, Utilities→Break
B. exe / domain      figma→Creative, slack/zoom→Collaboration, spotify→Break   (rules)
C. title keywords    "design|mockup"→Creative, "meeting|standup|call"→Collaboration,
                     "youtube|reddit|feed"→Distraction, "debug|build|PR"→Deep work
D. session length    long uninterrupted run boosts Deep work / Creative
E. switch rate       high churn boosts Distraction, penalises Deep work
F. time of day       optional, off by default
```

All weights live in one tunable config (`modeWeights.js`), so tuning never touches logic:

```js
export const MODE_WEIGHTS = {
  categoryAnchor: {
    Code:          { 'Deep work': 0.5 },
    Communication: { 'Collaboration': 0.5 },
    'Social Media':{ 'Distraction': 0.6 },
    Entertainment: { 'Distraction': 0.5, 'Break': 0.2 },
    Utilities:     { 'Break': 0.2 },
    Browsing:      {}                       // ambiguous → let title/domain decide
  },
  sessionLength: { longRunMs: 900_000, deepBoost: 0.3, shortHitDistractBoost: 0.2 },
  switchRate:    { churnThreshold: 6,  distractBoost: 0.3, deepPenalty: -0.3 },
  timeOfDay:     { enabled: false }
}
```

**Confidence floor:** if the top score is too low (generic browser tab, no keyword hits),
fall through to the fallback (§2.4) rather than force-guessing.

**Caching:** the scorer is pure, so cache by a stable signature hash
(`exe|domain|titleKeywordsBucket`). Live tracking sees the same context thousands of
times → effectively one scorer call per *unique* context. High-confidence results can be
persisted back to `category_rules` via the existing `upsertCategoryRule` path.

---

## 4. Renderer — where the modes appear

The existing verdict seam (`getProductivity` / `getProductivityType` in
`dataProcessor.js`) is **untouched**. We add a parallel mode seam beside it:

```js
// dataProcessor.js — new, additive
let categoryModeMap = {}                 // category → default mode  (from DB §1c)
let modeRollupMap   = {}                 // mode → verdict           (from modes.rollup)
let modeColorMap = {}, modeIconMap = {}  // from modes table

export const getMode       = (category) => categoryModeMap[category] || 'Break'
export const getModeRollup = (mode)     => modeRollupMap[mode] || 'neutral'
export const getModeColor  = (mode)     => modeColorMap[mode] || '#7a7a7a'
export const getModeIcon   = (mode)     => modeIconMap[mode]  || 'Package'
```

### Three surfaces (per your selection)

1. **New dedicated donut/chart** — a `ModeBalanceDonut` (or extend the existing
   `FocusBalanceDonut`) breaking the day's time across the 5 modes, using `modes.color`.
   The AreaChart is left alone.

2. **AreaChart drill-down** — the AreaChart keeps its productive/neutral/distracting
   bands. On hover/click of a band, show the mode split *within* that band
   (productive = Deep work + Creative + Collaboration). This needs a per-point mode
   breakdown alongside the existing verdict aggregation in the data pipeline — additive,
   the existing series stays as the outer shape.

3. **Stat cards / daily summary** — per-mode totals ("3h 20m Deep work", "45m
   Collaboration") next to the existing productivity stats.

Because rollup is DB-driven (`modes.rollup`), the drill-down's inner sum is guaranteed to
equal the outer band — no double-counting, no drift.

*(Activity-log mode labels: out of scope for this pass.)*

---

## 5. New tracking signals

The tracker already stores per-app `{ start, duration }` timestamps. Two cheap derived
signals feed the scorer, both in-memory in the preload tracking loop — no new storage:

- **sessionLen** — continuous run length in the active app; reset on foreground change.
- **switchRate** — foreground-app switches in a rolling 5-min window (ring buffer).

---

## 6. Implementation phases

**Phase 1 — mode metadata + seam (invisible)**
- `modes` table + `category_rules.mode` column + default category→mode map (§1).
- `getMode` / `getModeRollup` / `getModeColor` in `dataProcessor.js` (§4). Verdict seam
  untouched. Nothing renders yet, but modes resolve and roll up correctly.

**Phase 2 — the scorer**
- `src/main/classification/modeScorer.js` (pure) + `modeWeights.js` (§3).
- Build the signature + `sessionLen`/`switchRate` in `src/preload/index.js` (§5); add the
  signature cache. Track mode alongside category.

**Phase 3 — UI surfaces**
- Mode donut (new), AreaChart drill-down, stat-card/summary mode totals (§4).

**Phase 4 — tuning + settings**
- `CategoryRulesPanel`: pin-a-mode UI. "Why this mode?" score-breakdown affordance.

---

## 7. Key files

| File | Role |
|------|------|
| `src/main/database/schema.sql` | `modes` table, seed rows, `category_rules.mode` column, default category→mode |
| `src/main/database/localCategoriesService.js` | modes CRUD; expose `mode` on rules |
| `src/preload/index.js` | build signature; `getMode`; cache; `sessionLen`/`switchRate` |
| **`src/main/classification/modeScorer.js`** (new) | heuristic scorer |
| **`src/main/classification/modeWeights.js`** (new) | tunable weight config |
| `src/renderer/src/utils/dataProcessor.js` | `getMode`/`getModeRollup`/`getModeColor` (additive; verdict seam untouched) |
| **`FocusBalanceDonut` / new `ModeBalanceDonut`** | 5-mode donut |
| `ProductiveAreaChart` | keep 3 bands; add mode drill-down on hover/click |
| `StatCard`, `productivity-overview`, `DailySummary` | per-mode totals |
| `src/renderer/src/components/Settings/CategoryRulesPanel.jsx` | pin-a-mode UI |
