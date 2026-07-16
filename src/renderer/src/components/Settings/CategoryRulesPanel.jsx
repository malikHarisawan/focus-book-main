import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Tag, Sparkles, Pencil, Check, X, HelpCircle } from 'lucide-react'

// Span-model category + rule management. Everything here mutates the NEW `category`
// and `rule` tables (matcher_type/matcher_value/category_id). Because dashboards
// resolve spans against these rules at read time, any edit here is retroactive with
// no data migration — last month's numbers reflect the new rules instantly.
//
// Two axes, kept separate:
//   - CATEGORY: taxonomy (name) + a default productivity (the judgment).
//   - RULE: a matcher (app/domain/title/path) -> a category. Specificity is DERIVED
//     from matcher_type (title_contains < app < domain < domain_path_prefix <
//     domain_path_regex); most-specific-wins, so there is NO rule ordering to manage.

const PRODUCTIVITY = [
  { value: 'productive', label: 'Productive' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'distracting', label: 'Distracting' }
]

// Matcher types, ordered least→most specific, with a short hint for the UI.
const MATCHERS = [
  { value: 'app', label: 'App', hint: 'the program/exe, e.g. code.exe' },
  { value: 'domain', label: 'Domain', hint: 'a whole site, e.g. github.com' },
  { value: 'domain_path_prefix', label: 'Domain + path', hint: 'e.g. github.com/notifications' },
  { value: 'domain_path_regex', label: 'Domain + regex', hint: 'advanced: github.com/.*\\/pulls' },
  { value: 'title_contains', label: 'Title contains', hint: 'text in the window/page title' }
]

const prodLabel = (t) =>
  t === 'distracting' ? 'Distracting' : t === 'productive' ? 'Productive' : 'Neutral'
const matcherLabel = (t) => MATCHERS.find((m) => m.value === t)?.label || t

export default function CategoryRulesPanel() {
  const [categories, setCategories] = useState([]) // [{ id, name, default_productivity }]
  const [rules, setRules] = useState([]) // [{ id, matcher_type, matcher_value, category_id, category_name, is_user_rule }]
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  // New-category form
  const [newCatName, setNewCatName] = useState('')
  const [newCatProd, setNewCatProd] = useState('neutral')

  // New-rule form
  const [newRuleValue, setNewRuleValue] = useState('')
  const [newRuleCategory, setNewRuleCategory] = useState('')
  const [newRuleMatcher, setNewRuleMatcher] = useState('app')

  // Inline rule editing
  const [editingRuleId, setEditingRuleId] = useState(null)
  const [editDraft, setEditDraft] = useState({ matcher_value: '', category_name: '', matcher_type: 'app' })

  const api = window.activeWindow

  const load = useCallback(async () => {
    if (!api?.spanGetCategories) {
      setLoading(false)
      return
    }
    try {
      const [cats, rls] = await Promise.all([
        api.spanGetCategories(),
        api.spanGetRules ? api.spanGetRules() : Promise.resolve([])
      ])
      setCategories(Array.isArray(cats) ? cats : [])
      setRules(Array.isArray(rls) ? rls : [])
      if (!newRuleCategory && cats?.length) setNewRuleCategory(cats[0].name)
    } catch (e) {
      console.error('Failed to load span categories/rules:', e)
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
    const ok = await api.spanAddCategory(name, newCatProd)
    if (ok) {
      flash(`Added category "${name}"`)
      setNewCatName('')
      await load()
    } else {
      flash('Could not add category')
    }
  }

  const handleDeleteCategory = async (id, name) => {
    // Deleting a category also drops its classification rules (FK cascade), so
    // confirm before doing something the user can't undo from the UI.
    const confirmed = window.confirm(
      `Delete the "${name}" category? Any classification rules that point to it will also be removed. This can't be undone.`
    )
    if (!confirmed) return
    const ok = await api.spanDeleteCategory(id)
    if (ok) {
      flash(`Deleted "${name}"`)
      await load()
    }
  }

  const handleChangeProductivity = async (id, name, productivity) => {
    const ok = await api.spanUpdateCategory(id, { default_productivity: productivity })
    if (ok) {
      flash(`Updated "${name}"`)
      await load()
    }
  }

  const handleAddRule = async () => {
    const value = newRuleValue.trim()
    if (!value || !newRuleCategory) return
    const res = await api.spanAddRule({
      matcher_type: newRuleMatcher,
      matcher_value: value,
      categoryName: newRuleCategory,
      is_user_rule: 1
    })
    if (res && res.id) {
      flash(`Rule ${res.created ? 'added' : 'updated'}: "${value}" → ${newRuleCategory}`)
      setNewRuleValue('')
      await load()
    } else {
      flash('Could not add rule')
    }
  }

  const handleDeleteRule = async (id, pattern) => {
    const confirmed = window.confirm(
      `Delete the rule for "${pattern}"? Matching activity will fall back to the built-in classification.`
    )
    if (!confirmed) return
    const ok = await api.spanDeleteRule(id)
    if (ok) {
      flash('Rule deleted')
      await load()
    }
  }

  const startEditRule = (rule) => {
    setEditingRuleId(rule.id)
    setEditDraft({
      matcher_value: rule.matcher_value,
      category_name: rule.category_name,
      matcher_type: rule.matcher_type
    })
  }

  const cancelEditRule = () => setEditingRuleId(null)

  const saveEditRule = async (id) => {
    const value = editDraft.matcher_value.trim()
    if (!value || !editDraft.category_name) return
    const ok = await api.spanUpdateRule(id, {
      matcher_type: editDraft.matcher_type,
      matcher_value: value,
      categoryName: editDraft.category_name
    })
    if (ok) {
      flash('Rule updated')
      setEditingRuleId(null)
      await load()
    } else {
      flash('Could not update rule')
    }
  }

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
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          A category is a kind of activity. Its <span className="font-medium">productivity</span>{' '}
          (Productive / Neutral / Distracting) is the judgment applied to time in that category —
          change it any time without redefining the category.
        </p>
        <div className="space-y-2 mb-4">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 bg-slate-100 dark:bg-[#05070D] rounded-lg px-3 py-2"
            >
              <span className="text-sm text-slate-800 dark:text-slate-200 flex-1">{c.name}</span>
              <select
                value={c.default_productivity}
                onChange={(e) => handleChangeProductivity(c.id, c.name, e.target.value)}
                className="text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300"
              >
                {PRODUCTIVITY.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleDeleteCategory(c.id, c.name)}
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
            value={newCatProd}
            onChange={(e) => setNewCatProd(e.target.value)}
            className="text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-2 text-slate-700 dark:text-slate-300"
          >
            {PRODUCTIVITY.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
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
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 flex items-start gap-1">
          <HelpCircle className="h-3.5 w-3.5 mt-0.5 flex-none" />
          <span>
            A rule maps a matcher to a category. The <span className="font-medium">most specific</span>{' '}
            matching rule wins (app &lt; domain &lt; domain+path &lt; regex), so rule order never
            matters. Your rules always beat the built-ins.
          </span>
        </p>
        <div className="space-y-1.5 mb-4 max-h-72 overflow-y-auto pr-1">
          {rules.map((r) =>
            editingRuleId === r.id ? (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-2 text-sm bg-slate-100 dark:bg-[#05070D] rounded px-3 py-1.5"
              >
                <select
                  value={editDraft.matcher_type}
                  onChange={(e) => setEditDraft({ ...editDraft, matcher_type: e.target.value })}
                  className="text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300"
                >
                  {MATCHERS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input
                  value={editDraft.matcher_value}
                  onChange={(e) => setEditDraft({ ...editDraft, matcher_value: e.target.value })}
                  className="flex-1 min-w-[120px] text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-200"
                />
                <span className="text-slate-400">→</span>
                <select
                  value={editDraft.category_name}
                  onChange={(e) => setEditDraft({ ...editDraft, category_name: e.target.value })}
                  className="text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button onClick={() => saveEditRule(r.id)} className="text-emerald-500 hover:text-emerald-600" title="Save">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={cancelEditRule} className="text-slate-400 hover:text-slate-600" title="Cancel">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                key={r.id}
                className="flex items-center gap-2 text-sm bg-slate-100 dark:bg-[#05070D] rounded px-3 py-1.5"
              >
                <span className="text-[10px] uppercase tracking-wide text-slate-400 border border-slate-300 dark:border-slate-700 rounded px-1">
                  {matcherLabel(r.matcher_type)}
                </span>
                <code className="text-slate-700 dark:text-slate-300">{r.matcher_value}</code>
                <span className="text-slate-400">→</span>
                <span className="text-slate-800 dark:text-slate-200">{r.category_name}</span>
                {r.is_user_rule ? (
                  <span className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-700 rounded px-1">
                    yours
                  </span>
                ) : null}
                <span className="flex-1" />
                <button onClick={() => startEditRule(r)} className="text-slate-400 hover:text-cyan-500" title="Edit rule">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDeleteRule(r.id, r.matcher_value)} className="text-slate-400 hover:text-red-500" title="Delete rule">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          )}
          {rules.length === 0 && <div className="text-xs text-slate-400">No rules yet.</div>}
        </div>

        {/* Add rule */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={newRuleMatcher}
            onChange={(e) => setNewRuleMatcher(e.target.value)}
            className="text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-2 text-slate-700 dark:text-slate-300"
            title={MATCHERS.find((m) => m.value === newRuleMatcher)?.hint}
          >
            {MATCHERS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            value={newRuleValue}
            onChange={(e) => setNewRuleValue(e.target.value)}
            placeholder={MATCHERS.find((m) => m.value === newRuleMatcher)?.hint || 'Pattern'}
            className="flex-1 min-w-[160px] text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-slate-800 dark:text-slate-200"
          />
          <span className="text-slate-400">→</span>
          <select
            value={newRuleCategory}
            onChange={(e) => setNewRuleCategory(e.target.value)}
            className="text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-2 text-slate-700 dark:text-slate-300"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name} ({prodLabel(c.default_productivity)})
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
    </div>
  )
}
