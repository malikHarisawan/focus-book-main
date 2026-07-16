'use client'

import { useEffect, useState, useMemo, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Search, Check, ChevronDown, RefreshCw, Info } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../hooks/use-toast'
import {
  formatAppsData,
  getProductivityType,
  refreshCategoryMapping,
  getCategoryList,
  getCategoryColorFromDB
} from '../../utils/dataProcessor'
import { useDate } from '../../context/DateContext'
import SmartDatePicker from '../shared/smart-date-picker'

// Productivity → design token color + soft background.
const PROD = {
  Productive: { color: '#1FA05A', bg: 'rgba(31,160,90,.13)' },
  Neutral: { color: 'var(--fb-muted)', bg: 'rgba(130,130,145,.14)' },
  Distracting: { color: 'var(--c-distract)', bg: 'rgba(240,89,110,.13)' }
}

// Deterministic tile color for an app, from a small on-brand palette.
const TILE_PALETTE = ['#2C7ED6', '#5B5BD6', '#2FBF9F', '#3E9BF0', '#8A5BD6', '#E0322B', '#F0A93B', '#1FA855', '#4A154B', '#0DA37F']
const tileColor = (name = '') => {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return TILE_PALETTE[h % TILE_PALETTE.length]
}
const monogram = (name = '') => {
  const clean = name.replace(/[^a-zA-Z0-9]/g, '')
  return (clean.slice(0, 2) || name.slice(0, 2) || '?').toUpperCase()
}

const getProductivityDisplay = (type) =>
  type === 'productive' ? 'Productive' : type === 'distracted' ? 'Distracting' : 'Neutral'

export default function AppUsageTable() {
  const { selectedDate } = useDate()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [apps, setApps] = useState([])
  const [categories, setCategories] = useState(() => getCategoryList())
  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState('all') // 'all' | category name
  const [sortKey, setSortKey] = useState('time') // 'time' | 'name'
  const [sortDir, setSortDir] = useState('desc')
  // Category menu: which app's menu is open + the anchor button's screen rect.
  // Rendered via a portal with fixed positioning so it escapes the table card's
  // `overflow-hidden` (which was clipping the dropdown).
  const [openCat, setOpenCat] = useState(null)
  const [menuRect, setMenuRect] = useState(null)

  const openCategoryMenu = (appId, e) => {
    if (openCat === appId) {
      setOpenCat(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuRect(rect)
    setOpenCat(appId)
  }

  useEffect(() => {
    loadApps()
    const onVis = () => document.visibilityState === 'visible' && loadApps()
    document.addEventListener('visibilitychange', onVis)
    const removeListener = window.activeWindow.onCategoryUpdated(() => loadApps())
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      if (removeListener) removeListener()
    }
  }, [selectedDate])

  async function loadApps() {
    await refreshCategoryMapping()
    const list = getCategoryList()
    if (list.length > 0) setCategories(list)
    const jsonData = await window.activeWindow.getAppUsageStats()
    setApps(formatAppsData(jsonData, selectedDate))
  }

  // Rule-based category change (creates/updates a classification rule + retags
  // history), with the same toast feedback the old page had.
  const handleCategoryChange = async (appId, newCategory) => {
    const app = apps.find((a) => a.id === appId)
    if (!app) return
    const newProductivity = getProductivityDisplay(getProductivityType(newCategory))
    // Optimistic update.
    setApps((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, category: newCategory, productivity: newProductivity } : a))
    )
    setOpenCat(null)
    try {
      const result = await window.activeWindow.retagAppCategory(app, newCategory)
      if (!result?.success) throw new Error(result?.error || 'Retag failed')
      const scope =
        result.matchType === 'domain' ? `All "${result.pattern}" activity` : `"${app.name}"`
      toast({
        title: result.ruleCreated ? 'Rule created' : 'Rule updated',
        description: `${scope} is now categorized as "${newCategory}".`,
        duration: 3500
      })
      await refreshCategoryMapping()
      await loadApps()
    } catch (error) {
      console.error('Failed to save category change:', error)
      await loadApps()
      toast({ title: 'Error', description: 'Failed to save category change.', variant: 'destructive' })
    }
  }


  // Totals by productivity (seconds).
  const totals = useMemo(() => {
    const t = { Productive: 0, Neutral: 0, Distracting: 0, total: 0 }
    for (const a of apps) {
      t[a.productivity] = (t[a.productivity] || 0) + a.timeSpentSeconds
      t.total += a.timeSpentSeconds
    }
    return t
  }, [apps])

  const fmt = (secs) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    if (h && m) return `${h}h ${m}m`
    if (h) return `${h}h`
    return `${m}m`
  }
  const pct = (v) => (totals.total > 0 ? Math.round((v / totals.total) * 100) : 0)

  // Only apps with meaningful time; filter + sort.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const maxSecs = Math.max(1, ...apps.map((a) => a.timeSpentSeconds))
    let list = apps.filter((a) => a.timeSpentSeconds > 60)
    if (catFilter !== 'all') list = list.filter((a) => a.category === catFilter)
    if (q) list = list.filter((a) => a.name.toLowerCase().includes(q))
    list.sort((a, b) => {
      const r =
        sortKey === 'name'
          ? a.name.toLowerCase().localeCompare(b.name.toLowerCase())
          : a.timeSpentSeconds - b.timeSpentSeconds
      return sortDir === 'asc' ? r : -r
    })
    return list.map((a) => ({
      ...a,
      mono: monogram(a.name),
      tile: tileColor(a.name),
      barPct: Math.round((a.timeSpentSeconds / maxSecs) * 100)
    }))
  }, [apps, query, catFilter, sortKey, sortDir])

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }
  const arrow = (key) => (sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '')

  const isToday = selectedDate === new Date().toISOString().split('T')[0]
  const prettyDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  })

  return (
    <div className="max-w-[1420px] mx-auto w-full px-3 pb-8 flex flex-col gap-5">
      {/* Header */}
      <header className="flex items-start justify-between gap-6 flex-wrap pt-3">
        <div>
          <h1 className="font-display text-[26px] font-semibold tracking-tight m-0 text-fb-text">Applications</h1>
          <p className="mt-1.5 text-fb-muted text-sm">
            {prettyDate} · {apps.filter((a) => a.timeSpentSeconds > 60).length} apps tracked{isToday ? ' today' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <SmartDatePicker zoomLevel="day" onDateChange={loadApps} />
          <button
            onClick={loadApps}
            className="h-10 w-10 rounded-lg border border-fb-border bg-fb-surface text-fb-muted hover:text-fb-accent hover:border-fb-accent flex items-center justify-center transition-all"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Summary bar */}
      <section className="rounded-[18px] border border-fb-border bg-fb-surface shadow-[var(--fb-shadow)] px-6 py-5 flex items-center gap-8 flex-wrap">
        <div className="flex-none">
          <div className="text-[13px] font-semibold text-fb-muted">Total active time</div>
          <div className="font-display text-[36px] font-semibold tracking-tight mt-2 leading-none text-fb-text">
            {fmt(totals.total)}
          </div>
        </div>
        <div className="flex-1 min-w-[280px]">
          <div className="flex h-3.5 rounded-lg overflow-hidden gap-0.5" style={{ background: 'var(--fb-track)' }}>
            <div style={{ width: `${pct(totals.Productive)}%`, background: '#1FA05A' }} />
            <div style={{ width: `${pct(totals.Neutral)}%`, background: 'var(--fb-muted)' }} />
            <div style={{ width: `${pct(totals.Distracting)}%`, background: 'var(--c-distract)' }} />
          </div>
          <div className="flex gap-6 mt-3.5 flex-wrap">
            <LegendStat color="#1FA05A" label="Productive" value={fmt(totals.Productive)} />
            <LegendStat color="var(--fb-muted)" label="Neutral" value={fmt(totals.Neutral)} />
            <LegendStat color="var(--c-distract)" label="Distracting" value={fmt(totals.Distracting)} />
          </div>
        </div>
      </section>

      {/* Search + category filter chips */}
      <div className="flex items-center gap-3.5 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-[340px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-fb-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search applications"
            className="w-full text-[13.5px] py-2.5 pl-9 pr-3.5 rounded-xl border border-fb-border bg-fb-surface text-fb-text placeholder:text-fb-muted outline-none focus:border-fb-accent transition-colors"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap flex-1">
          <Chip active={catFilter === 'all'} onClick={() => setCatFilter('all')} label="All apps" />
          {categories.map((c) => (
            <Chip
              key={c.name}
              active={catFilter === c.name}
              onClick={() => setCatFilter(c.name)}
              label={c.name}
              dot={getCategoryColorFromDB(c.name)}
            />
          ))}
        </div>
      </div>

      {/* Table */}
      <section className="rounded-[18px] border border-fb-border bg-fb-surface shadow-[var(--fb-shadow)] overflow-hidden">
        {/* Column header */}
        <div className="grid grid-cols-[2.4fr_1.7fr_1.4fr_1fr] gap-4 px-6 py-4 border-b border-fb-border items-center">
          <button onClick={() => toggleSort('name')} className="flex items-center gap-1.5 text-left text-[12.5px] font-semibold uppercase tracking-wide text-fb-muted">
            Application <span className="text-fb-accent text-[11px]">{arrow('name')}</span>
          </button>
          <div className="text-[12.5px] font-semibold uppercase tracking-wide text-fb-muted">Category</div>
          <button onClick={() => toggleSort('time')} className="flex items-center gap-1.5 text-left text-[12.5px] font-semibold uppercase tracking-wide text-fb-muted">
            Time spent <span className="text-fb-accent text-[11px]">{arrow('time')}</span>
          </button>
          <div className="text-[12.5px] font-semibold uppercase tracking-wide text-fb-muted">Productivity</div>
        </div>

        {/* Rows */}
        {rows.map((r) => {
          const pm = PROD[r.productivity] || PROD.Neutral
          const catColor = getCategoryColorFromDB(r.category)
          return (
            <div
              key={r.id}
              className="grid grid-cols-[2.4fr_1.7fr_1.4fr_1fr] gap-4 px-6 py-3.5 items-center transition-colors hover:bg-fb-surface2"
              style={{ borderBottom: '1px solid var(--fb-rowline, var(--fb-border))' }}
            >
              {/* App */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-[11px] flex-none flex items-center justify-center text-white font-display font-semibold text-sm"
                  style={{ background: r.tile }}
                >
                  {r.mono}
                </div>
                <span className="text-[14.5px] font-semibold truncate text-fb-text">{r.name}</span>
                {r.degraded && (
                  <span
                    className="inline-flex items-center gap-1 flex-none text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md text-amber-600 dark:text-amber-400 bg-amber-400/15"
                    title="Estimated: this browsing time was matched from the window title, not a live tab URL. Connect the browser extension for exact site tracking."
                  >
                    <Info className="h-3 w-3" />
                    Est.
                  </span>
                )}
              </div>

              {/* Category — opens a portal-rendered menu (see below) */}
              <div onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => openCategoryMenu(r.id, e)}
                  className="inline-flex items-center gap-2 text-[12.5px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all hover:border-fb-accent"
                  style={{ borderColor: 'var(--fb-border)', color: catColor }}
                >
                  <span className="w-2 h-2 rounded-[3px]" style={{ background: catColor }} />
                  {r.category}
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </div>

              {/* Time */}
              <div>
                <div className="font-display text-[15px] font-semibold text-fb-text">{fmt(r.timeSpentSeconds)}</div>
                <div className="h-[5px] rounded-full mt-1.5 max-w-[150px] overflow-hidden" style={{ background: 'var(--fb-track)' }}>
                  <div className="h-full rounded-full" style={{ width: `${r.barPct}%`, background: catColor }} />
                </div>
              </div>

              {/* Productivity badge */}
              <div>
                <span
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-2.5 py-1 rounded-lg"
                  style={{ color: pm.color, background: pm.bg }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: pm.color }} />
                  {r.productivity}
                </span>
              </div>
            </div>
          )
        })}

        {rows.length === 0 && (
          <div className="py-12 text-center text-fb-muted text-sm">
            {apps.length === 0 ? 'No activity tracked for this day.' : 'No applications match your search.'}
          </div>
        )}
      </section>

      {/* Category menu — portal-rendered so it never gets clipped by the table
          card's overflow-hidden, and flips upward when near the viewport bottom. */}
      {openCat != null && menuRect && (
        <CategoryMenu
          rect={menuRect}
          categories={categories}
          current={apps.find((a) => a.id === openCat)?.category}
          onPick={(name) => handleCategoryChange(openCat, name)}
          onManage={() => {
            setOpenCat(null)
            navigate('/settings?tab=Categories Management')
          }}
          onClose={() => setOpenCat(null)}
        />
      )}
    </div>
  )
}

// Fixed-positioned category picker rendered into document.body via a portal.
function CategoryMenu({ rect, categories, current, onPick, onManage, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: rect.left, top: rect.bottom + 6, flip: false })

  // After mount, measure the menu and decide whether to flip above the anchor
  // and/or shift left so it stays within the viewport.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const mh = el.offsetHeight
    const mw = el.offsetWidth
    const margin = 8
    const spaceBelow = window.innerHeight - rect.bottom
    const flip = spaceBelow < mh + margin && rect.top > mh + margin
    let left = rect.left
    if (left + mw > window.innerWidth - margin) left = window.innerWidth - mw - margin
    if (left < margin) left = margin
    const top = flip ? rect.top - mh - 6 : rect.bottom + 6
    setPos({ left, top, flip })
  }, [rect])

  // Close on outside click, scroll, or Escape.
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onClose, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[100] rounded-xl border border-fb-border bg-fb-surface shadow-xl p-1.5 min-w-[200px] max-h-[60vh] overflow-y-auto custom-scrollbar"
      style={{ left: pos.left, top: pos.top }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-[11px] font-bold uppercase tracking-wide text-fb-muted px-2.5 pt-2 pb-1.5">
        Set category
      </div>
      {categories.map((c) => {
        const active = c.name === current
        return (
          <button
            key={c.name}
            onClick={() => onPick(c.name)}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors hover:bg-fb-surface2"
            style={{ background: active ? 'var(--fb-surface2)' : 'transparent' }}
          >
            <span className="w-2.5 h-2.5 rounded-[3px] flex-none" style={{ background: getCategoryColorFromDB(c.name) }} />
            <span className="text-[13.5px] font-medium flex-1 text-left text-fb-text">{c.name}</span>
            {active && <Check className="h-3.5 w-3.5 text-fb-accent" />}
          </button>
        )
      })}
      <div className="border-t border-fb-border mt-1 pt-1">
        <button
          onClick={onManage}
          className="w-full text-left text-[12px] font-semibold text-fb-accent px-2.5 py-2 rounded-lg hover:bg-fb-surface2"
        >
          Manage all rules →
        </button>
      </div>
    </div>,
    document.body
  )
}

function LegendStat({ color, label, value }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: color }} />
      <span className="text-[13px] font-semibold text-fb-text">{label}</span>
      <span className="font-display text-[13px] font-semibold text-fb-muted">{value}</span>
    </div>
  )
}

function Chip({ active, onClick, label, dot }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-[12.5px] font-semibold px-3 py-1.5 rounded-full border transition-all"
      style={{
        borderColor: active ? 'var(--fb-accent)' : 'var(--fb-border)',
        background: active ? 'var(--fb-accentsoft)' : 'var(--fb-surface)',
        color: active ? 'var(--fb-accent)' : 'var(--fb-muted)'
      }}
    >
      {dot && <span className="w-2 h-2 rounded-[3px]" style={{ background: dot }} />}
      {label}
    </button>
  )
}
