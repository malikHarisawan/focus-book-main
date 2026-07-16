import { useEffect, useState, useMemo } from 'react'
import { RefreshCw, Sun, Moon, Monitor, AlignLeft, AreaChart, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { Button } from '../ui/button'
import ProductiveAreaChart from './ProductiveAreaChart'
import DayTimeline from './DayTimeline'
import StatCard from './StatCard'
import FocusBalanceDonut from './FocusBalanceDonut'
import FocusTrendBars from './FocusTrendBars'
import ActivityLog from './ActivityLog'
import SmartDatePicker from '../shared/smart-date-picker'
import AppUsageDetails from './AppUsageDetails'
import { useDate } from '../../context/DateContext'
import { useTheme } from '../../context/ThemeContext'
import {
  processProductiveChartData,
  processCustomRangeChartData,
  getProductivityTotals,
  getModeTotals,
  getDatesForView,
  processMostUsedApps,
  refreshCategoryMapping,
  getProductivity,
  formatTime
} from '../../utils/dataProcessor'

// The five work-modes in canonical display order, each mapped to its design-system
// color token (theme-aware) so the donut and any per-mode chips stay consistent
// with the rest of the dashboard. Order matches the donut arc order.
const MODE_ORDER = ['Deep work', 'Creative', 'Collaboration', 'Break', 'Distraction']
const MODE_TOKEN = {
  'Deep work': 'var(--c-deep)',
  Creative: 'var(--c-create)',
  Collaboration: 'var(--c-comms)',
  Break: 'var(--c-break)',
  Distraction: 'var(--c-distract)'
}

// Format a millisecond/second total the same way the shipped dashboard does
// (the stored app.time values are treated as seconds by the existing cards).
const hm = (secs) => `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`

// A short monogram for an app tile (first 1-2 alnum chars).
const monogram = (name = '') => {
  const clean = name.replace(/[^a-zA-Z0-9]/g, '')
  return (clean.slice(0, 2) || name.slice(0, 2) || '?').toUpperCase()
}

// Shift a YYYY-MM-DD string by n days.
const shiftDate = (dateStr, n) => {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

export default function ProductivityOverview() {
  const [rawData, setRawData] = useState(null)
  const [currentZoomLevel, setCurrentZoomLevel] = useState('hour')
  const { selectedDate, handleDateChange } = useDate()
  const { theme, resolvedTheme, toggleTheme } = useTheme()
  const [productiveData, setProductiveData] = useState([])
  const [selectedApps, setSelectedApps] = useState([])
  const [selectedRange, setSelectedRange] = useState(null)
  const [showAppDetails, setShowAppDetails] = useState(false)
  // Chart card view: 'timeline' (reference default) shows the Day timeline;
  // 'area' shows the focused-vs-distracted area chart.
  const [chartView, setChartView] = useState('timeline')
  // Area-view granularity: 'day' | 'week' | 'month' | 'custom'.
  const [areaGran, setAreaGran] = useState('day')
  // Custom range endpoints (YYYY-MM-DD). Default: last 14 days ending today.
  const today = new Date().toISOString().split('T')[0]
  const [customStart, setCustomStart] = useState(shiftDate(today, -13))
  const [customEnd, setCustomEnd] = useState(today)

  useEffect(() => {
    loadAndProcessData()
    handleVisibilityChange()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const removeCategoryListener = window.activeWindow.onCategoryUpdated((data) => {
      console.log('Dashboard received category update:', data)
      loadAndProcessData()
    })

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (removeCategoryListener) removeCategoryListener()
    }
  }, [selectedDate])

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      loadAndProcessData()
    }
  }

  const loadAndProcessData = async () => {
    await refreshCategoryMapping()
    const jsonData = await window.activeWindow.getAppUsageStats()
    setRawData(jsonData)

    const processedProductiveChartData = processProductiveChartData(jsonData, selectedDate, 'day')
    setProductiveData(processedProductiveChartData)
  }

  // The effective window the stat cards / donut / labels should describe.
  // Timeline view is always a single day; the Area view follows its own
  // Day/Week/Month/Custom granularity control.
  const effectiveView = chartView === 'timeline' ? 'day' : areaGran // 'day'|'week'|'month'|'custom'

  // Custom-range area series (one point per day). Declared BEFORE the totals /
  // window computations that read it (they would otherwise hit the temporal
  // dead zone and crash the whole render to a white screen).
  const customRangeData = useMemo(
    () => processCustomRangeChartData(rawData, customStart, customEnd),
    [rawData, customStart, customEnd]
  )
  const customSpanDays = customRangeData.length

  // Summary totals for the effective window. Day/Week/Month use the shared
  // aggregator; Custom sums the per-day points we already computed for the chart.
  const { productiveSeconds, distractingSeconds, totalSeconds } = useMemo(() => {
    if (effectiveView === 'custom') {
      const t = customRangeData.reduce(
        (acc, p) => {
          acc.productive += p.productive
          acc.neutral += p.neutral
          acc.distracting += p.distracting
          return acc
        },
        { productive: 0, neutral: 0, distracting: 0 }
      )
      const productiveSeconds = Math.floor(t.productive)
      const neutralSeconds = Math.floor(t.neutral)
      const distractingSeconds = Math.floor(t.distracting)
      return {
        productiveSeconds,
        neutralSeconds,
        distractingSeconds,
        totalSeconds: productiveSeconds + neutralSeconds + distractingSeconds
      }
    }
    return getProductivityTotals(rawData, selectedDate, effectiveView)
  }, [effectiveView, customRangeData, rawData, selectedDate])

  const multiDay = effectiveView !== 'day'
  // Number of days the current window spans — used for daily-average math.
  const windowDays =
    effectiveView === 'custom'
      ? Math.max(1, customRangeData.length)
      : effectiveView === 'week'
        ? 7
        : effectiveView === 'month'
          ? 30
          : 1
  const scopeLabel =
    effectiveView === 'week'
      ? 'This week'
      : effectiveView === 'month'
        ? 'This month'
        : effectiveView === 'custom'
          ? `${customRangeData.length} days`
          : 'Today'

  // Focus score = productive share of (productive + distracting) time.
  const score =
    productiveSeconds + distractingSeconds > 0
      ? Math.round((productiveSeconds / (productiveSeconds + distractingSeconds)) * 100)
      : 0

  // The YYYY-MM-DD dates covered by the effective window.
  const windowDates = useMemo(() => {
    if (effectiveView === 'custom') {
      const out = []
      let s = new Date(customStart + 'T00:00:00')
      let e = new Date(customEnd + 'T00:00:00')
      if (isNaN(s) || isNaN(e)) return []
      if (s > e) [s, e] = [e, s]
      const cur = new Date(s)
      let guard = 0
      while (cur <= e && guard < 366) {
        out.push(cur.toISOString().split('T')[0])
        cur.setDate(cur.getDate() + 1)
        guard++
      }
      return out
    }
    return getDatesForView(selectedDate, effectiveView)
  }, [effectiveView, customStart, customEnd, selectedDate])

  // Distraction "sessions" — count of distinct distracting apps with tracked
  // time across the effective window.
  const distractSessions = useMemo(() => {
    if (!rawData) return 0
    const seen = new Set()
    for (const d of windowDates) {
      const apps = rawData[d]?.apps
      if (!apps) continue
      for (const [name, a] of Object.entries(apps)) {
        if (getProductivity(a.category) === 'Distracting' && a.time > 0) {
          seen.add(a.domain || a.description || name)
        }
      }
    }
    return seen.size
  }, [rawData, windowDates])

  // Work-mode totals for the current window. For a custom range we sum the
  // per-day totals; otherwise getModeTotals handles the view window directly.
  const modeTotals = useMemo(() => {
    const empty = { 'Deep work': 0, Creative: 0, Collaboration: 0, Break: 0, Distraction: 0 }
    if (effectiveView === 'custom') {
      const acc = { ...empty }
      for (const d of windowDates) {
        const { byMode } = getModeTotals(rawData, d, 'day')
        for (const m of MODE_ORDER) acc[m] += byMode[m] || 0
      }
      return acc
    }
    return getModeTotals(rawData, selectedDate, effectiveView).byMode
    // windowDates already reflects the effective window; recompute on any change.
  }, [effectiveView, rawData, selectedDate, windowDates])

  // Mode donut segments in canonical order, colored by the design-system tokens.
  const modeSegments = MODE_ORDER.map((name) => ({
    name,
    value: modeTotals[name] || 0,
    color: MODE_TOKEN[name],
    timeStr: hm(modeTotals[name] || 0)
  })).filter((s) => s.value > 0)

  // "Focus" share for the mode donut center = deep-focus modes (Deep work +
  // Creative) as a share of all tracked mode time. Distinct from the top focus
  // score (productive vs distracted); this answers "how much was deep work?".
  const modeTotalSecs = MODE_ORDER.reduce((s, m) => s + (modeTotals[m] || 0), 0)
  const deepFocusSecs = (modeTotals['Deep work'] || 0) + (modeTotals['Creative'] || 0)
  const deepFocusShare = modeTotalSecs > 0 ? Math.round((deepFocusSecs / modeTotalSecs) * 100) : 0

  // Activity log — app list for the effective window. For a single day we reuse
  // processMostUsedApps; for multi-day windows we aggregate app time across all
  // window dates, then shape it the same way (name, time-minutes, %, productivity).
  const activityApps = useMemo(() => {
    if (!rawData) return []
    if (!multiDay) {
      const list = processMostUsedApps(rawData, selectedDate) || []
      return list.map((a) => ({ ...a, mono: monogram(a.name), timeStr: `${a.time}m` }))
    }
    // Aggregate across the window (app.time is ms).
    const map = {}
    for (const d of windowDates) {
      const apps = rawData[d]?.apps
      if (!apps) continue
      for (const [name, a] of Object.entries(apps)) {
        const display = a.domain || a.description || name
        const key = display.toLowerCase()
        if (!map[key]) {
          map[key] = { name: display, ms: 0, category: a.category }
        }
        map[key].ms += a.time || 0
      }
    }
    const rows = Object.values(map).sort((x, y) => y.ms - x.ms)
    const maxMs = rows[0]?.ms || 1
    return rows.map((r) => ({
      name: r.name,
      mono: monogram(r.name),
      timeStr: `${formatTime(r.ms)}m`,
      usagePercent: r.ms / maxMs,
      productivity: getProductivity(r.category)
    }))
  }, [rawData, selectedDate, multiDay, windowDates])

  // 7-day focus trend ending at the selected date.
  const trendDays = useMemo(() => {
    const out = []
    let weekTotal = 0
    for (let i = 6; i >= 0; i--) {
      const day = shiftDate(selectedDate, -i)
      const t = getProductivityTotals(rawData, day, 'day')
      const focus = t.productiveSeconds
      weekTotal += focus
      const label = new Date(day + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
      out.push({
        key: day,
        label,
        value: focus,
        valueStr: `${formatTime(focus * 1000)}m`,
        selected: day === selectedDate
      })
    }
    return { days: out, avg: weekTotal / 7 }
  }, [rawData, selectedDate])


  const handleSelectionChange = (apps, range) => {
    setSelectedApps(apps || [])
    setSelectedRange(range)
    if (apps && apps.length > 0) setShowAppDetails(true)
  }

  const handleCategoryChange = async (app, newCategory) => {
    try {
      if (!app || !newCategory) return
      const result = await window.activeWindow.retagAppCategory(app, newCategory)
      if (!result?.success) throw new Error(result?.error || 'Retag failed')
      await refreshCategoryMapping()
      await loadAndProcessData()
    } catch (error) {
      console.error('Error changing category from dashboard:', error)
    }
  }

  const isToday = selectedDate === new Date().toISOString().split('T')[0]
  const prettyDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  })
  const ThemeIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Sun : Moon

  return (
    <div className="max-w-[1420px] mx-auto w-full px-3 pb-8 flex flex-col gap-5">
      {/* Header */}
      <header className="flex items-start justify-between gap-6 flex-wrap pt-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[26px] font-semibold tracking-tight m-0 whitespace-nowrap text-fb-text">
              Productivity Overview
            </h1>
            {isToday && (
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap"
                style={{ color: 'var(--c-create)', background: 'var(--fb-livebg)' }}
              >
                <span
                  className="w-[7px] h-[7px] rounded-full"
                  style={{ background: 'var(--c-create)', boxShadow: '0 0 0 3px var(--fb-livebg)' }}
                />
                Tracking live
              </span>
            )}
          </div>
          <p className="mt-1.5 text-fb-muted text-sm">
            {prettyDate} · {multiDay ? scopeLabel.toLowerCase() : "here's your focus breakdown"}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <SmartDatePicker
            zoomLevel={effectiveView === 'custom' ? 'day' : effectiveView}
            onDateChange={loadAndProcessData}
          />
          <Button
            onClick={toggleTheme}
            variant="outline"
            size="icon"
            className="h-10 w-10"
            title={`Theme: ${theme}`}
          >
            <ThemeIcon className="h-4 w-4" />
          </Button>
          <Button
            onClick={loadAndProcessData}
            variant="outline"
            size="icon"
            className="h-10 w-10"
            title="Refresh data"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* First-run / no-data guidance. Rather than showing a wall of zeroed cards and
          blank charts with no context, tell the user tracking is running (today) or
          that the selected window has no data (past dates). The charts below still
          render with their own tailored empty states. */}
      {totalSeconds === 0 && (
        <section
          className="flex items-start gap-3 rounded-xl border px-5 py-4"
          style={{ borderColor: 'var(--fb-border)', background: 'var(--fb-surface2)' }}
        >
          <Sparkles className="h-5 w-5 mt-0.5 flex-none" style={{ color: 'var(--c-create)' }} />
          <div className="text-sm">
            <div className="font-semibold text-fb-text">
              {isToday ? 'No activity tracked yet today' : 'No activity for this period'}
            </div>
            <div className="text-fb-muted mt-0.5">
              {isToday
                ? 'FocusBook tracks your apps automatically in the background — your focus breakdown will appear here as you work. Connect the browser extension in Settings → Integrations to track websites too.'
                : 'Nothing was recorded for the selected date range. Pick another date, or come back after some tracked activity.'}
            </div>
          </div>
        </section>
      )}

      {/* Stat cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Focus time"
          value={hm(productiveSeconds)}
          sub={multiDay ? scopeLabel : 'Productive work'}
          swatch="deep"
        />
        <StatCard
          title="Focus Score"
          value={score}
          sub={multiDay ? 'average / 100' : 'out of 100'}
          score={score}
        />
        <StatCard
          title="Distractions"
          value={hm(distractingSeconds)}
          sub={`${distractSessions} ${distractSessions === 1 ? 'app' : 'apps'}`}
          swatch="distract"
        />
        <StatCard
          title={multiDay ? 'Daily average' : 'Total tracked'}
          value={hm(multiDay ? Math.round(productiveSeconds / windowDays) : totalSeconds)}
          sub={multiDay ? 'focus per day' : 'Active time'}
          swatch="muted"
        />
      </section>

      {/* Chart card — Timeline / Area toggle */}
      <section className="rounded-[18px] border border-fb-border bg-fb-surface shadow-[var(--fb-shadow)] overflow-hidden">
        {/* Card header with the view toggle */}
        <div className="flex items-start justify-between gap-4 flex-wrap px-5 pt-5 pb-2">
          <div>
            <div className="font-display text-base font-semibold text-fb-text">
              {chartView === 'timeline' ? 'Day timeline' : 'Focus over time'}
            </div>
            <div className="text-[13px] text-fb-muted mt-0.5">
              {chartView === 'timeline'
                ? `${prettyDate} · your day at a glance`
                : 'Focused vs distracted'}
            </div>
          </div>
          <div className="flex gap-[3px] bg-fb-surface2 border border-fb-border p-[3px] rounded-[11px]">
            <ViewTab
              active={chartView === 'timeline'}
              onClick={() => setChartView('timeline')}
              icon={AlignLeft}
              label="Timeline"
            />
            <ViewTab
              active={chartView === 'area'}
              onClick={() => setChartView('area')}
              icon={AreaChart}
              label="Area"
            />
          </div>
        </div>

        {chartView === 'timeline' ? (
          <div className="px-5 pt-4 pb-6">
            <DayTimeline rawData={rawData} date={selectedDate} />
          </div>
        ) : (
          <>
            {/* Granularity control: Day / Week / Month / Custom */}
            <div className="flex items-center gap-2 flex-wrap px-5 pb-1">
              <div className="flex gap-[3px] bg-fb-surface2 border border-fb-border p-[3px] rounded-[11px]">
                {['day', 'week', 'month', 'custom'].map((g) => (
                  <button
                    key={g}
                    onClick={() => setAreaGran(g)}
                    className="rounded-lg px-3 py-[7px] text-[12.5px] font-semibold capitalize transition-all"
                    style={{
                      background: areaGran === g ? 'var(--fb-surface)' : 'transparent',
                      color: areaGran === g ? 'var(--fb-text)' : 'var(--fb-muted)',
                      boxShadow: areaGran === g ? '0 1px 3px rgba(20,20,29,.12)' : 'none'
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>

              {areaGran === 'custom' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12.5px] font-semibold text-fb-muted">From</span>
                  <input
                    type="date"
                    value={customStart}
                    max={customEnd}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="text-sm font-medium px-2.5 py-1.5 rounded-lg border border-fb-border bg-fb-surface2 text-fb-text"
                    style={{ colorScheme: resolvedTheme === 'dark' ? 'dark' : 'light' }}
                  />
                  <span className="text-[12.5px] font-semibold text-fb-muted">to</span>
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    max={today}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="text-sm font-medium px-2.5 py-1.5 rounded-lg border border-fb-border bg-fb-surface2 text-fb-text"
                    style={{ colorScheme: resolvedTheme === 'dark' ? 'dark' : 'light' }}
                  />
                  <span className="text-[12.5px] font-semibold text-fb-accent pl-1">
                    {customSpanDays} {customSpanDays === 1 ? 'day' : 'days'}
                  </span>
                </div>
              )}
            </div>

            <div className="h-[300px] w-full relative">
              {areaGran === 'custom' ? (
                <ProductiveAreaChart
                  key="custom"
                  data={customRangeData}
                  customData={customRangeData}
                  hideTabs
                  rawData={rawData}
                  selectedDate={selectedDate}
                  onSelectionChange={handleSelectionChange}
                />
              ) : (
                <ProductiveAreaChart
                  key={areaGran}
                  data={productiveData}
                  rawData={rawData}
                  selectedDate={selectedDate}
                  initialZoom={areaGran}
                  hideTabs
                  onZoomLevelChange={setCurrentZoomLevel}
                  onSelectionChange={handleSelectionChange}
                />
              )}
            </div>
          </>
        )}

        <div className="px-3 pb-3">
          <AppUsageDetails
            selectedApps={selectedApps}
            selectedRange={selectedRange}
            zoomLevel={currentZoomLevel}
            isVisible={showAppDetails}
            onCategoryChange={handleCategoryChange}
            onClose={() => setShowAppDetails(false)}
          />
        </div>
      </section>

      {/* Balance / trend / activity */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_1.25fr_1.1fr] gap-4 items-stretch">
        <FocusBalanceDonut
          segments={modeSegments}
          centerBig={`${deepFocusShare}%`}
          centerSub="deep focus"
          subtitle={multiDay ? `${scopeLabel} · how you worked` : 'How you worked'}
        />
        <FocusTrendBars
          days={trendDays.days}
          avgStr={`${hm(trendDays.avg)}`}
          onSelectDay={(day) => {
            handleDateChange(day)
          }}
          // Page the 7-day window a week at a time. The window ends at the
          // selected date, so shifting the selected date ±7 days moves it.
          onShiftWeek={(dir) => handleDateChange(shiftDate(selectedDate, dir * 7))}
          onGoToday={() => handleDateChange(new Date().toISOString().split('T')[0])}
          // Disable "next" once the window already ends at (or past) today, so
          // you can't page into the future, and hide the "today" shortcut then.
          isCurrentWeek={isToday}
        />
        <ActivityLog apps={activityApps} scope={scopeLabel} />
      </section>
    </div>
  )
}

// Segmented toggle button for the chart-card Timeline/Area switch.
function ViewTab({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-3.5 py-[7px] text-[12.5px] font-semibold transition-all"
      style={{
        background: active ? 'var(--fb-surface)' : 'transparent',
        color: active ? 'var(--fb-text)' : 'var(--fb-muted)',
        boxShadow: active ? '0 1px 3px rgba(20,20,29,.12)' : 'none'
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
