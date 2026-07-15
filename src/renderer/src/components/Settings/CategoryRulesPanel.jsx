import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Tag, Sparkles, Pencil, Check, X } from 'lucide-react'
import { CategoryIcon } from '../../utils/categoryVisuals'

// Full category + rule management. Lets the user:
//  - see all categories with their productivity type / color
//  - create a category (name, type, color, icon) and delete one
//  - see classification rules (pattern -> category) and add/delete them
// Everything is DB-driven via the window.activeWindow category/rule CRUD IPC.
const TYPES = [
  { value: 'productive', label: 'Productive' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'distracted', label: 'Distracting' }
]

const typeLabel = (t) => (t === 'distracted' ? 'Distracting' : t === 'productive' ? 'Productive' : 'Neutral')

// Sentinel <option> value meaning "no mode pin — use the category's default_mode".
const NO_MODE = ''

export default function CategoryRulesPanel() {
  const [categories, setCategories] = useState([])
  const [rules, setRules] = useState([])
  const [modes, setModes] = useState([])
  const [modeOverrides, setModeOverrides] = useState({}) // { appIdentifier: modeName }
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  // New-category form
  const [newCatName, setNewCatName] = useState('')
  const [newCatType, setNewCatType] = useState('neutral')
  const [newCatColor, setNewCatColor] = useState('#7a7a7a')

  // New-rule form
  const [newRulePattern, setNewRulePattern] = useState('')
  const [newRuleCategory, setNewRuleCategory] = useState('')
  const [newRuleMatchType, setNewRuleMatchType] = useState('keyword')
  const [newRuleMode, setNewRuleMode] = useState(NO_MODE)

  // Inline rule editing: the id of the rule being edited + its draft values.
  const [editingRuleId, setEditingRuleId] = useState(null)
  const [editDraft, setEditDraft] = useState({ pattern: '', category: '', match_type: 'keyword', mode: NO_MODE })

  const api = window.activeWindow

  const load = useCallback(async () => {
    if (!api?.loadAllCategories) {
      setLoading(false)
      return
    }
    try {
      const [cats, rls, mds, overrides] = await Promise.all([
        api.loadAllCategories(),
        api.getCategoryRules ? api.getCategoryRules() : Promise.resolve([]),
        api.loadAllModes ? api.loadAllModes() : Promise.resolve([]),
        api.getModeOverrides ? api.getModeOverrides() : Promise.resolve({})
      ])
      setCategories(Array.isArray(cats) ? cats : [])
      setRules(Array.isArray(rls) ? rls : [])
      setModes(Array.isArray(mds) ? mds : [])
      setModeOverrides(overrides && typeof overrides === 'object' ? overrides : {})
      if (!newRuleCategory && cats?.length) setNewRuleCategory(cats[0].name)
    } catch (e) {
      console.error('Failed to load categories/rules:', e)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const flash = (msg) => {
    setStatus(msg)
    setTimeout(() => setStatus(''), 2500)
  }

  const handleAddCategory = async () => {
    const name = newCatName.trim()
    if (!name) return
    const ok = await api.addCategory(name, newCatType, newCatColor, undefined)
    if (ok) {
      flash(`Added category "${name}"`)
      setNewCatName('')
      await load()
    } else {
      flash('Could not add category')
    }
  }

  const handleDeleteCategory = async (name) => {
    const ok = await api.deleteCategory(name)
    if (ok) {
      flash(`Deleted "${name}"`)
      await load()
    }
  }

  const handleChangeType = async (name, type) => {
    const ok = await api.updateCategory(name, { type })
    if (ok) {
      flash(`Updated "${name}"`)
      await load()
    }
  }

  const handleAddRule = async () => {
    const pattern = newRulePattern.trim()
    if (!pattern || !newRuleCategory) return
    const ok = await api.addCategoryRule(
      pattern,
      newRuleCategory,
      newRuleMatchType,
      0,
      newRuleMode || null
    )
    if (ok) {
      flash(`Rule added: "${pattern}" → ${newRuleCategory}`)
      setNewRulePattern('')
      setNewRuleMode(NO_MODE)
      await load()
    } else {
      flash('That rule already exists')
    }
  }

  const handleDeleteOverride = async (appIdentifier) => {
    if (!api.removeModeOverride) return
    const ok = await api.removeModeOverride(appIdentifier)
    if (ok) {
      flash(`Removed mode pin for "${appIdentifier}"`)
      await load()
    }
  }

  const handleDeleteRule = async (id) => {
    const ok = await api.deleteCategoryRule(id)
    if (ok) {
      flash('Rule deleted')
      await load()
    }
  }

  const startEditRule = (rule) => {
    setEditingRuleId(rule.id)
    setEditDraft({
      pattern: rule.pattern,
      category: rule.category,
      match_type: rule.match_type,
      mode: rule.mode || NO_MODE
    })
  }

  const cancelEditRule = () => {
    setEditingRuleId(null)
  }

  const saveEditRule = async (id) => {
    const pattern = editDraft.pattern.trim()
    if (!pattern || !editDraft.category) return
    const ok = await api.updateCategoryRule(id, {
      pattern,
      category: editDraft.category,
      match_type: editDraft.match_type,
      // Send null (not '') to clear a pin, so the DB stores NULL and getMode falls
      // back to the category default.
      mode: editDraft.mode || null
    })
    if (ok) {
      flash('Rule updated')
      setEditingRuleId(null)
      await load()
    } else {
      flash('Could not update rule')
    }
  }

  // Color for a mode chip, from the loaded modes list (falls back to a neutral grey).
  const modeColor = (name) => modes.find((m) => m.name === name)?.color || '#7a7a7a'

  if (loading) {
    return <div className="text-sm text-slate-400 py-4">Loading categories…</div>
  }

  return (
    <div className="space-y-8 pt-6 border-t border-slate-200 dark:border-slate-700/30">
      {status && (
        <div className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5" /> {status}
        </div>
      )}

      {/* Categories */}
      <section>
        <h4 className="text-md font-medium text-slate-800 dark:text-slate-300 mb-3 flex items-center gap-2">
          <Tag className="h-4 w-4" /> Categories
        </h4>
        <div className="space-y-2 mb-4">
          {categories.map((c) => (
            <div
              key={c.name}
              className="flex items-center gap-3 bg-slate-100 dark:bg-[#05070D] rounded-lg px-3 py-2"
            >
              <span
                className="inline-flex items-center justify-center h-6 w-6 rounded"
                style={{ backgroundColor: `${c.color || '#7a7a7a'}22`, color: c.color || '#7a7a7a' }}
              >
                <CategoryIcon category={c.name} className="h-4 w-4" />
              </span>
              <span className="text-sm text-slate-800 dark:text-slate-200 flex-1">{c.name}</span>
              <select
                value={c.type}
                onChange={(e) => handleChangeType(c.name, e.target.value)}
                className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300"
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleDeleteCategory(c.name)}
                className="text-slate-400 hover:text-red-500"
                title={`Delete ${c.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add category */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="New category name"
            className="flex-1 min-w-[140px] text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-slate-800 dark:text-slate-200"
          />
          <select
            value={newCatType}
            onChange={(e) => setNewCatType(e.target.value)}
            className="text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-2 text-slate-700 dark:text-slate-300"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="color"
            value={newCatColor}
            onChange={(e) => setNewCatColor(e.target.value)}
            className="h-9 w-10 rounded border border-slate-300 dark:border-slate-700 bg-transparent cursor-pointer"
            title="Category color"
          />
          <button
            onClick={handleAddCategory}
            className="inline-flex items-center gap-1 text-sm bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 rounded px-3 py-2 hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </section>

      {/* Rules */}
      <section>
        <h4 className="text-md font-medium text-slate-800 dark:text-slate-300 mb-1">
          Classification Rules
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          When an app or website matches a pattern, it&apos;s put in that category. &quot;App&quot;
          matches the program/exe; &quot;Keyword&quot; matches the window title or URL. Optionally
          pin a <span className="font-medium">work-mode</span> to force how matching activity is
          counted (Deep work, Creative, …), overriding the category&apos;s default.
        </p>
        <div className="space-y-1.5 mb-4 max-h-72 overflow-y-auto pr-1">
          {rules.map((r) =>
            editingRuleId === r.id ? (
              // Edit mode: inline form to change pattern / category / match type.
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-2 text-sm bg-slate-100 dark:bg-[#05070D] rounded px-3 py-1.5"
              >
                <input
                  value={editDraft.pattern}
                  onChange={(e) => setEditDraft({ ...editDraft, pattern: e.target.value })}
                  className="flex-1 min-w-[120px] text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-200"
                />
                <span className="text-slate-400">→</span>
                <select
                  value={editDraft.category}
                  onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}
                  className="text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300"
                >
                  {categories.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={editDraft.match_type}
                  onChange={(e) => setEditDraft({ ...editDraft, match_type: e.target.value })}
                  className="text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300"
                >
                  <option value="keyword">Keyword</option>
                  <option value="app">App</option>
                </select>
                <select
                  value={editDraft.mode}
                  onChange={(e) => setEditDraft({ ...editDraft, mode: e.target.value })}
                  title="Pin a work-mode (optional)"
                  className="text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300"
                >
                  <option value={NO_MODE}>— mode: default —</option>
                  {modes.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => saveEditRule(r.id)}
                  className="text-emerald-500 hover:text-emerald-600"
                  title="Save"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={cancelEditRule}
                  className="text-slate-400 hover:text-slate-600"
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              // Read-only view with Edit + Delete actions.
              <div
                key={r.id}
                className="flex items-center gap-2 text-sm bg-slate-100 dark:bg-[#05070D] rounded px-3 py-1.5"
              >
                <code className="text-slate-700 dark:text-slate-300">{r.pattern}</code>
                <span className="text-slate-400">→</span>
                <span className="text-slate-800 dark:text-slate-200">{r.category}</span>
                <span className="text-[10px] uppercase tracking-wide text-slate-400 border border-slate-300 dark:border-slate-700 rounded px-1">
                  {r.match_type}
                </span>
                {r.mode && (
                  <span
                    className="text-[10px] font-semibold rounded px-1.5 py-0.5 flex items-center gap-1"
                    style={{ backgroundColor: `${modeColor(r.mode)}22`, color: modeColor(r.mode) }}
                    title={`Pinned work-mode: ${r.mode}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: modeColor(r.mode) }} />
                    {r.mode}
                  </span>
                )}
                <span className="flex-1" />
                <button
                  onClick={() => startEditRule(r)}
                  className="text-slate-400 hover:text-cyan-500"
                  title="Edit rule"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteRule(r.id)}
                  className="text-slate-400 hover:text-red-500"
                  title="Delete rule"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          )}
          {rules.length === 0 && (
            <div className="text-xs text-slate-400">No rules yet.</div>
          )}
        </div>

        {/* Add rule */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={newRulePattern}
            onChange={(e) => setNewRulePattern(e.target.value)}
            placeholder="Pattern (e.g. twitter, Code.exe)"
            className="flex-1 min-w-[160px] text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-slate-800 dark:text-slate-200"
          />
          <select
            value={newRuleCategory}
            onChange={(e) => setNewRuleCategory(e.target.value)}
            className="text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-2 text-slate-700 dark:text-slate-300"
          >
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({typeLabel(c.type)})
              </option>
            ))}
          </select>
          <select
            value={newRuleMatchType}
            onChange={(e) => setNewRuleMatchType(e.target.value)}
            className="text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-2 text-slate-700 dark:text-slate-300"
          >
            <option value="keyword">Keyword</option>
            <option value="app">App</option>
          </select>
          <select
            value={newRuleMode}
            onChange={(e) => setNewRuleMode(e.target.value)}
            title="Pin a work-mode (optional)"
            className="text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-2 text-slate-700 dark:text-slate-300"
          >
            <option value={NO_MODE}>— mode: default —</option>
            {modes.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddRule}
            className="inline-flex items-center gap-1 text-sm bg-slate-900 dark:bg-slate-200 text-white dark:text-slate-900 rounded px-3 py-2 hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add Rule
          </button>
        </div>
      </section>

      {/* App mode overrides — pins set from the Activity page's mode picker. This is
          a review/clear surface; the primary way to CREATE one is the Activity row. */}
      <section>
        <h4 className="text-md font-medium text-slate-800 dark:text-slate-300 mb-1">
          App Mode Overrides
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Per-app work-mode pins. Set one from the Applications list (each row&apos;s Mode
          picker); remove it here to let the app fall back to automatic mode detection.
        </p>
        <div className="space-y-1.5">
          {Object.entries(modeOverrides).length === 0 && (
            <div className="text-xs text-slate-400">
              No overrides yet. Pin a mode from the Applications page.
            </div>
          )}
          {Object.entries(modeOverrides).map(([identifier, mode]) => (
            <div
              key={identifier}
              className="flex items-center gap-2 text-sm bg-slate-100 dark:bg-[#05070D] rounded px-3 py-1.5"
            >
              <code className="text-slate-700 dark:text-slate-300 truncate max-w-[45%]">{identifier}</code>
              <span className="text-slate-400">→</span>
              <span
                className="text-[11px] font-semibold rounded px-1.5 py-0.5 flex items-center gap-1"
                style={{ backgroundColor: `${modeColor(mode)}22`, color: modeColor(mode) }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: modeColor(mode) }} />
                {mode}
              </span>
              <span className="flex-1" />
              <button
                onClick={() => handleDeleteOverride(identifier)}
                className="text-slate-400 hover:text-red-500"
                title="Remove override"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
