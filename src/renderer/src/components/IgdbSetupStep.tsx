import { useState } from 'react'
import { Globe, ExternalLink, Eye, EyeOff, CheckCircle2, XCircle, ChevronDown } from 'lucide-react'

export interface IgdbStepData {
  clientId: string
  clientSecret: string
  skipped: boolean
}

export default function IgdbSetupStep({
  initial,
  onNext
}: {
  initial?: IgdbStepData
  onNext: (data: IgdbStepData) => void
}): React.JSX.Element {
  const [clientId, setClientId] = useState(initial?.clientId ?? '')
  const [clientSecret, setClientSecret] = useState(initial?.clientSecret ?? '')
  const [showSecret, setShowSecret] = useState(false)
  const [status, setStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle')
  const [showInstructions, setShowInstructions] = useState(false)
  const [skipped, setSkipped] = useState(initial?.skipped ?? false)

  const canTest = clientId.trim().length > 0 && clientSecret.trim().length > 0

  const handleTest = async (): Promise<void> => {
    setStatus('testing')
    setSkipped(false)
    try {
      // Persist temporarily so the main process can use them for the test
      await window.api.config.set({ igdb: { clientId, clientSecret } })
      const ok = await window.api.config.testIgdb()
      setStatus(ok ? 'connected' : 'error')
    } catch {
      setStatus('error')
    }
  }

  const handleSkip = (): void => {
    setSkipped(true)
    onNext({ clientId: '', clientSecret: '', skipped: true })
  }

  const canProceed = status === 'connected' || skipped

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg">
      {/* Icon + heading */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rs-accent to-indigo-400 shadow-lg shadow-rs-accent/30">
          <Globe size={28} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-rs-text">Connect to IGDB</h2>
        <p className="mt-2 max-w-sm text-sm text-rs-text-secondary">
          RetroSync uses IGDB (powered by Twitch) to fetch game metadata, covers, and screenshots.
        </p>
      </div>

      {/* Collapsible instructions */}
      <button
        type="button"
        onClick={() => setShowInstructions((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-rs-accent hover:text-rs-accent-hover transition-colors"
      >
        How do I get API credentials?
        <ChevronDown
          size={14}
          className={`transition-transform ${showInstructions ? 'rotate-180' : ''}`}
        />
      </button>

      {showInstructions && (
        <div className="w-full rounded-xl border border-rs-border bg-rs-panel-light p-4 text-xs text-rs-text-secondary leading-relaxed">
          <ol className="list-decimal ml-4 space-y-1.5">
            <li>
              Go to the{' '}
              <a
                href="https://dev.twitch.tv/console/apps"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-rs-accent hover:underline"
              >
                Twitch Developer Console
                <ExternalLink size={10} />
              </a>{' '}
              and log in (create an account if needed).
            </li>
            <li>
              Click <strong className="text-rs-text">Register Your Application</strong>.
            </li>
            <li>
              Enter any name (e.g. &quot;RetroSync&quot;), set the OAuth Redirect URL to{' '}
              <code className="rounded bg-rs-bg px-1 py-0.5 font-mono text-rs-text">
                http://localhost
              </code>
              , and choose a category.
            </li>
            <li>
              After creating the app, click <strong className="text-rs-text">Manage</strong> to find
              your <strong className="text-rs-text">Client ID</strong>. Generate a{' '}
              <strong className="text-rs-text">Client Secret</strong> and copy both values here.
            </li>
          </ol>
        </div>
      )}

      {/* Credential inputs */}
      <div className="w-full space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-rs-text-secondary">
            Client ID
          </label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value)
              setStatus('idle')
              setSkipped(false)
            }}
            placeholder="e.g. abc123def456..."
            className="w-full rounded-lg border border-rs-border bg-rs-panel-light px-3 py-2.5 text-sm text-rs-text outline-none transition-colors placeholder:text-rs-text-secondary/40 focus:border-rs-accent"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-rs-text-secondary">
            Client Secret
          </label>
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              value={clientSecret}
              onChange={(e) => {
                setClientSecret(e.target.value)
                setStatus('idle')
                setSkipped(false)
              }}
              placeholder="e.g. xyz789..."
              className="w-full rounded-lg border border-rs-border bg-rs-panel-light px-3 py-2.5 pr-10 text-sm text-rs-text outline-none transition-colors placeholder:text-rs-text-secondary/40 focus:border-rs-accent"
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-rs-text-secondary hover:text-rs-text transition-colors"
              aria-label={showSecret ? 'Hide secret' : 'Show secret'}
            >
              {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Test button + status */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!canTest || status === 'testing'}
          onClick={handleTest}
          className="rounded-lg bg-rs-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rs-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === 'testing' ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Testing...
            </span>
          ) : (
            'Test Connection'
          )}
        </button>

        {status === 'connected' && (
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <CheckCircle2 size={14} />
            Connected
          </span>
        )}
        {status === 'error' && (
          <span className="flex items-center gap-1.5 text-xs text-red-400">
            <XCircle size={14} />
            Invalid credentials
          </span>
        )}
      </div>

      {/* Next / Skip */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <button
          type="button"
          disabled={!canProceed}
          onClick={() => onNext({ clientId, clientSecret, skipped })}
          className="rounded-xl bg-rs-accent px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-rs-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>

        {!skipped && status !== 'connected' && (
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-rs-text-secondary hover:text-rs-text transition-colors"
          >
            Skip for now — I&apos;ll set this up later
          </button>
        )}
      </div>
    </div>
  )
}
