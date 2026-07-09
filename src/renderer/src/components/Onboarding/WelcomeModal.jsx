import { useEffect, useState } from 'react'
import { Hexagon, Globe, Bot, Check, Copy, ArrowRight, ArrowLeft, X } from 'lucide-react'
import { Button } from '../ui/button'

// First-run welcome. Three slides — what FocusBook does, the (optional) browser
// extension, and the (optional) AI key. Dismissible from slide 1 via Skip/X.
// On finish/skip the parent persists onboardingCompleted via setUiState.
export default function WelcomeModal({ onComplete }) {
  const [step, setStep] = useState(0)
  const [bridgeStatus, setBridgeStatus] = useState(null)
  const [copied, setCopied] = useState(false)
  const [hasAiKey, setHasAiKey] = useState(false)

  const SLIDES = 3

  // Poll the browser-bridge status while on the extension slide so the
  // "connected" state updates live as the user installs/pairs the extension.
  useEffect(() => {
    let interval
    const fetchStatus = async () => {
      try {
        const s = await window.electronAPI?.getBrowserBridgeStatus?.()
        if (s) setBridgeStatus(s)
      } catch (error) {
        console.error('Onboarding: failed to fetch bridge status:', error)
      }
    }
    if (step === 1) {
      fetchStatus()
      interval = setInterval(fetchStatus, 4000)
    }
    return () => interval && clearInterval(interval)
  }, [step])

  // Reflect whether an AI key is already configured on the AI slide.
  useEffect(() => {
    const checkAi = async () => {
      try {
        const cfg = await window.electronAPI?.getAiConfig?.()
        setHasAiKey(Boolean(cfg?.apiKey))
      } catch (error) {
        console.error('Onboarding: failed to read AI config:', error)
      }
    }
    if (step === 2) checkAi()
  }, [step])

  const liveConnections = (bridgeStatus?.connections || []).filter((c) => c.alive)
  const extensionConnected = liveConnections.length > 0

  const copyToken = async () => {
    if (!bridgeStatus?.token) return
    try {
      await navigator.clipboard.writeText(bridgeStatus.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Onboarding: failed to copy token:', error)
    }
  }

  const next = () => setStep((s) => Math.min(SLIDES - 1, s + 1))
  const back = () => setStep((s) => Math.max(0, s - 1))
  const finish = () => onComplete?.()

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border shadow-2xl bg-white border-[#E8EDF1] dark:bg-[#0B1220] dark:border-[#1E293B]">
        {/* Dismiss (available from slide 1 — onboarding never traps the user) */}
        <button
          onClick={finish}
          aria-label="Skip onboarding"
          className="absolute right-3 top-3 rounded-md p-1.5 text-[#768396] hover:text-[#232360] hover:bg-[#F4F7FE] dark:text-[#94A3B8] dark:hover:text-white dark:hover:bg-[#1E293B] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 sm:p-8">
          {step === 0 && <SlideIntro />}
          {step === 1 && (
            <SlideExtension
              connected={extensionConnected}
              token={bridgeStatus?.token}
              port={bridgeStatus?.port}
              copied={copied}
              onCopy={copyToken}
            />
          )}
          {step === 2 && <SlideAi hasAiKey={hasAiKey} />}

          {/* Step dots */}
          <div className="mt-6 flex items-center justify-center gap-1.5">
            {Array.from({ length: SLIDES }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step
                    ? 'w-5 bg-[#5051F9] dark:bg-[#22D3EE]'
                    : 'w-1.5 bg-[#E8EDF1] dark:bg-[#1E293B]'
                }`}
              />
            ))}
          </div>

          {/* Footer controls */}
          <div className="mt-6 flex items-center justify-between">
            {step > 0 ? (
              <Button variant="ghost" onClick={back} className="text-[#768396] dark:text-[#94A3B8]">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={finish} className="text-[#768396] dark:text-[#94A3B8]">
                Skip
              </Button>
            )}

            {step < SLIDES - 1 ? (
              <Button
                onClick={next}
                className="bg-[#5051F9] text-white hover:bg-[#4142E0] dark:bg-[#22D3EE] dark:text-[#03050A] dark:hover:bg-[#4FDDF0]"
              >
                Next
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={finish}
                className="bg-[#5051F9] text-white hover:bg-[#4142E0] dark:bg-[#22D3EE] dark:text-[#03050A] dark:hover:bg-[#4FDDF0]"
              >
                Get started
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SlideHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#5051F9]/10 dark:bg-[#22D3EE]/10">
        <Icon className="h-6 w-6 text-[#5051F9] dark:text-[#22D3EE]" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-[#232360] dark:text-white">{title}</h2>
      {subtitle && <p className="mt-2 text-sm text-[#768396] dark:text-[#94A3B8]">{subtitle}</p>}
    </div>
  )
}

function SlideIntro() {
  return (
    <div>
      <SlideHeader
        icon={Hexagon}
        title="Welcome to FocusBook"
        subtitle="FocusBook automatically tracks how you spend time across your apps and browser, categorizes it, and shows where your focus really goes."
      />
      <ul className="mt-5 space-y-2.5 text-sm text-[#232360] dark:text-[#CBD5E1]">
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
          <span>Tracking starts right away — there’s nothing to configure to begin.</span>
        </li>
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
          <span>Your activity is grouped as Productive, Neutral, or Distracting.</span>
        </li>
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
          <span>Everything stays on your machine — data is stored locally.</span>
        </li>
      </ul>
    </div>
  )
}

function SlideExtension({ connected, token, port, copied, onCopy }) {
  const maskedToken = token ? '•'.repeat(Math.min(token.length, 36)) : ''
  return (
    <div>
      <SlideHeader
        icon={Globe}
        title="See your browser activity"
        subtitle="To track which sites you visit (not just “Chrome”), install the FocusBook browser extension and paste your pairing token into its options page."
      />

      <div className="mt-5 rounded-lg border p-3 bg-[#F4F7FE] border-[#E8EDF1] dark:bg-[#05070D] dark:border-[#1E293B]">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[#768396] dark:text-[#94A3B8]">Pairing token</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              connected
                ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                : 'bg-[#E8EDF1] text-[#768396] dark:bg-[#1E293B] dark:text-[#94A3B8]'
            }`}
          >
            {connected ? 'Extension connected' : 'Waiting for extension'}
          </span>
        </div>
        <div className="flex">
          <input
            type="text"
            value={maskedToken}
            readOnly
            className="flex-1 rounded-l-md border px-3 py-2 font-mono text-sm bg-white border-[#E8EDF1] text-[#232360] dark:bg-[#05070D] dark:border-[#1E293B] dark:text-slate-200 focus:outline-none"
          />
          <button
            onClick={onCopy}
            disabled={!token}
            className="rounded-r-md bg-[#5051F9] px-3 py-2 text-sm text-white hover:bg-[#4142E0] disabled:opacity-50 dark:bg-[#22D3EE] dark:text-[#03050A] dark:hover:bg-[#4FDDF0] transition-colors"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        {port && (
          <p className="mt-1.5 text-xs text-[#768396] dark:text-[#94A3B8]">
            Listening on 127.0.0.1:{port}
          </p>
        )}
      </div>

      <p className="mt-3 text-xs text-[#768396] dark:text-[#94A3B8]">
        Optional — full install steps (and an “Open extension folder” button) live under{' '}
        <span className="font-medium text-[#5051F9] dark:text-[#22D3EE]">
          Settings → Getting Started
        </span>
        . App tracking still works without it.
      </p>
    </div>
  )
}

function SlideAi({ hasAiKey }) {
  return (
    <div>
      <SlideHeader
        icon={Bot}
        title="AI insights (optional)"
        subtitle="Add an OpenAI or Gemini key to get a written summary of your day and smarter productivity tips."
      />

      <div className="mt-5 rounded-lg border p-4 bg-[#F4F7FE] border-[#E8EDF1] dark:bg-[#05070D] dark:border-[#1E293B]">
        {hasAiKey ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" />
            An AI key is already configured — you’re all set.
          </div>
        ) : (
          <p className="text-sm text-[#232360] dark:text-[#CBD5E1]">
            No key required to use FocusBook. When you’re ready, add one under{' '}
            <span className="font-medium text-[#5051F9] dark:text-[#22D3EE]">Settings → AI</span> to
            unlock AI summaries.
          </p>
        )}
      </div>

      <p className="mt-3 text-xs text-[#768396] dark:text-[#94A3B8]">
        You’re ready to go. Explore your dashboard to see today’s activity as it’s tracked.
      </p>
    </div>
  )
}
