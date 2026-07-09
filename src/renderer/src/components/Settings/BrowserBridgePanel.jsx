import { useEffect, useState } from 'react'
import { FolderOpen } from 'lucide-react'

// Pairing + status panel for the browser extension that reports the active tab
// over the local WebSocket bridge. Lets the user copy the auth token (paste it
// into the extension's options page) and switch the URL source between the
// extension and the legacy pywinauto path.
export default function BrowserBridgePanel() {
  const [status, setStatus] = useState(null)
  const [copied, setCopied] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [folderMsg, setFolderMsg] = useState(null)

  const openExtensionFolder = async () => {
    setFolderMsg(null)
    try {
      const res = await window.electronAPI?.openExtensionFolder?.()
      if (res?.success) {
        setFolderMsg({ ok: true, text: `Opened: ${res.path}` })
      } else {
        setFolderMsg({ ok: false, text: res?.error || 'Could not open the extension folder.' })
      }
    } catch (error) {
      setFolderMsg({ ok: false, text: error.message })
    }
  }

  const fetchStatus = async () => {
    try {
      const s = await window.electronAPI.getBrowserBridgeStatus()
      setStatus(s)
    } catch (error) {
      console.error('Failed to fetch browser bridge status:', error)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  const copyToken = async () => {
    if (!status?.token) return
    try {
      await navigator.clipboard.writeText(status.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy token:', error)
    }
  }

  const liveConnections = (status?.connections || []).filter((c) => c.alive)
  const maskedToken = status?.token ? '•'.repeat(Math.min(status.token.length, 40)) : ''

  return (
    <div className="bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-md font-medium text-slate-800 dark:text-slate-300">Browser Extension</h4>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            liveConnections.length > 0
              ? 'bg-green-500/15 text-green-600 dark:text-green-400'
              : 'bg-slate-300/40 dark:bg-slate-700/40 text-slate-500 dark:text-slate-400'
          }`}
        >
          {liveConnections.length > 0
            ? `${liveConnections.length} connected`
            : status?.running
              ? 'Waiting for extension'
              : 'Bridge offline'}
        </span>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
        Reports the active browser tab from Chrome, Brave, or Edge over a local, token-authenticated
        connection — replacing the Python-based URL lookup. Paste the token below into the
        extension&rsquo;s options page.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={openExtensionFolder}
          className="inline-flex items-center gap-1.5 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1.5 text-sm transition-colors"
        >
          <FolderOpen className="h-4 w-4" />
          Open extension folder
        </button>
        <span className="text-xs text-slate-400">
          Step-by-step install is under Settings → Getting Started.
        </span>
      </div>
      {folderMsg && (
        <p
          className={`mb-3 break-all text-xs ${
            folderMsg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
          }`}
        >
          {folderMsg.text}
        </p>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
            Pairing Token
          </label>
          <div className="flex">
            <input
              type="text"
              value={showToken ? status?.token || '' : maskedToken}
              readOnly
              className="flex-1 bg-slate-50 dark:bg-[#05070D] border border-slate-300 dark:border-slate-700/30 rounded-l-md px-3 py-2 font-mono text-sm text-slate-900 dark:text-slate-200 focus:outline-none"
            />
            <button
              onClick={() => setShowToken((v) => !v)}
              className="bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-300 px-4 py-2 transition-colors"
            >
              {showToken ? 'Hide' : 'Show'}
            </button>
            <button
              onClick={copyToken}
              className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-r-md transition-colors"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          {status?.port && (
            <p className="text-xs text-slate-400 mt-1">Listening on 127.0.0.1:{status.port}</p>
          )}
        </div>

        {liveConnections.length > 0 && (
          <div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">
              Connected Browsers
            </div>
            <ul className="space-y-1">
              {liveConnections.map((c) => (
                <li key={`${c.browser}:${c.profileId}`} className="text-xs text-slate-500 dark:text-slate-400">
                  {c.browser} · {c.windows} window{c.windows === 1 ? '' : 's'}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
