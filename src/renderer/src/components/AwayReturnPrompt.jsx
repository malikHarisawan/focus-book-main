import React, { useEffect, useState, useCallback } from 'react'

/**
 * Return prompt (presence/idle engine §7).
 *
 * When the user comes back from a long absence, the main process fires 'away-return'
 * with the just-closed presence span { spanId, type, durationMs }. We ask what it was
 * and store the answer as a span_annotation — a NEW FACT beside the immutable span, not
 * a correction. On mount we also pull any unannotated backlog (absences the app couldn't
 * prompt for live, e.g. it was closed), so nothing is silently lost.
 *
 * Only ONE prompt shows at a time; additional/backlog absences queue behind it.
 */

// Human phrasing for the presence type we're asking about.
const TYPE_LABEL = {
  idle: 'away (no input)',
  locked: 'locked',
  suspended: 'asleep',
  unknown: 'away (app not running)'
}

// The answers offered. `value` is what we persist as user_label.
const CHOICES = [
  { value: 'working', label: 'Working', hint: 'reading, a call, a meeting' },
  { value: 'break', label: 'Break', hint: 'lunch, rest, off the clock' },
  { value: 'meeting', label: 'Meeting', hint: 'in-person or a call' }
]

function formatDuration(ms) {
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function formatWhen(startIso, endIso) {
  try {
    const fmt = (d) =>
      new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return `${fmt(startIso)}–${fmt(endIso)}`
  } catch {
    return ''
  }
}

export default function AwayReturnPrompt() {
  // Queue of pending prompts. Each item: { spanId, type, durationMs, start?, end? }.
  const [queue, setQueue] = useState([])
  const [saving, setSaving] = useState(false)

  const current = queue[0] || null

  const enqueue = useCallback((items) => {
    setQueue((prev) => {
      const seen = new Set(prev.map((p) => p.spanId))
      const fresh = items.filter((it) => it && it.spanId != null && !seen.has(it.spanId))
      return fresh.length ? [...prev, ...fresh] : prev
    })
  }, [])

  useEffect(() => {
    if (!window.electronAPI) return

    // Live: the user just returned from an absence.
    const off = window.electronAPI.onAwayReturn?.((info) => {
      if (info && info.spanId != null) enqueue([info])
    })

    // Backlog: absences we never got to prompt for (app was closed, etc.).
    window.electronAPI.getUnannotatedAway?.()
      .then((rows) => {
        if (Array.isArray(rows) && rows.length) {
          enqueue(
            rows.map((r) => ({
              spanId: r.id,
              type: r.type,
              durationMs: r.durationMs,
              start: r.start,
              end: r.end
            }))
          )
        }
      })
      .catch(() => {})

    return () => {
      if (typeof off === 'function') off()
    }
  }, [enqueue])

  const advance = useCallback(() => {
    setQueue((prev) => prev.slice(1))
  }, [])

  const answer = useCallback(
    async (label) => {
      if (!current || saving) return
      setSaving(true)
      try {
        await window.electronAPI.annotatePresenceSpan?.(current.spanId, label)
      } catch (e) {
        console.error('Failed to save away annotation:', e)
      } finally {
        setSaving(false)
        advance()
      }
    },
    [current, saving, advance]
  )

  if (!current) return null

  const typeLabel = TYPE_LABEL[current.type] || current.type
  const when = current.start && current.end ? formatWhen(current.start, current.end) : ''

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-slide-up">
      <div className="bg-fb-surface border border-fb-border rounded-xl shadow-2xl p-4 text-fb-text">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5 text-fb-accent">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-0.5">Welcome back</h3>
            <p className="text-xs text-fb-muted mb-3">
              You were {typeLabel} for{' '}
              <span className="text-fb-text font-medium">{formatDuration(current.durationMs)}</span>
              {when ? <span className="text-fb-muted"> ({when})</span> : null}. What was that?
            </p>

            <div className="flex flex-col gap-1.5">
              {CHOICES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => answer(c.value)}
                  disabled={saving}
                  className="text-left px-3 py-2 rounded-lg border border-fb-border hover:border-fb-accent hover:bg-fb-surface2 transition-colors disabled:opacity-50"
                >
                  <span className="text-sm font-medium">{c.label}</span>
                  <span className="text-xs text-fb-muted ml-2">{c.hint}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between mt-3">
              <button
                onClick={advance}
                disabled={saving}
                className="text-xs text-fb-muted hover:text-fb-text transition-colors disabled:opacity-50"
              >
                Skip
              </button>
              {queue.length > 1 ? (
                <span className="text-[11px] text-fb-muted">{queue.length - 1} more</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
