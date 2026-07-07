import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, X, Sparkles, ArrowRight } from 'lucide-react'

// Dismissible "Getting started" checklist for the dashboard. Follows up the
// welcome modal with the actionable setup steps, auto-checking each as the
// underlying state becomes true (extension connected, AI key present). Persists
// dismissal (and auto-hides once the required steps are done) via ui-state.
export default function GettingStartedCard() {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false) // hidden until we know it's not dismissed
  const [extensionConnected, setExtensionConnected] = useState(false)
  const [hasAiKey, setHasAiKey] = useState(false)

  // Load dismissal flag once; only show the card if the user hasn't dismissed it.
  useEffect(() => {
    let active = true
    const init = async () => {
      try {
        const state = await window.electronAPI?.getUiState?.()
        if (active) setVisible(!state?.gettingStartedDismissed)
      } catch (error) {
        console.error('GettingStarted: failed to read ui-state:', error)
      }
    }
    init()
    return () => {
      active = false
    }
  }, [])

  // Poll live setup state while the card is visible so checkmarks update as the
  // user completes each step (extension pairing, adding an AI key).
  useEffect(() => {
    if (!visible) return
    let interval
    const refresh = async () => {
      try {
        const [bridge, aiCfg] = await Promise.all([
          window.electronAPI?.getBrowserBridgeStatus?.(),
          window.electronAPI?.getAiConfig?.()
        ])
        const live = (bridge?.connections || []).filter((c) => c.alive)
        setExtensionConnected(live.length > 0)
        setHasAiKey(Boolean(aiCfg?.apiKey))
      } catch (error) {
        console.error('GettingStarted: failed to refresh status:', error)
      }
    }
    refresh()
    interval = setInterval(refresh, 5000)
    return () => interval && clearInterval(interval)
  }, [visible])

  const dismiss = async () => {
    setVisible(false)
    try {
      await window.electronAPI?.setUiState?.({ gettingStartedDismissed: true })
    } catch (error) {
      console.error('GettingStarted: failed to persist dismissal:', error)
    }
  }

  const items = [
    {
      key: 'tracking',
      done: true,
      label: 'Tracking is on',
      hint: 'Your app usage is being recorded automatically.',
      action: null
    },
    {
      key: 'extension',
      done: extensionConnected,
      label: 'Connect your browser',
      hint: 'Install the extension to track sites, not just the browser app.',
      action: () => navigate('/settings?tab=integrations')
    },
    {
      key: 'ai',
      done: hasAiKey,
      label: 'Set up AI insights (optional)',
      hint: 'Add an OpenAI or Gemini key for AI summaries of your day.',
      action: () => navigate('/settings?tab=ai')
    },
    {
      key: 'categories',
      done: false,
      label: 'Review your categories',
      hint: 'Tune which apps count as productive or distracting.',
      action: () => navigate('/settings?tab=Categories Management')
    }
  ]

  // Auto-hide once the two required setup steps are satisfied. (The AI and
  // categories items are optional/always-actionable, so they don't gate this.)
  const requiredDone = extensionConnected
  if (!visible || requiredDone) return null

  const completedCount = items.filter((i) => i.done).length

  return (
    <div className="mb-4 rounded-2xl border p-4 bg-white border-[#E8EDF1] shadow-sm dark:bg-[#0B1220] dark:border-[#1E293B]">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5051F9]/10 dark:bg-[#22D3EE]/10">
            <Sparkles className="h-4 w-4 text-[#5051F9] dark:text-[#22D3EE]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#232360] dark:text-white">Getting started</h3>
            <p className="text-xs text-[#768396] dark:text-[#94A3B8]">
              {completedCount} of {items.length} complete
            </p>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss getting started"
          className="rounded-md p-1.5 text-[#768396] hover:text-[#232360] hover:bg-[#F4F7FE] dark:text-[#94A3B8] dark:hover:text-white dark:hover:bg-[#1E293B] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ul className="mt-3 space-y-1">
        {items.map((item) => (
          <li key={item.key}>
            <button
              onClick={item.action || undefined}
              disabled={!item.action}
              className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
                item.action
                  ? 'hover:bg-[#F4F7FE] dark:hover:bg-[#1E293B] cursor-pointer'
                  : 'cursor-default'
              }`}
            >
              {item.done ? (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500" />
              ) : (
                <Circle className="h-5 w-5 flex-shrink-0 text-[#768396] dark:text-[#94A3B8]" />
              )}
              <div className="min-w-0 flex-1">
                <div
                  className={`text-sm font-medium ${
                    item.done
                      ? 'text-[#768396] line-through dark:text-[#94A3B8]'
                      : 'text-[#232360] dark:text-white'
                  }`}
                >
                  {item.label}
                </div>
                <div className="truncate text-xs text-[#768396] dark:text-[#94A3B8]">{item.hint}</div>
              </div>
              {item.action && !item.done && (
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-[#768396] dark:text-[#94A3B8]" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
