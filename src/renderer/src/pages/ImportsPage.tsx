import { useEffect, useState } from 'react'
import log from 'electron-log/renderer'
import { Import, Pause, Play, X, FolderOpen, RotateCcw, Trash2, Loader2 } from 'lucide-react'

type ImportStatus = 'queued' | 'importing' | 'paused' | 'completed' | 'error'

interface ImportRecord {
  id: string
  addonId: string
  sourceRef: string | null
  romFilename: string
  gameName: string | null
  platformId: number
  collection: string
  status: ImportStatus
  progress: number
  totalSize: number
  importedSize: number
  savePath: string | null
  error: string | null
  createdAt: string
  completedAt: string | null
}

interface ProgressEvent {
  id: string
  status: ImportStatus
  progress: number
  importedSize: number
  totalSize: number
  speed: number
  eta: number
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`
}

function formatEta(seconds: number): string {
  if (seconds < 0) return ''
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

export default function ImportsPage(): React.JSX.Element {
  const [imports, setImports] = useState<ImportRecord[]>([])
  const [speeds, setSpeeds] = useState<Map<string, { speed: number; eta: number }>>(new Map())
  const [loading, setLoading] = useState(true)

  // Load imports on mount
  useEffect(() => {
    window.api.imports.list().then((list) => {
      setImports(list)
      setLoading(false)
    })
  }, [])

  // Subscribe to progress events
  useEffect(() => {
    const unsubscribe = window.api.imports.onProgress((data: ProgressEvent) => {
      setImports((prev) => {
        const idx = prev.findIndex((d) => d.id === data.id)
        if (idx === -1) {
          // New import appeared - reload full list
          window.api.imports.list().then(setImports)
          return prev
        }
        const updated = [...prev]
        updated[idx] = {
          ...updated[idx],
          status: data.status,
          progress: data.progress,
          importedSize: data.importedSize,
          totalSize: data.totalSize,
          completedAt:
            data.status === 'completed' ? new Date().toISOString() : updated[idx].completedAt
        }
        return updated
      })

      setSpeeds((prev) => {
        const next = new Map(prev)
        next.set(data.id, { speed: data.speed, eta: data.eta })
        return next
      })
    })

    return unsubscribe
  }, [])

  const handlePause = async (id: string): Promise<void> => {
    await window.api.imports.pause(id)
    setImports((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'paused' as const } : d)))
  }

  const handleResume = async (id: string): Promise<void> => {
    await window.api.imports.resume(id)
    setImports((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'queued' as const } : d)))
  }

  const handleCancel = async (id: string): Promise<void> => {
    await window.api.imports.cancel(id)
    setImports((prev) => prev.filter((d) => d.id !== id))
  }

  const handleRemove = async (id: string): Promise<void> => {
    await window.api.imports.remove(id)
    setImports((prev) => prev.filter((d) => d.id !== id))
  }

  const handleRetry = async (id: string): Promise<void> => {
    await window.api.imports.retry(id)
    setImports((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: 'queued' as const, error: null } : d))
    )
  }

  const handleOpenFolder = async (id: string): Promise<void> => {
    log.info('ImportsPage.openFolder → id:', id)
    const result = await window.api.imports.openFolder(id)
    log.info('ImportsPage.openFolder → result:', result)
  }

  const handleClearCompleted = async (): Promise<void> => {
    await window.api.imports.clearCompleted()
    setImports((prev) => prev.filter((d) => d.status !== 'completed'))
  }

  // Sort: active/queued first, then completed, then errors
  const statusOrder: Record<ImportStatus, number> = {
    importing: 0,
    queued: 1,
    paused: 2,
    error: 3,
    completed: 4
  }
  const sorted = [...imports].sort((a, b) => statusOrder[a.status] - statusOrder[b.status])
  const hasCompleted = imports.some((d) => d.status === 'completed')

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-rs-text-secondary" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-rs-text">Imports</h1>
        {hasCompleted && (
          <button
            type="button"
            onClick={handleClearCompleted}
            className="flex items-center gap-1.5 rounded-lg border border-rs-border px-3 py-1.5 text-xs font-medium text-rs-text-secondary transition-colors hover:bg-rs-panel-light hover:text-rs-text"
          >
            <Trash2 size={13} />
            Clear completed
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <Import size={48} strokeWidth={1} className="text-rs-text-secondary/30" />
          <p className="text-sm font-medium text-rs-text-secondary">No imports yet</p>
          <p className="max-w-xs text-center text-xs text-rs-text-secondary/60">
            Browse games and click import on available sources
          </p>
        </div>
      ) : (
        <div className="flex max-w-2xl flex-col gap-3">
          {sorted.map((dl) => {
            const info = speeds.get(dl.id)
            return (
              <ImportItem
                key={dl.id}
                record={dl}
                speed={info?.speed ?? 0}
                eta={info?.eta ?? -1}
                onPause={handlePause}
                onResume={handleResume}
                onCancel={handleCancel}
                onRemove={handleRemove}
                onRetry={handleRetry}
                onOpenFolder={handleOpenFolder}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------- ImportItem component ----------

function ImportItem({
  record: dl,
  speed,
  eta,
  onPause,
  onResume,
  onCancel,
  onRemove,
  onRetry,
  onOpenFolder
}: {
  record: ImportRecord
  speed: number
  eta: number
  onPause: (id: string) => void
  onResume: (id: string) => void
  onCancel: (id: string) => void
  onRemove: (id: string) => void
  onRetry: (id: string) => void
  onOpenFolder: (id: string) => void
}): React.JSX.Element {
  const pct = Math.round(dl.progress * 100)

  const statusBadge = (): React.JSX.Element | null => {
    switch (dl.status) {
      case 'importing':
        return (
          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
            <Loader2 size={10} className="animate-spin" />
            Importing
          </span>
        )
      case 'queued':
        return <span className="text-[10px] font-medium text-amber-400">Queued</span>
      case 'paused':
        return <span className="text-[10px] font-medium text-rs-text-secondary">Paused</span>
      case 'completed':
        return <span className="text-[10px] font-medium text-emerald-400">Completed</span>
      case 'error':
        return <span className="text-[10px] font-medium text-red-400">Error</span>
      default:
        return null
    }
  }

  return (
    <div className="rounded-xl border border-rs-border bg-rs-panel p-4">
      {/* Header row */}
      <div className="mb-1.5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-rs-text">{dl.romFilename}</p>
          <p className="mt-0.5 text-[10px] text-rs-text-secondary">
            {dl.gameName && <span>{dl.gameName} &middot; </span>}
            {dl.collection}
          </p>
        </div>
        {statusBadge()}
      </div>

      {/* Progress bar (active/paused states) */}
      {(dl.status === 'importing' || dl.status === 'paused' || dl.status === 'queued') && (
        <div className="mb-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-rs-panel-light">
            <div
              className={`h-full rounded-full transition-all ${
                dl.status === 'paused' ? 'bg-rs-text-secondary' : 'bg-emerald-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-rs-text-secondary">
            <span>
              {dl.status === 'importing' && speed > 0
                ? `${formatSpeed(speed)} · ${formatEta(eta)}`
                : dl.status === 'queued'
                  ? 'Waiting...'
                  : `${pct}%`}
            </span>
            <span>
              {formatBytes(dl.importedSize)} / {formatBytes(dl.totalSize)}
            </span>
          </div>
        </div>
      )}

      {/* Completed info */}
      {dl.status === 'completed' && (
        <p className="mb-2 text-[10px] text-rs-text-secondary">{formatBytes(dl.totalSize)}</p>
      )}

      {/* Error message */}
      {dl.status === 'error' && dl.error && (
        <p className="mb-2 truncate text-[10px] text-red-400">{dl.error}</p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1.5">
        {dl.status === 'importing' && (
          <ActionButton icon={Pause} label="Pause" onClick={() => onPause(dl.id)} />
        )}
        {dl.status === 'paused' && (
          <ActionButton icon={Play} label="Resume" onClick={() => onResume(dl.id)} />
        )}
        {(dl.status === 'importing' || dl.status === 'paused' || dl.status === 'queued') && (
          <ActionButton icon={X} label="Cancel" onClick={() => onCancel(dl.id)} danger />
        )}
        {dl.status === 'completed' && (
          <>
            <ActionButton
              icon={FolderOpen}
              label="Open folder"
              onClick={() => onOpenFolder(dl.id)}
            />
            <ActionButton icon={X} label="Remove" onClick={() => onRemove(dl.id)} />
          </>
        )}
        {dl.status === 'error' && (
          <>
            <ActionButton icon={RotateCcw} label="Retry" onClick={() => onRetry(dl.id)} />
            <ActionButton icon={X} label="Remove" onClick={() => onRemove(dl.id)} />
          </>
        )}
      </div>
    </div>
  )
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  danger
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  danger?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${
        danger
          ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
          : 'border-rs-border text-rs-text-secondary hover:bg-rs-panel-light hover:text-rs-text'
      }`}
    >
      <Icon size={11} />
      {label}
    </button>
  )
}
