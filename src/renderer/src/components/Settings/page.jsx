'use client'

import { useEffect, useState } from 'react'
import { useTheme, colorSchemes } from '../../context/ThemeContext'
import BrowserBridgePanel from './BrowserBridgePanel'
import CategoryRulesPanel from './CategoryRulesPanel'
import { toCSV, toJSON } from '../../utils/exportUtils'
import {
  Settings,
  User,
  Palette,
  Bell,
  Lock,
  Database,
  Globe,
  Sliders,
  Moon,
  Sun,
  Save,
  RefreshCw,
  Trash2,
  Download,
  Upload,
  Bot,
  Check
} from 'lucide-react'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile')
  const { theme, resolvedTheme, setThemeMode, primaryColor, secondaryColor, setPrimaryAccent, setSecondaryAccent } = useTheme()
  const [focusMode, setFocusMode] = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [soundEffects, setSoundEffects] = useState(true)
  const [autoStartBreaks, setAutoStartBreaks] = useState(false)
  const [dataCollection, setDataCollection] = useState(true)
  const [timeFormat, setTimeFormat] = useState('24h')
  const [weekStart, setWeekStart] = useState('monday')
  const [language, setLanguage] = useState('english')
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const [aiProvider, setAiProvider] = useState('openai') // 'openai' or 'gemini'
  const [isApiKeyValid, setIsApiKeyValid] = useState(false)
  const [aiServiceStatus, setAiServiceStatus] = useState({ isRunning: false, port: null, error: null })
  const [isExporting, setIsExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState(null) // { ok, message }
  const [exportFrom, setExportFrom] = useState('') // YYYY-MM-DD, blank = no lower bound
  const [exportTo, setExportTo] = useState('') // YYYY-MM-DD, blank = no upper bound

  // Export the full app-usage history as CSV or JSON. The renderer already has
  // the data via getAllAggregatedData(); we serialize here and hand the string
  // to the main process, which shows a native Save dialog and writes the file.
  const handleExport = async (format) => {
    const fmt = format.toLowerCase()
    // Guard against an inverted range before doing any work.
    if (exportFrom && exportTo && exportFrom > exportTo) {
      setExportStatus({ ok: false, message: '"From" date must be on or before "To" date.' })
      return
    }
    setIsExporting(true)
    setExportStatus(null)
    try {
      // Blank pickers = whole history; either/both filled = date-range export.
      // getFormattedUsageData returns the same nested shape as getAllAggregatedData,
      // so the serializers are unchanged. Use very-wide bounds for an open end.
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
          message: hasRange
            ? 'No usage data in that date range.'
            : 'No usage data to export yet.'
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

  useEffect(() => {
    // Load AI config from config.json
    const loadAiConfig = async () => {
      try {
        const config = await window.electronAPI.getAiConfig()
        setAiProvider(config.provider || 'openai')

        // The apiKey in config.json corresponds to the active provider
        if (config.provider === 'gemini') {
          setGeminiApiKey(config.apiKey || '')
        } else {
          setOpenaiApiKey(config.apiKey || '')
        }
      } catch (error) {
        console.error('Error loading AI config:', error)
      }
    }
    loadAiConfig()

    // Check AI service status periodically
    const checkAiServiceStatus = async () => {
      try {
        const status = await window.electronAPI.getAiServiceStatus()
        setAiServiceStatus(status)
      } catch (error) {
        console.error('Error checking AI service status:', error)
        setAiServiceStatus({ isRunning: false, port: null, error: error.message })
      }
    }

    checkAiServiceStatus()
    const statusInterval = setInterval(checkAiServiceStatus, 5000) // Check every 5 seconds in settings

    return () => clearInterval(statusInterval)
  }, [])

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
                  { id: 'profile', label: 'Profile', icon: User },
                  { id: 'appearance', label: 'Appearance', icon: Palette },
                  { id: 'notifications', label: 'Notifications', icon: Bell },
                  { id: 'Categories Management', label: 'Categories Management', icon: Lock },
                  { id: 'ai', label: 'AI Assistant', icon: Bot },
                  { id: 'data', label: 'Data Management', icon: Database },
                  { id: 'integrations', label: 'Integrations', icon: Globe },
                  { id: 'preferences', label: 'Preferences', icon: Sliders }
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
            {/* Profile Settings */}
            {activeTab === 'profile' && (
              <div className="space-y-6 animate-fadeIn">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700/30 pb-2">
                  User Profile
                </h3>

                <div className="flex items-start space-x-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-2xl font-bold text-white">
                      JD
                    </div>
                    <button className="absolute bottom-0 right-0 bg-slate-200 dark:bg-[#05070D] p-1.5 rounded-full border border-slate-300 dark:border-slate-600 text-cyan-600 dark:text-cyan-400 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="text-xs text-white font-medium">Change</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          defaultValue="John Doe"
                          className="w-full bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                          Display Name
                        </label>
                        <input
                          type="text"
                          defaultValue="JohnD"
                          className="w-full bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Email</label>
                      <input
                        type="email"
                        defaultValue="john.doe@example.com"
                        className="w-full bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Bio</label>
                      <textarea
                        defaultValue="Software developer focused on productivity and time management."
                        rows={3}
                        className="w-full bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-700">
                  <h4 className="text-md font-medium text-slate-800 dark:text-slate-300 mb-3">Account Settings</h4>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                        Current Password
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        className="w-full bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                          New Password
                        </label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          className="w-full bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          className="w-full bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Appearance Settings */}
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

                  <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#1E293B]">
                    <h4 className="text-md font-medium text-[#2B3674] dark:text-white mb-3">Interface Density</h4>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="density"
                          defaultChecked
                          className="h-4 w-4 text-[#4318FF] dark:text-[#7551FF] focus:ring-[#4318FF] dark:focus:ring-[#7551FF] border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#0B1220]"
                        />
                        <span className="ml-2 text-[#2B3674] dark:text-white">Comfortable</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="density"
                          className="h-4 w-4 text-[#4318FF] dark:text-[#7551FF] focus:ring-[#4318FF] dark:focus:ring-[#7551FF] border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#0B1220]"
                        />
                        <span className="ml-2 text-[#2B3674] dark:text-white">Compact</span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#1E293B]">
                    <h4 className="text-md font-medium text-[#2B3674] dark:text-white mb-3">Focus Mode</h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[#2B3674] dark:text-white">Enable Focus Mode</div>
                        <div className="text-sm text-[#A3AED0]">
                          Hide distracting elements when focusing
                        </div>
                      </div>
                      <button
                        onClick={() => setFocusMode(!focusMode)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          focusMode ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            focusMode ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Settings */}
            {activeTab === 'notifications' && (
              <div className="space-y-6 animate-fadeIn">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700/30 pb-2">
                  Notifications
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-slate-300">Enable Notifications</div>
                      <div className="text-sm text-slate-400">
                        Receive notifications from the app
                      </div>
                    </div>
                    <button
                      onClick={() => setNotifications(!notifications)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        notifications ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          notifications ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="pt-4 border-t border-slate-700 space-y-3">
                    <h4 className="text-md font-medium text-slate-300">Notification Types</h4>

                    {[
                      {
                        id: 'focus',
                        label: 'Focus Timer Alerts',
                        desc: 'Notifications for focus sessions and breaks'
                      },
                      {
                        id: 'tasks',
                        label: 'Task Reminders',
                        desc: 'Reminders for upcoming and due tasks'
                      },
                      {
                        id: 'goals',
                        label: 'Goal Progress',
                        desc: 'Updates on your goal progress'
                      },
                      {
                        id: 'analytics',
                        label: 'Weekly Reports',
                        desc: 'Weekly productivity analytics'
                      },
                      {
                        id: 'system',
                        label: 'System Notifications',
                        desc: 'App updates and system messages'
                      }
                    ].map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-2">
                        <div>
                          <div className="text-slate-300">{item.label}</div>
                          <div className="text-sm text-slate-400">{item.desc}</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" defaultChecked className="sr-only peer" />
                          <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-slate-700">
                    <h4 className="text-md font-medium text-slate-800 dark:text-slate-300 mb-3">Sound Effects</h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-slate-300">Enable Sound Effects</div>
                        <div className="text-sm text-slate-400">
                          Play sounds for notifications and events
                        </div>
                      </div>
                      <button
                        onClick={() => setSoundEffects(!soundEffects)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          soundEffects ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            soundEffects ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-700">
                    <h4 className="text-md font-medium text-slate-800 dark:text-slate-300 mb-3">Do Not Disturb</h4>
                    <div>
                      <div className="text-slate-300 mb-2">Quiet Hours</div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                            From
                          </label>
                          <select className="w-full bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500">
                            {Array.from({ length: 24 }).map((_, i) => (
                              <option key={i} value={i}>
                                {i.toString().padStart(2, '0')}:00
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                            To
                          </label>
                          <select className="w-full bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500">
                            {Array.from({ length: 24 }).map((_, i) => (
                              <option key={i} value={i}>
                                {i.toString().padStart(2, '0')}:00
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Settings */}
            {activeTab === 'Categories Management' && (
              <div className="space-y-6 animate-fadeIn">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700/30 pb-2">
                  Manage Categories
                </h3>

                {/* Full category + classification-rule management (DB-driven) */}
                <CategoryRulesPanel />
              </div>
            )}

            {/* AI Assistant Settings */}
            {activeTab === 'ai' && (
              <div className="space-y-6 animate-fadeIn">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700/30 pb-2">
                  AI Assistant Configuration
                </h3>

                <div className="space-y-6">
                  {/* AI Provider and API Key Configuration */}
                  <div className="bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-lg p-4">
                    <h4 className="text-md font-medium text-slate-300 mb-2 flex items-center">
                      <Bot className="h-4 w-4 mr-2 text-cyan-500" />
                      AI Assistant Configuration
                    </h4>
                    <p className="text-slate-400 text-sm mb-4">
                      Configure your AI provider and API key to enable AI-powered insights and analysis of your productivity data.
                    </p>

                    <div className="space-y-4">
                      {/* AI Provider Selection */}
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          AI Provider
                        </label>
                        <select
                          value={aiProvider}
                          onChange={(e) => setAiProvider(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-[#03050A] border border-slate-300 dark:border-slate-700/30 rounded-md text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                          <option value="openai">OpenAI (GPT-4o)</option>
                          <option value="gemini">Google Gemini (gemini-2.5-flash)</option>
                        </select>
                      </div>

                      {/* OpenAI API Key */}
                      {aiProvider === 'openai' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            OpenAI API Key
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={openaiApiKey}
                              onChange={(e) => setOpenaiApiKey(e.target.value)}
                              placeholder="Enter your OpenAI API key (sk-...)"
                              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-[#03050A] border border-slate-300 dark:border-slate-700/30 rounded-md text-slate-900 dark:text-slate-200 placeholder-slate-500 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                            <button
                              onClick={async () => {
                                try {
                                  // Save config to file first
                                  await window.electronAPI.saveAiConfig({
                                    apiKey: openaiApiKey,
                                    provider: 'openai'
                                  })

                                  // Test API key by restarting service with new key
                                  const config = {
                                    provider: 'openai',
                                    openaiKey: openaiApiKey,
                                    geminiKey: geminiApiKey
                                  }
                                  await window.electronAPI.restartAiService(config)
                                  setIsApiKeyValid(true)
                                } catch (error) {
                                  setIsApiKeyValid(false)
                                }
                              }}
                              className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-md transition-colors"
                            >
                              Test
                            </button>
                          </div>
                          {isApiKeyValid && (
                            <p className="text-green-400 text-sm mt-2">✓ API key is valid</p>
                          )}

                          <div className="bg-slate-100 dark:bg-[#03050A] border border-slate-300 dark:border-slate-700/30 rounded-md p-3 mt-3">
                            <h5 className="text-sm font-medium text-slate-300 mb-2">How to get an OpenAI API key:</h5>
                            <ol className="text-sm text-slate-400 space-y-1">
                              <li>1. Visit <a href="https://platform.openai.com/api-keys" className="text-cyan-400 hover:underline" target="_blank" rel="noopener noreferrer">OpenAI API Keys</a></li>
                              <li>2. Sign in to your OpenAI account</li>
                              <li>3. Click "Create new secret key"</li>
                              <li>4. Copy the key and paste it above</li>
                            </ol>
                          </div>
                        </div>
                      )}

                      {/* Gemini API Key */}
                      {aiProvider === 'gemini' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Google Gemini API Key
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={geminiApiKey}
                              onChange={(e) => setGeminiApiKey(e.target.value)}
                              placeholder="Enter your Gemini API key (AIza...)"
                              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-[#03050A] border border-slate-300 dark:border-slate-700/30 rounded-md text-slate-900 dark:text-slate-200 placeholder-slate-500 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                            <button
                              onClick={async () => {
                                try {
                                  // Save config to file first
                                  await window.electronAPI.saveAiConfig({
                                    apiKey: geminiApiKey,
                                    provider: 'gemini'
                                  })

                                  // Test API key by restarting service with new key
                                  const config = {
                                    provider: 'gemini',
                                    openaiKey: openaiApiKey,
                                    geminiKey: geminiApiKey
                                  }
                                  await window.electronAPI.restartAiService(config)
                                  setIsApiKeyValid(true)
                                } catch (error) {
                                  setIsApiKeyValid(false)
                                }
                              }}
                              className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-md transition-colors"
                            >
                              Test
                            </button>
                          </div>
                          {isApiKeyValid && (
                            <p className="text-green-400 text-sm mt-2">✓ API key is valid</p>
                          )}

                          <div className="bg-slate-100 dark:bg-[#03050A] border border-slate-300 dark:border-slate-700/30 rounded-md p-3 mt-3">
                            <h5 className="text-sm font-medium text-slate-300 mb-2">How to get a Gemini API key:</h5>
                            <ol className="text-sm text-slate-400 space-y-1">
                              <li>1. Visit <a href="https://aistudio.google.com/apikey" className="text-cyan-400 hover:underline" target="_blank" rel="noopener noreferrer">Google AI Studio</a></li>
                              <li>2. Sign in with your Google account</li>
                              <li>3. Click "Get API Key" or "Create API Key"</li>
                              <li>4. Copy the key and paste it above</li>
                            </ol>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={async () => {
                          try {
                            // Determine which API key to save based on provider
                            const apiKey = aiProvider === 'gemini' ? geminiApiKey : openaiApiKey

                            // Save to config.json
                            const configToSave = {
                              apiKey: apiKey,
                              provider: aiProvider
                            }
                            await window.electronAPI.saveAiConfig(configToSave)

                            // Prepare configuration for the AI service restart
                            const serviceConfig = {
                              provider: aiProvider,
                              openaiKey: openaiApiKey,
                              geminiKey: geminiApiKey
                            }

                            // Restart the AI service with new config
                            await window.electronAPI.restartAiService(serviceConfig)

                            console.log('Configuration saved successfully')
                          } catch (error) {
                            console.error('Error saving configuration:', error)
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors flex items-center"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Configuration
                      </button>
                    </div>
                  </div>

                  {/* Service Status */}
                  <div className="bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-lg p-4">
                    <h4 className="text-md font-medium text-slate-300 mb-2 flex items-center">
                      <RefreshCw className="h-4 w-4 mr-2 text-cyan-500" />
                      Service Status
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">AI Service</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${aiServiceStatus.isRunning ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                          <span className="text-sm text-slate-300">
                            {aiServiceStatus.isRunning ? `Running (Port ${aiServiceStatus.port})` : 'Offline'}
                          </span>
                        </div>
                      </div>
                      
                      {aiServiceStatus.error && (
                        <div className="bg-rose-900/30 border border-rose-700/50 rounded-md p-3">
                          <p className="text-rose-400 text-sm">Error: {aiServiceStatus.error}</p>
                        </div>
                      )}
                      
                      <button
                        onClick={async () => {
                          try {
                            await window.electronAPI.restartAiService()
                          } catch (error) {
                            console.error('Error restarting AI service:', error)
                          }
                        }}
                        className="bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-white px-4 py-2 rounded-md transition-colors flex items-center text-sm"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Restart Service
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Data Management Settings */}
            {activeTab === 'data' && (
              <div className="space-y-6 animate-fadeIn">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700/30 pb-2">
                  Data Management
                </h3>

                <div className="space-y-6">
                  <div className="bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-lg p-4">
                    <h4 className="text-md font-medium text-slate-300 mb-2 flex items-center">
                      <Download className="h-4 w-4 mr-2 text-cyan-500" />
                      Export Data
                    </h4>
                    <p className="text-sm text-slate-400 mb-3">
                      Download your productivity data in various formats
                    </p>

                    {/* Optional date range. Leave blank to export the full history. */}
                    <div className="flex flex-wrap items-end gap-3 mb-4">
                      <div className="flex flex-col">
                        <label className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                          From
                        </label>
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
                        <label className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                          To
                        </label>
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
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {item.format}
                          </div>
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

                  <div className="bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-lg p-4">
                    <h4 className="text-md font-medium text-slate-300 mb-2 flex items-center">
                      <Upload className="h-4 w-4 mr-2 text-cyan-500" />
                      Import Data
                    </h4>
                    <p className="text-sm text-slate-400 mb-3">
                      Import productivity data from other sources
                    </p>

                    <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center">
                      <div className="flex justify-center mb-2">
                        <Upload className="h-8 w-8 text-slate-500" />
                      </div>
                      <p className="text-slate-300 mb-1">Drag and drop files here</p>
                      <p className="text-sm text-slate-400 mb-3">or</p>
                      <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-md transition-colors">
                        Browse Files
                      </button>
                      <p className="text-xs text-slate-500 mt-3">
                        Supports CSV, JSON, and compatible formats
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-lg p-4">
                    <h4 className="text-md font-medium text-slate-300 mb-2 flex items-center">
                      <Trash2 className="h-4 w-4 mr-2 text-rose-500" />
                      Delete Data
                    </h4>
                    <p className="text-sm text-slate-400 mb-3">
                      Permanently delete your productivity data
                    </p>

                    <div className="space-y-3">
                      <button className="w-full flex justify-between items-center p-3 bg-slate-100 dark:bg-[#05070D] hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700/30 rounded-lg transition-colors">
                        <span className="text-slate-300">Clear activity history</span>
                        <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded">
                          Last 30 days
                        </span>
                      </button>

                      <button className="w-full flex justify-between items-center p-3 bg-slate-100 dark:bg-[#05070D] hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700/30 rounded-lg transition-colors">
                        <span className="text-slate-300">Reset all statistics</span>
                        <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded">
                          All time
                        </span>
                      </button>

                      <button className="w-full flex justify-between items-center p-3 bg-rose-900/20 hover:bg-rose-900/30 border border-rose-900/50 rounded-lg transition-colors">
                        <span className="text-rose-400">Delete account and all data</span>
                        <span className="text-xs bg-rose-900/50 text-rose-300 px-2 py-1 rounded">
                          Permanent
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-lg p-4">
                    <h4 className="text-md font-medium text-slate-300 mb-2 flex items-center">
                      <Database className="h-4 w-4 mr-2 text-cyan-500" />
                      Backup & Sync
                    </h4>
                    <p className="text-sm text-slate-400 mb-3">
                      Configure automatic backups and synchronization
                    </p>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-slate-300">Automatic Backups</div>
                          <div className="text-xs text-slate-400">
                            Create regular backups of your data
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" defaultChecked className="sr-only peer" />
                          <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-slate-300">Cloud Sync</div>
                          <div className="text-xs text-slate-400">Sync data across devices</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" defaultChecked className="sr-only peer" />
                          <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                        </label>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                          Backup Frequency
                        </label>
                        <select className="w-full bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500">
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Integrations Settings */}
            {activeTab === 'integrations' && (
              <div className="space-y-6 animate-fadeIn">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700/30 pb-2">
                  Integrations
                </h3>

                <div className="space-y-6">
                  <BrowserBridgePanel />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { name: 'Google Calendar', icon: '📅', connected: true },
                      { name: 'Microsoft To Do', icon: '✓', connected: false },
                      { name: 'Slack', icon: '💬', connected: true },
                      { name: 'GitHub', icon: '🐙', connected: false },
                      { name: 'Trello', icon: '🔄', connected: false },
                      { name: 'Notion', icon: '📝', connected: true }
                    ].map((integration) => (
                      <div
                        key={integration.name}
                        className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex items-center justify-between"
                      >
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-md bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xl mr-3">
                            {integration.icon}
                          </div>
                          <div>
                            <div className="text-slate-200 font-medium">{integration.name}</div>
                            <div className="text-xs text-slate-400">
                              {integration.connected ? 'Connected' : 'Not connected'}
                            </div>
                          </div>
                        </div>
                        <button
                          className={`px-3 py-1 rounded-md text-sm ${
                            integration.connected
                              ? 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-300 hover:bg-slate-400 dark:hover:bg-slate-600'
                              : 'bg-cyan-600 text-white hover:bg-cyan-700'
                          } transition-colors`}
                        >
                          {integration.connected ? 'Disconnect' : 'Connect'}
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-lg p-4">
                    <h4 className="text-md font-medium text-slate-800 dark:text-slate-300 mb-3">API Access</h4>
                    <p className="text-sm text-slate-400 mb-4">
                      Generate API keys to integrate with other services
                    </p>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                          API Key
                        </label>
                        <div className="flex">
                          <input
                            type="text"
                            value="••••••••••••••••••••••••••••••"
                            readOnly
                            className="flex-1 bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-l-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none"
                          />
                          <button className="bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-300 px-4 py-2 rounded-r-md transition-colors">
                            Show
                          </button>
                        </div>
                      </div>

                      <div className="flex space-x-3">
                        <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-md transition-colors flex-1">
                          Generate New Key
                        </button>
                        <button className="bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-300 px-4 py-2 rounded-md transition-colors flex-1">
                          Copy Key
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-lg p-4">
                    <h4 className="text-md font-medium text-slate-800 dark:text-slate-300 mb-3">Webhooks</h4>
                    <p className="text-sm text-slate-400 mb-4">
                      Configure webhooks to notify external services
                    </p>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                          Webhook URL
                        </label>
                        <input
                          type="text"
                          placeholder="https://"
                          className="w-full bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                          Events
                        </label>
                        <div className="space-y-2">
                          {[
                            'Focus session completed',
                            'Task created',
                            'Task completed',
                            'Goal progress updated',
                            'Weekly report generated'
                          ].map((event) => (
                            <label key={event} className="flex items-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 text-cyan-500 focus:ring-cyan-500 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#05070D] rounded"
                              />
                              <span className="ml-2 text-slate-300 text-sm">{event}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <button className="mt-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-md transition-colors">
                        Save Webhook
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Preferences Settings */}
            {activeTab === 'preferences' && (
              <div className="space-y-6 animate-fadeIn">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700/30 pb-2">
                  Preferences
                </h3>

                <div className="space-y-6">
                  <div className="bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-lg p-4">
                    <h4 className="text-md font-medium text-slate-800 dark:text-slate-300 mb-3">Focus Timer</h4>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                            Focus Duration (minutes)
                          </label>
                          <input
                            type="number"
                            defaultValue={25}
                            min={1}
                            max={120}
                            className="w-full bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                            Break Duration (minutes)
                          </label>
                          <input
                            type="number"
                            defaultValue={5}
                            min={1}
                            max={60}
                            className="w-full bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                            Long Break Duration (minutes)
                          </label>
                          <input
                            type="number"
                            defaultValue={15}
                            min={1}
                            max={120}
                            className="w-full bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                            Sessions Before Long Break
                          </label>
                          <input
                            type="number"
                            defaultValue={4}
                            min={1}
                            max={10}
                            className="w-full bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-slate-300">Auto-start Breaks</div>
                          <div className="text-sm text-slate-400">
                            Automatically start breaks after focus sessions
                          </div>
                        </div>
                        <button
                          onClick={() => setAutoStartBreaks(!autoStartBreaks)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            autoStartBreaks ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              autoStartBreaks ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-lg p-4">
                    <h4 className="text-md font-medium text-slate-800 dark:text-slate-300 mb-3">Date & Time</h4>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                          Time Format
                        </label>
                        <div className="flex space-x-4">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="timeFormat"
                              checked={timeFormat === '12h'}
                              onChange={() => setTimeFormat('12h')}
                              className="h-4 w-4 text-cyan-500 focus:ring-cyan-500 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#05070D]"
                            />
                            <span className="ml-2 text-slate-300">12-hour (1:30 PM)</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="timeFormat"
                              checked={timeFormat === '24h'}
                              onChange={() => setTimeFormat('24h')}
                              className="h-4 w-4 text-cyan-500 focus:ring-cyan-500 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#05070D]"
                            />
                            <span className="ml-2 text-slate-300">24-hour (13:30)</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                          First Day of Week
                        </label>
                        <select
                          value={weekStart}
                          onChange={(e) => setWeekStart(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                        >
                          <option value="monday">Monday</option>
                          <option value="sunday">Sunday</option>
                          <option value="saturday">Saturday</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                          Date Format
                        </label>
                        <select className="w-full bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500">
                          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-lg p-4">
                    <h4 className="text-md font-medium text-slate-800 dark:text-slate-300 mb-3">Language & Region</h4>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                          Language
                        </label>
                        <select
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                        >
                          <option value="english">English</option>
                          <option value="spanish">Spanish</option>
                          <option value="french">French</option>
                          <option value="german">German</option>
                          <option value="japanese">Japanese</option>
                          <option value="chinese">Chinese</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
                          Timezone
                        </label>
                        <select className="w-full bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-md px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500">
                          <option value="auto">Auto-detect (System)</option>
                          <option value="utc">UTC</option>
                          <option value="est">Eastern Time (EST/EDT)</option>
                          <option value="pst">Pacific Time (PST/PDT)</option>
                          <option value="gmt">GMT</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-lg p-4">
                    <h4 className="text-md font-medium text-slate-800 dark:text-slate-300 mb-3">Accessibility</h4>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-slate-300">Reduce Animations</div>
                          <div className="text-sm text-slate-400">Minimize motion effects</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" />
                          <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-slate-300">High Contrast Mode</div>
                          <div className="text-sm text-slate-400">Increase visual contrast</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" />
                          <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-slate-300">Screen Reader Optimizations</div>
                          <div className="text-sm text-slate-400">
                            Improve screen reader compatibility
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" defaultChecked className="sr-only peer" />
                          <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
