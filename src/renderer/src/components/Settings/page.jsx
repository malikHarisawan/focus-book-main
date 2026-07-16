'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTheme, colorSchemes } from '../../context/ThemeContext'
import BrowserBridgePanel from './BrowserBridgePanel'
import CategoryRulesPanel from './CategoryRulesPanel'
import GettingStartedPanel from './GettingStartedPanel'
import { toCSV, toJSON } from '../../utils/exportUtils'
import {
  Settings,
  Palette,
  Lock,
  Database,
  Globe,
  Moon,
  Sun,
  Trash2,
  Download,
  Check,
  Sparkles,
  Shield,
  Power,
  AlertTriangle
} from 'lucide-react'

export default function SettingsPage() {
  // Honor a ?tab= deep link (e.g. from Activity's "Manage all rules" link) so
  // we can open directly on the Categories Management tab.
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'getting-started')
  const { theme, resolvedTheme, setThemeMode, primaryColor, secondaryColor, setPrimaryAccent, setSecondaryAccent } = useTheme()

  const [isExporting, setIsExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState(null) // { ok, message }
  const [exportFrom, setExportFrom] = useState('') // YYYY-MM-DD, blank = no lower bound
  const [exportTo, setExportTo] = useState('') // YYYY-MM-DD, blank = no upper bound

  // Real data deletion. `confirmDelete` holds the pending scope ('history' | 'all')
  // while the confirm modal is open; deleteStatus surfaces the result.
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteStatus, setDeleteStatus] = useState(null) // { ok, message }

  // Focus & blocking settings (persisted in ui-state.json via setBlockingSettings).
  const [blockingEnabled, setBlockingEnabled] = useState(true)
  const [minProductiveMin, setMinProductiveMin] = useState(5)
  const [sessionMin, setSessionMin] = useState(25)
  const [blockingStatus, setBlockingStatus] = useState(null)

  // Startup (launch-on-login) toggle.
  const [autoLaunch, setAutoLaunch] = useState(false)
  const [autoLaunchStatus, setAutoLaunchStatus] = useState(null)

  // Export the full app-usage history as CSV or JSON. The renderer already has
  // the data via getAllAggregatedData(); we serialize here and hand the string
  // to the main process, which shows a native Save dialog and writes the file.
  const handleExport = async (format) => {
    const fmt = format.toLowerCase()
    if (exportFrom && exportTo && exportFrom > exportTo) {
      setExportStatus({ ok: false, message: '"From" date must be on or before "To" date.' })
      return
    }
    setIsExporting(true)
    setExportStatus(null)
    try {
      const hasRange = exportFrom || exportTo
      const data = hasRange
        ? await window.electronAPI.getFormattedUsageData(
            exportFrom || '0000-01-01',
            exportTo || '9999-12-31'
          )
        : await window.electronAPI.getAllAggregatedData()
      if (!data || data.error) {
        throw new Error(data?.error || 'Could not load usage data')
      }
      if (Object.keys(data).length === 0) {
        setExportStatus({
          ok: false,
          message: hasRange ? 'No usage data in that date range.' : 'No usage data to export yet.'
        })
        return
      }

      const exportedAt = new Date().toISOString()
      const content = fmt === 'json' ? toJSON(data, exportedAt) : toCSV(data)
      const stamp = exportedAt.slice(0, 10)
      const rangeSuffix = hasRange ? `-${exportFrom || 'start'}_to_${exportTo || 'end'}` : ''
      const defaultName = `focusbook-usage${rangeSuffix}-${stamp}.${fmt}`

      const result = await window.electronAPI.exportData({ content, format: fmt, defaultName })
      if (result?.success) {
        setExportStatus({ ok: true, message: `Exported to ${result.filePath}` })
      } else if (result?.canceled) {
        setExportStatus(null)
      } else {
        throw new Error(result?.error || 'Export failed')
      }
    } catch (error) {
      console.error('Export error:', error)
      setExportStatus({ ok: false, message: `Export failed: ${error.message}` })
    } finally {
      setIsExporting(false)
    }
  }

  // Perform the deletion the user confirmed. scope 'history' keeps focus-session
  // records; 'all' clears them too. Categories/rules/settings are always preserved.
  const runDelete = async () => {
    const scope = confirmDelete
    if (!scope) return
    setIsDeleting(true)
    setDeleteStatus(null)
    try {
      const result = await window.electronAPI.deleteActivityData(scope)
      if (result?.success) {
        setDeleteStatus({
          ok: true,
          message:
            scope === 'all'
              ? 'All activity and focus-session history deleted.'
              : 'Activity history deleted.'
        })
      } else {
        throw new Error(result?.error || 'Delete failed')
      }
    } catch (error) {
      console.error('Delete error:', error)
      setDeleteStatus({ ok: false, message: `Delete failed: ${error.message}` })
    } finally {
      setIsDeleting(false)
      setConfirmDelete(null)
    }
  }

  // Load persisted blocking + auto-launch state when the relevant tabs mount.
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const blocking = await window.electronAPI.getBlockingSettings?.()
        if (active && blocking && typeof blocking === 'object') {
          if (typeof blocking.enabled === 'boolean') setBlockingEnabled(blocking.enabled)
          if (Number.isFinite(blocking.minProductiveMs))
            setMinProductiveMin(Math.round(blocking.minProductiveMs / 60000))
          if (Number.isFinite(blocking.sessionMs))
            setSessionMin(Math.round(blocking.sessionMs / 60000))
        }
      } catch (error) {
        console.error('Error loading blocking settings:', error)
      }
      try {
        const status = await window.electronAPI.getAutoLaunchStatus?.()
        if (active && status && typeof status.enabled === 'boolean') setAutoLaunch(status.enabled)
      } catch (error) {
        console.error('Error loading auto-launch status:', error)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const persistBlocking = async (patch) => {
    setBlockingStatus(null)
    try {
      const result = await window.electronAPI.setBlockingSettings?.(patch)
      if (result?.success) {
        setBlockingStatus({ ok: true, message: 'Saved.' })
      } else {
        throw new Error(result?.error || 'Could not save')
      }
    } catch (error) {
      console.error('Error saving blocking settings:', error)
      setBlockingStatus({ ok: false, message: `Could not save: ${error.message}` })
    }
  }

  const toggleBlocking = async () => {
    const next = !blockingEnabled
    setBlockingEnabled(next)
    await persistBlocking({ enabled: next })
  }

  const commitThresholds = async () => {
    const min = Math.max(1, Math.min(120, Number(minProductiveMin) || 5))
    const session = Math.max(1, Math.min(180, Number(sessionMin) || 25))
    setMinProductiveMin(min)
    setSessionMin(session)
    await persistBlocking({ minProductiveMs: min * 60000, sessionMs: session * 60000 })
  }

  const toggleAutoLaunch = async () => {
    const next = !autoLaunch
    setAutoLaunch(next)
    setAutoLaunchStatus(null)
    try {
      const result = await window.electronAPI.setAutoLaunch?.(next)
      if (result?.success) {
        setAutoLaunchStatus({ ok: true, message: next ? 'FocusBook will start with Windows.' : 'Startup disabled.' })
      } else {
        throw new Error(result?.error || 'Could not update startup setting')
      }
    } catch (error) {
      console.error('Error setting auto-launch:', error)
      setAutoLaunch(!next) // revert optimistic toggle on failure
      setAutoLaunchStatus({ ok: false, message: `Could not update: ${error.message}` })
    }
  }

  const Toggle = ({ on, onClick }) => (
    <button
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        on ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          on ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )

  return (
    <div className="grid gap-4">
      <div className="bg-white dark:bg-[#0B1220] border border-[#E8EDF1] dark:border-[#1E293B] backdrop-blur-sm rounded-lg overflow-hidden">
        <div className="border-b border-[#E8EDF1] dark:border-[#1E293B] pb-2 p-4">
          <h2 className="text-[#232360] dark:text-white flex items-center text-lg font-semibold">
            <Settings className="mr-2 h-5 w-5 text-[#5051F9]" />
            Settings
          </h2>
          <p className="text-[#768396] text-sm mt-0.5">Configure your productivity dashboard preferences</p>
        </div>

        <div className="grid grid-cols-12 min-h-[600px]">
          {/* Settings Navigation */}
          <div className="col-span-12 md:col-span-3 border-r border-[#E8EDF1] dark:border-[#1E293B]">
            <nav className="p-3">
              <ul className="space-y-0.5">
                {[
                  { id: 'getting-started', label: 'Getting Started', icon: Sparkles },
                  { id: 'appearance', label: 'Appearance', icon: Palette },
                  { id: 'focus', label: 'Focus & Blocking', icon: Shield },
                  { id: 'Categories Management', label: 'Categories Management', icon: Lock },
                  { id: 'data', label: 'Data Management', icon: Database },
                  { id: 'integrations', label: 'Integrations', icon: Globe },
                  { id: 'startup', label: 'Startup', icon: Power }
                ].map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full text-left px-4 py-3 rounded-md flex items-center transition-colors ${
                        activeTab === item.id
                          ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-l-2 border-cyan-500'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      <item.icon className="h-4 w-4 mr-3" />
                      <span>{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Settings Content */}
          <div className="col-span-12 md:col-span-9 p-6">
            {/* Getting Started */}
            {activeTab === 'getting-started' && <GettingStartedPanel onNavigateTab={setActiveTab} />}

            {/* Appearance Settings — theme + accent colors (fully wired to ThemeContext) */}
            {activeTab === 'appearance' && (
              <div className="space-y-6 animate-fadeIn">
                <h3 className="text-lg font-medium text-[#232360] dark:text-white border-b border-[#E8EDF1] dark:border-[#1E293B] pb-2">
                  Appearance
                </h3>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-md font-medium text-[#232360] dark:text-white mb-3">Theme</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        onClick={() => setThemeMode('dark')}
                        className={`p-4 rounded-xl border-2 ${
                          theme === 'dark'
                            ? 'border-[#5051F9] bg-[#5051F9]/10 dark:bg-[#5051F9]/20 ring-1 ring-[#5051F9]/50'
                            : 'border-[#E8EDF1] dark:border-[#1E293B] bg-white dark:bg-[#0B1220] hover:bg-[#F4F7FE] dark:hover:bg-[#1E293B]'
                        } transition-all`}
                      >
                        <div className="flex justify-center mb-2">
                          <Moon className="h-8 w-8 text-[#5051F9]" />
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-[#232360] dark:text-white">Dark</div>
                          <div className="text-xs text-[#768396]">Default dark theme</div>
                        </div>
                      </button>

                      <button
                        onClick={() => setThemeMode('light')}
                        className={`p-4 rounded-xl border-2 ${
                          theme === 'light'
                            ? 'border-[#5051F9] bg-[#5051F9]/10 ring-1 ring-[#5051F9]/50'
                            : 'border-[#E8EDF1] dark:border-[#1E293B] bg-white dark:bg-[#0B1220] hover:bg-[#F4F7FE] dark:hover:bg-[#1E293B]'
                        } transition-all`}
                      >
                        <div className="flex justify-center mb-2">
                          <Sun className="h-8 w-8 text-[#FF6B6B]" />
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-[#232360] dark:text-white">Light</div>
                          <div className="text-xs text-[#768396]">Bright mode</div>
                        </div>
                      </button>

                      <button
                        onClick={() => setThemeMode('system')}
                        className={`p-4 rounded-xl border-2 ${
                          theme === 'system'
                            ? 'border-[#22D3EE] bg-[#22D3EE]/10 ring-1 ring-[#22D3EE]/50'
                            : 'border-[#E8EDF1] dark:border-[#1E293B] bg-white dark:bg-[#0B1220] hover:bg-[#F4F7FE] dark:hover:bg-[#1E293B]'
                        } transition-all`}
                      >
                        <div className="flex justify-center mb-2">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-r from-[#F4F7FE] to-[#05070D] flex items-center justify-center">
                            <Settings className="h-5 w-5 text-[#232360] dark:text-white" />
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-[#232360] dark:text-white">System</div>
                          <div className="text-xs text-[#768396]">Follow system</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Primary Accent Color */}
                  <div className="pt-4 border-t border-[#E8EDF1] dark:border-[#1E293B]">
                    <h4 className="text-md font-medium text-[#232360] dark:text-white mb-2">Primary Accent Color</h4>
                    <p className="text-sm text-[#768396] mb-3">Used for buttons, active states, and primary elements</p>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(colorSchemes.primary).map(([key, value]) => (
                        <button
                          key={key}
                          onClick={() => setPrimaryAccent(key)}
                          className={`relative w-12 h-12 rounded-xl transition-all ${
                            primaryColor === key
                              ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#05070D] ring-[#2B3674] dark:ring-white scale-110'
                              : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: theme === 'dark' ? value.dark : value.light }}
                          aria-label={`${value.name} accent color`}
                          title={value.name}
                        >
                          {primaryColor === key && (
                            <Check className="absolute inset-0 m-auto h-5 w-5 text-white" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Secondary Accent Color */}
                  <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#1E293B]">
                    <h4 className="text-md font-medium text-[#2B3674] dark:text-white mb-2">Secondary Accent Color</h4>
                    <p className="text-sm text-[#A3AED0] mb-3">Used for charts, graphs, and secondary elements</p>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(colorSchemes.secondary).map(([key, value]) => (
                        <button
                          key={key}
                          onClick={() => setSecondaryAccent(key)}
                          className={`relative w-12 h-12 rounded-xl transition-all ${
                            secondaryColor === key
                              ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#05070D] ring-[#2B3674] dark:ring-white scale-110'
                              : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: theme === 'dark' ? value.dark : value.light }}
                          aria-label={`${value.name} accent color`}
                          title={value.name}
                        >
                          {secondaryColor === key && (
                            <Check className="absolute inset-0 m-auto h-5 w-5 text-white" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Focus & Blocking — real, persisted controls for the distraction popup. */}
            {activeTab === 'focus' && (
              <div className="space-y-6 animate-fadeIn">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700/30 pb-2">
                  Focus &amp; Blocking
                </h3>

                <div className="bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-slate-800 dark:text-slate-200 font-medium">Distraction blocking</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                        When on, FocusBook auto-starts a focus session after a stretch of productive
                        work and shows a fullscreen prompt if you switch to a distracting app. Turn it
                        off to track your time without any interruptions.
                      </div>
                    </div>
                    <Toggle on={blockingEnabled} onClick={toggleBlocking} />
                  </div>
                </div>

                <div
                  className={`bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-lg p-4 space-y-4 transition-opacity ${
                    blockingEnabled ? '' : 'opacity-50 pointer-events-none'
                  }`}
                >
                  <h4 className="text-md font-medium text-slate-800 dark:text-slate-300">Timing</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                        Productive minutes before a session starts
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={minProductiveMin}
                        onChange={(e) => setMinProductiveMin(e.target.value)}
                        onBlur={commitThresholds}
                        className="w-full bg-white dark:bg-[#03050A] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                        Focus session length (minutes)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={180}
                        value={sessionMin}
                        onChange={(e) => setSessionMin(e.target.value)}
                        onBlur={commitThresholds}
                        className="w-full bg-white dark:bg-[#03050A] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    Changes apply immediately — no restart needed.
                  </p>
                </div>

                {blockingStatus && (
                  <p
                    className={`text-sm ${
                      blockingStatus.ok
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-500 dark:text-rose-400'
                    }`}
                  >
                    {blockingStatus.message}
                  </p>
                )}
              </div>
            )}

            {/* Categories Management */}
            {activeTab === 'Categories Management' && (
              <div className="space-y-6 animate-fadeIn">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700/30 pb-2">
                  Manage Categories
                </h3>
                <CategoryRulesPanel />
              </div>
            )}

            {/* Data Management — Export (real) + real, confirmed data deletion. */}
            {activeTab === 'data' && (
              <div className="space-y-6 animate-fadeIn">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700/30 pb-2">
                  Data Management
                </h3>

                <div className="space-y-6">
                  <div className="bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-lg p-4">
                    <h4 className="text-md font-medium text-slate-800 dark:text-slate-300 mb-2 flex items-center">
                      <Download className="h-4 w-4 mr-2 text-cyan-500" />
                      Export Data
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                      Download your productivity data. Everything stays on your machine.
                    </p>

                    <div className="flex flex-wrap items-end gap-3 mb-4">
                      <div className="flex flex-col">
                        <label className="text-xs text-slate-500 dark:text-slate-400 mb-1">From</label>
                        <input
                          type="date"
                          value={exportFrom}
                          max={exportTo || undefined}
                          onChange={(e) => setExportFrom(e.target.value)}
                          style={{ colorScheme: resolvedTheme === 'dark' ? 'dark' : 'light' }}
                          className="text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-xs text-slate-500 dark:text-slate-400 mb-1">To</label>
                        <input
                          type="date"
                          value={exportTo}
                          min={exportFrom || undefined}
                          onChange={(e) => setExportTo(e.target.value)}
                          style={{ colorScheme: resolvedTheme === 'dark' ? 'dark' : 'light' }}
                          className="text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1.5 text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      {(exportFrom || exportTo) && (
                        <button
                          onClick={() => {
                            setExportFrom('')
                            setExportTo('')
                          }}
                          className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline pb-2"
                        >
                          Clear
                        </button>
                      )}
                      <span className="text-xs text-slate-400 pb-2">
                        {exportFrom || exportTo ? 'Exporting selected range' : 'Exporting all history'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { format: 'CSV', icon: '📊', desc: 'Spreadsheet compatible' },
                        { format: 'JSON', icon: '{ }', desc: 'Developer friendly' }
                      ].map((item) => (
                        <button
                          key={item.format}
                          onClick={() => handleExport(item.format)}
                          disabled={isExporting}
                          className="flex flex-col items-center justify-center p-4 bg-slate-100 dark:bg-[#05070D] hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="text-2xl mb-2">{item.icon}</div>
                          <div className="font-medium text-slate-800 dark:text-slate-200">{item.format}</div>
                          <div className="text-xs text-slate-400">{item.desc}</div>
                        </button>
                      ))}
                    </div>
                    {exportStatus && (
                      <p
                        className={`text-sm mt-3 ${
                          exportStatus.ok
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-500 dark:text-rose-400'
                        }`}
                      >
                        {exportStatus.message}
                      </p>
                    )}
                  </div>

                  {/* Delete Data — real, irreversible. Categories and rules are preserved. */}
                  <div className="bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-lg p-4">
                    <h4 className="text-md font-medium text-slate-800 dark:text-slate-300 mb-2 flex items-center">
                      <Trash2 className="h-4 w-4 mr-2 text-rose-500" />
                      Delete Data
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                      Permanently delete your recorded activity. Your categories and classification
                      rules are kept — only the history is removed. This cannot be undone.
                    </p>

                    <div className="space-y-3">
                      <button
                        onClick={() => {
                          setDeleteStatus(null)
                          setConfirmDelete('history')
                        }}
                        className="w-full flex justify-between items-center p-3 bg-slate-100 dark:bg-[#05070D] hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700/30 rounded-lg transition-colors"
                      >
                        <span className="text-slate-700 dark:text-slate-300">Clear activity history</span>
                        <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded">
                          Keeps focus sessions
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setDeleteStatus(null)
                          setConfirmDelete('all')
                        }}
                        className="w-full flex justify-between items-center p-3 bg-rose-900/20 hover:bg-rose-900/30 border border-rose-900/50 rounded-lg transition-colors"
                      >
                        <span className="text-rose-500 dark:text-rose-400">Delete all activity data</span>
                        <span className="text-xs bg-rose-900/50 text-rose-300 px-2 py-1 rounded">Permanent</span>
                      </button>
                    </div>

                    {deleteStatus && (
                      <p
                        className={`text-sm mt-3 ${
                          deleteStatus.ok
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-500 dark:text-rose-400'
                        }`}
                      >
                        {deleteStatus.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Integrations — the real browser-extension bridge only. */}
            {activeTab === 'integrations' && (
              <div className="space-y-6 animate-fadeIn">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700/30 pb-2">
                  Integrations
                </h3>
                <BrowserBridgePanel />
              </div>
            )}

            {/* Startup — real launch-on-login toggle. */}
            {activeTab === 'startup' && (
              <div className="space-y-6 animate-fadeIn">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700/30 pb-2">
                  Startup
                </h3>

                <div className="bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-slate-800 dark:text-slate-200 font-medium">Launch FocusBook at login</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                        Start FocusBook automatically when you sign in to Windows so tracking begins
                        without you opening it. Off by default.
                      </div>
                    </div>
                    <Toggle on={autoLaunch} onClick={toggleAutoLaunch} />
                  </div>
                  {autoLaunchStatus && (
                    <p
                      className={`text-sm mt-3 ${
                        autoLaunchStatus.ok
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-500 dark:text-rose-400'
                      }`}
                    >
                      {autoLaunchStatus.message}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation modal for irreversible deletion. */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !isDeleting && setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1220] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 p-2">
                <AlertTriangle className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                  {confirmDelete === 'all' ? 'Delete all activity data?' : 'Clear activity history?'}
                </h4>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {confirmDelete === 'all'
                    ? 'This permanently deletes all recorded activity and focus-session history. Your categories and classification rules are kept. This cannot be undone.'
                    : 'This permanently deletes your recorded activity. Focus-session records, categories, and rules are kept. This cannot be undone.'}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-md text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={runDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-md text-sm text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting…' : confirmDelete === 'all' ? 'Delete everything' : 'Clear history'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
