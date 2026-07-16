import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, ArrowRight, FolderOpen, Copy, Check } from 'lucide-react'

// Getting-started checklist for the Settings "Getting Started" tab. Unlike the
// old dashboard card, this is always visible (no dismiss) and includes the
// full browser-extension install flow (open folder + Load-unpacked steps +
// pairing token), since "connect your browser" is the main setup action.
export default function GettingStartedPanel({ onNavigateTab }) {
  const [extensionConnected, setExtensionConnected] = useState(false)
  const [hasAiKey, setHasAiKey] = useState(false)
  const [bridge, setBridge] = useState(null)
  const [copied, setCopied] = useState(false)
  const [folderMsg, setFolderMsg] = useState(null)
  const [extPath, setExtPath] = useState(null)
  const [pathCopied, setPathCopied] = useState(false)

  // Poll live setup state so checkmarks and the extension status update as the
  // user completes each step.
  useEffect(() => {
    let interval
    const refresh = async () => {
      try {
        const [bridgeStatus, aiCfg] = await Promise.all([
          window.electronAPI?.getBrowserBridgeStatus?.(),
          window.electronAPI?.getAiConfig?.()
        ])
        if (bridgeStatus) setBridge(bridgeStatus)
        const live = (bridgeStatus?.connections || []).filter((c) => c.alive)
        setExtensionConnected(live.length > 0)
        setHasAiKey(Boolean(aiCfg?.apiKey))
      } catch (error) {
        console.error('GettingStarted: failed to refresh status:', error)
      }
    }
    refresh()
    interval = setInterval(refresh, 5000)
    return () => interval && clearInterval(interval)
  }, [])

  const openExtensionFolder = async () => {
    setFolderMsg(null)
    try {
      const res = await window.electronAPI?.openExtensionFolder?.()
      if (res?.success) {
        setExtPath(res.path || null)
        setFolderMsg({
          ok: true,
          text: res.paired
            ? 'Folder opened in Explorer and pre-paired. Now click Load unpacked in your browser and pick this folder — it connects on its own.'
            : 'Folder opened in Explorer. Now click Load unpacked in your browser and pick this folder.'
        })
      } else {
        setFolderMsg({ ok: false, text: res?.error || 'Could not open the extension folder.' })
      }
    } catch (error) {
      setFolderMsg({ ok: false, text: error.message })
    }
  }

  const copyPath = async () => {
    if (!extPath) return
    try {
      await navigator.clipboard.writeText(extPath)
      setPathCopied(true)
      setTimeout(() => setPathCopied(false), 2000)
    } catch (error) {
      console.error('GettingStarted: failed to copy path:', error)
    }
  }

  const copyToken = async () => {
    if (!bridge?.token) return
    try {
      await navigator.clipboard.writeText(bridge.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('GettingStarted: failed to copy token:', error)
    }
  }

  const maskedToken = bridge?.token ? '•'.repeat(Math.min(bridge.token.length, 36)) : ''

  const items = [
    {
      key: 'tracking',
      done: true,
      label: 'Tracking is on',
      hint: 'Your app usage is being recorded automatically.'
    },
    {
      key: 'extension',
      done: extensionConnected,
      label: 'Connect your browser',
      hint: 'Install the extension to track sites, not just the browser app.'
    },
    // AI service disabled — the "Set up AI insights" step is hidden so it doesn't
    // dead-end at a removed tab. Restore this entry to re-enable.
    // {
    //   key: 'ai',
    //   done: hasAiKey,
    //   label: 'Set up AI insights (optional)',
    //   hint: 'Add an OpenAI or Gemini key for AI summaries of your day.',
    //   go: 'ai'
    // },
    {
      key: 'categories',
      done: false,
      label: 'Review your categories',
      hint: 'Tune which apps count as productive or distracting.',
      go: 'Categories Management'
    }
  ]

  const completed = items.filter((i) => i.done).length

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h3 className="font-display text-lg font-medium text-fb-text border-b border-fb-border pb-2">
          Getting Started
        </h3>
        <p className="mt-2 text-sm text-fb-muted">
          {completed} of {items.length} steps complete. These update automatically as you set things
          up.
        </p>
      </div>

      {/* Checklist */}
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.key}>
            <button
              onClick={item.go ? () => onNavigateTab?.(item.go) : undefined}
              disabled={!item.go}
              className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
                item.go
                  ? 'hover:bg-fb-surface2 cursor-pointer'
                  : 'cursor-default'
              }`}
            >
              {item.done ? (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500" />
              ) : (
                <Circle className="h-5 w-5 flex-shrink-0 text-fb-muted" />
              )}
              <div className="min-w-0 flex-1">
                <div
                  className={`text-sm font-medium ${
                    item.done
                      ? 'text-fb-muted line-through'
                      : 'text-fb-text'
                  }`}
                >
                  {item.label}
                </div>
                <div className="text-xs text-fb-muted">{item.hint}</div>
              </div>
              {item.go && !item.done && (
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-fb-muted" />
              )}
            </button>
          </li>
        ))}
      </ul>

      {/* Browser extension install flow */}
      <div className="rounded-xl border p-4 bg-fb-surface2 border-fb-border">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-fb-text">
            Install the browser extension
          </h4>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              extensionConnected
                ? 'bg-cat-create/15 text-cat-create'
                : 'bg-fb-track text-fb-muted'
            }`}
          >
            {extensionConnected ? 'Connected' : 'Not connected'}
          </span>
        </div>

        <p className="mb-3 text-sm text-fb-muted">
          The extension reports which site is active so FocusBook can show real domains instead of
          just “Chrome”. It installs unpacked (no web-store needed) and pairs itself automatically —
          no token to copy:
        </p>

        <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-sm text-fb-text">
          <li>
            Click <span className="font-medium">Open extension folder</span> below (this pre-pairs it
            with FocusBook).
          </li>
          <li>
            Open your browser’s extensions page — <code className="font-mono text-xs">chrome://extensions</code>,{' '}
            <code className="font-mono text-xs">brave://extensions</code>, or{' '}
            <code className="font-mono text-xs">edge://extensions</code>.
          </li>
          <li>
            Turn on <span className="font-medium">Developer mode</span> (top-right toggle).
          </li>
          <li>
            Click <span className="font-medium">Load unpacked</span> and select that folder. It
            connects on its own — you’ll see “Connected” above within a few seconds.
          </li>
        </ol>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openExtensionFolder}
            className="inline-flex items-center gap-1.5 rounded-md bg-fb-accent px-3 py-2 text-sm text-white hover:brightness-110 transition-all"
          >
            <FolderOpen className="h-4 w-4" />
            Open extension folder
          </button>
        </div>
        {folderMsg && (
          <p
            className={`mt-2 break-all text-xs ${
              folderMsg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-cat-distract'
            }`}
          >
            {folderMsg.text}
          </p>
        )}
        {extPath && (
          <div className="mt-2">
            <label className="mb-1 block text-xs font-medium text-fb-muted">
              Folder path (paste into the Load-unpacked picker if you can’t find it)
            </label>
            <div className="flex">
              <input
                type="text"
                value={extPath}
                readOnly
                onFocus={(e) => e.target.select()}
                className="flex-1 rounded-l-md border px-3 py-2 font-mono text-xs bg-fb-surface border-fb-border text-fb-text focus:outline-none"
              />
              <button
                onClick={copyPath}
                className="rounded-r-md bg-fb-accent px-3 py-2 text-sm text-white hover:brightness-110 transition-all"
                title="Copy folder path"
              >
                {pathCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        {/* Pairing token — fallback only. Auto-pairing covers the normal case;
            this is here for the rare read-only-folder install or a manual re-pair. */}
        <details className="mt-4 rounded-lg border border-fb-border">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-fb-muted">
            Didn’t connect? Pair manually with a token
          </summary>
          <div className="px-3 pb-3">
            <p className="mb-2 text-xs text-fb-muted">
              Open the extension’s <span className="font-medium">Options</span> page, paste this token,
              and click Save.
            </p>
            <div className="flex">
              <input
                type="text"
                value={maskedToken}
                readOnly
                className="flex-1 rounded-l-lg border px-3 py-2 font-mono text-sm bg-fb-surface border-fb-border text-fb-text focus:outline-none"
              />
              <button
                onClick={copyToken}
                disabled={!bridge?.token}
                className="rounded-r-lg bg-fb-accent px-3 py-2 text-sm text-white hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            {bridge?.port && (
              <p className="mt-1.5 text-xs text-fb-muted">
                Listening on 127.0.0.1:{bridge.port}
              </p>
            )}
          </div>
        </details>
      </div>
    </div>
  )
}
