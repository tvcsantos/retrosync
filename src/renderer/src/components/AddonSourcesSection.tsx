import { useEffect, useState, useCallback } from 'react'
import log from 'electron-log/renderer'
import {
  ChevronDown,
  ChevronUp,
  Import,
  Package,
  Loader2,
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  FolderOpen,
  RotateCcw
} from 'lucide-react'

// ---------- Types ----------

interface SourceResultItem {
  id: string
  romFilename: string
  fileSize: number
  region: string | null
  collection: string
  platformId: number
  sourceRef: string
}

interface SourceSearchResult {
  sources: SourceResultItem[]
  matchType: 'exact' | 'fuzzy' | 'none'
}

interface AddonSourcesResult {
  addonId: string
  addonName: string
  results: SourceSearchResult
}

type DisplayMode = 'expandable' | 'compact'

type ImportStatus = 'queued' | 'importing' | 'paused' | 'completed' | 'error'

interface ImportInfo {
  id: string
  status: ImportStatus
  progress: number
  error: string | null
}

interface AddonSourcesSectionProps {
  gameName: string
  platformIds: number[]
  displayMode: DisplayMode
}

// ---------- Helpers ----------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

function dlKey(addonId: string, romFilename: string): string {
  return `${addonId}:${romFilename}`
}

// ---------- Main component ----------

export default function AddonSourcesSection({
  gameName,
  platformIds,
  displayMode
}: AddonSourcesSectionProps): React.JSX.Element | null {
  const [addonResults, setAddonResults] = useState<AddonSourcesResult[]>([])
  const [loading, setLoading] = useState(() => !!(gameName && platformIds.length > 0))
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  // Import status map: "addonId:romFilename" → ImportInfo
  const [dlMap, setDlMap] = useState<Map<string, ImportInfo>>(new Map())

  // Reset loading/error state during render when fetch deps change (avoids
  // synchronous setState inside useEffect, which React 19 warns about).
  const fetchKey = gameName && platformIds.length > 0 ? `${gameName}:${platformIds.join(',')}` : ''
  const [prevFetchKey, setPrevFetchKey] = useState(fetchKey)
  if (fetchKey !== prevFetchKey) {
    setPrevFetchKey(fetchKey)
    if (fetchKey) {
      setLoading(true)
      setError(null)
    }
  }

  // Fetch addon sources
  useEffect(() => {
    if (!gameName || platformIds.length === 0) return

    let cancelled = false

    window.api.addons
      .findSources(gameName, platformIds)
      .then((res) => {
        if (cancelled) return
        if (res.ok && res.data) {
          setAddonResults(res.data.filter((r) => r.results.sources.length > 0))
        } else {
          setError(res.error ?? 'Failed to fetch sources')
        }
      })
      .catch((err) => {
        if (!cancelled) setError(String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [gameName, platformIds])

  // Fetch existing imports + subscribe to progress
  useEffect(() => {
    let cancelled = false

    window.api.imports.list().then((list) => {
      if (cancelled) return
      const map = new Map<string, ImportInfo>()
      for (const dl of list) {
        map.set(dlKey(dl.addonId, dl.romFilename), {
          id: dl.id,
          status: dl.status as ImportStatus,
          progress: dl.progress,
          error: dl.error ?? null
        })
      }
      setDlMap(map)
    })

    const unsubscribe = window.api.imports.onProgress((data) => {
      if (cancelled) return
      // We need the addonId+romFilename for the key, but progress events only have id.
      // Update by scanning existing map entries for matching id.
      setDlMap((prev) => {
        const next = new Map(prev)
        for (const [key, info] of next) {
          if (info.id === data.id) {
            next.set(key, {
              ...info,
              status: data.status as ImportStatus,
              progress: data.progress
            })
            return next
          }
        }
        // If not found, reload the full list (new import was added)
        window.api.imports.list().then((list) => {
          const fresh = new Map<string, ImportInfo>()
          for (const dl of list) {
            fresh.set(dlKey(dl.addonId, dl.romFilename), {
              id: dl.id,
              status: dl.status as ImportStatus,
              progress: dl.progress,
              error: dl.error ?? null
            })
          }
          setDlMap(fresh)
        })
        return prev
      })
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const handleStart = useCallback(
    async (addonId: string, src: SourceResultItem, collection: string, platformId: number) => {
      const result = await window.api.imports.start({
        addonId,
        sourceRef: src.sourceRef,
        romFilename: src.romFilename,
        gameName,
        platformId,
        collection
      })
      if (result.ok && result.data) {
        setDlMap((prev) => {
          const next = new Map(prev)
          next.set(dlKey(addonId, src.romFilename), {
            id: result.data!,
            status: 'queued',
            progress: 0,
            error: null
          })
          return next
        })
      }
    },
    [gameName]
  )

  const handlePause = useCallback(async (info: ImportInfo) => {
    await window.api.imports.pause(info.id)
    setDlMap((prev) => {
      const next = new Map(prev)
      for (const [key, val] of next) {
        if (val.id === info.id) {
          next.set(key, { ...val, status: 'paused' })
          break
        }
      }
      return next
    })
  }, [])

  const handleResume = useCallback(async (info: ImportInfo) => {
    await window.api.imports.resume(info.id)
    setDlMap((prev) => {
      const next = new Map(prev)
      for (const [key, val] of next) {
        if (val.id === info.id) {
          next.set(key, { ...val, status: 'queued' })
          break
        }
      }
      return next
    })
  }, [])

  const handleCancel = useCallback(async (info: ImportInfo) => {
    await window.api.imports.cancel(info.id)
    setDlMap((prev) => {
      const next = new Map(prev)
      for (const [key, val] of next) {
        if (val.id === info.id) {
          next.delete(key)
          break
        }
      }
      return next
    })
  }, [])

  const handleRetry = useCallback(async (info: ImportInfo) => {
    await window.api.imports.retry(info.id)
    setDlMap((prev) => {
      const next = new Map(prev)
      for (const [key, val] of next) {
        if (val.id === info.id) {
          next.set(key, { ...val, status: 'queued', error: null })
          break
        }
      }
      return next
    })
  }, [])

  const handleOpenFolder = useCallback(async (info: ImportInfo) => {
    log.info('AddonSources.openFolder → id:', info.id, 'status:', info.status)
    const result = await window.api.imports.openFolder(info.id)
    log.info('AddonSources.openFolder → result:', result)
  }, [])

  // Loading state
  if (loading) {
    return (
      <section>
        <div className="flex w-full items-center gap-2 rounded-lg border border-rs-border bg-rs-panel-light px-3.5 py-2.5">
          <Loader2 size={14} className="animate-spin text-rs-text-secondary" />
          <span className="text-sm font-medium text-rs-text-secondary">
            Searching for sources...
          </span>
        </div>
      </section>
    )
  }

  // Error state
  if (error) {
    return (
      <section>
        <div className="flex w-full items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3.5 py-2.5">
          <XCircle size={14} className="shrink-0 text-red-400" />
          <span className="text-sm font-medium text-red-400">Failed to fetch sources</span>
        </div>
      </section>
    )
  }

  // No results
  if (addonResults.length === 0) {
    return (
      <section>
        <div className="flex w-full items-center gap-2 rounded-lg border border-rs-border bg-rs-panel-light px-3.5 py-2.5">
          <Package size={14} className="text-rs-text-secondary" />
          <span className="text-sm font-medium text-rs-text-secondary">No sources available</span>
        </div>
      </section>
    )
  }

  const totalSources = addonResults.reduce((n, r) => n + r.results.sources.length, 0)
  const hasFuzzy = addonResults.some((r) => r.results.matchType === 'fuzzy')
  const matchLabel = hasFuzzy ? ' (fuzzy match)' : ''

  // ── Compact mode ──
  if (displayMode === 'compact') {
    return (
      <section>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between rounded-lg border border-rs-border bg-rs-panel-light px-3.5 py-2.5 transition-colors hover:border-rs-accent/40"
        >
          <div className="flex items-center gap-2">
            <Package size={14} className="text-emerald-400" />
            <span className="text-sm font-medium text-rs-text">
              {totalSources} source{totalSources !== 1 ? 's' : ''} found
            </span>
            {matchLabel && <span className="text-xs text-rs-text-secondary">{matchLabel}</span>}
          </div>
          {expanded ? (
            <ChevronUp size={16} className="text-rs-text-secondary" />
          ) : (
            <ChevronDown size={16} className="text-rs-text-secondary" />
          )}
        </button>

        {expanded && (
          <div className="mt-2 flex flex-col gap-1.5">
            {addonResults.map((ar) =>
              ar.results.sources.map((src) => (
                <div
                  key={`${ar.addonId}-${src.id}`}
                  className="flex items-center justify-between rounded-md border border-rs-border/50 bg-rs-panel px-3 py-2"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-xs font-medium text-rs-text">
                      {src.romFilename}
                    </span>
                    <span className="text-[10px] text-rs-text-secondary">
                      {ar.addonName} &middot; {src.collection}
                      {src.region && ` · ${src.region}`}
                      {src.fileSize > 0 && ` · ${formatBytes(src.fileSize)}`}
                    </span>
                  </div>
                  {src.sourceRef && (
                    <SourceAction
                      info={dlMap.get(dlKey(ar.addonId, src.romFilename)) ?? null}
                      compact
                      onStart={() => handleStart(ar.addonId, src, src.collection, src.platformId)}
                      onPause={handlePause}
                      onResume={handleResume}
                      onCancel={handleCancel}
                      onRetry={handleRetry}
                      onOpenFolder={handleOpenFolder}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </section>
    )
  }

  // ── Expandable mode (full Stremio-style) ──
  return (
    <section>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-rs-text"
      >
        <Package size={14} className="text-emerald-400" />
        Sources ({totalSources})
        {matchLabel && (
          <span className="text-xs font-normal text-rs-text-secondary">{matchLabel}</span>
        )}
        {expanded ? (
          <ChevronUp size={14} className="text-rs-text-secondary" />
        ) : (
          <ChevronDown size={14} className="text-rs-text-secondary" />
        )}
      </button>

      {expanded && (
        <div className="flex flex-col gap-3">
          {addonResults.map((ar) => {
            // Group sources by collection within each addon
            const grouped = new Map<string, SourceResultItem[]>()
            for (const src of ar.results.sources) {
              const existing = grouped.get(src.collection) ?? []
              existing.push(src)
              grouped.set(src.collection, existing)
            }

            return (
              <div key={ar.addonId}>
                <h4 className="mb-1.5 text-xs font-semibold text-rs-accent">{ar.addonName}</h4>
                {[...grouped.entries()].map(([collection, items]) => (
                  <div key={collection} className="mb-2">
                    <h5 className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-rs-text-secondary">
                      <Package size={11} />
                      {collection}
                    </h5>
                    <div className="flex flex-col gap-1">
                      {items.map((src) => (
                        <div
                          key={`${ar.addonId}-${src.id}`}
                          className="flex items-center justify-between rounded-lg border border-rs-border/50 bg-rs-panel-light px-3 py-2"
                        >
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate text-xs font-medium text-rs-text">
                              {src.romFilename}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-rs-text-secondary">
                              {src.region && <span>{src.region}</span>}
                              {src.fileSize > 0 && <span>{formatBytes(src.fileSize)}</span>}
                            </div>
                          </div>
                          {src.sourceRef && (
                            <SourceAction
                              info={dlMap.get(dlKey(ar.addonId, src.romFilename)) ?? null}
                              onStart={() =>
                                handleStart(ar.addonId, src, src.collection, src.platformId)
                              }
                              onPause={handlePause}
                              onResume={handleResume}
                              onCancel={handleCancel}
                              onRetry={handleRetry}
                              onOpenFolder={handleOpenFolder}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ---------- SourceAction: status-aware button/badge ----------

function SourceAction({
  info,
  compact,
  onStart,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onOpenFolder
}: {
  info: ImportInfo | null
  compact?: boolean
  onStart: () => void
  onPause: (info: ImportInfo) => void
  onResume: (info: ImportInfo) => void
  onCancel: (info: ImportInfo) => void
  onRetry: (info: ImportInfo) => void
  onOpenFolder: (info: ImportInfo) => void
}): React.JSX.Element {
  const iconSize = compact ? 12 : 11
  const pillBase =
    'ml-2 flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors'

  // No import record → show Import button
  if (!info) {
    if (compact) {
      return (
        <button
          type="button"
          onClick={onStart}
          className="ml-2 shrink-0 rounded p-1 text-rs-text-secondary transition-colors hover:bg-rs-panel-light hover:text-rs-accent"
          title="Import"
        >
          <Import size={14} />
        </button>
      )
    }
    return (
      <button
        type="button"
        onClick={onStart}
        className={`${pillBase} border border-rs-border text-rs-text-secondary hover:border-rs-accent hover:text-rs-accent`}
      >
        <Import size={iconSize} />
        Import
      </button>
    )
  }

  switch (info.status) {
    case 'queued':
      return (
        <button
          type="button"
          onClick={() => onCancel(info)}
          title="Cancel"
          className={`${pillBase} border border-amber-500/30 text-amber-400`}
        >
          <Clock size={iconSize} />
          {!compact && 'Queued'}
        </button>
      )

    case 'importing':
      return (
        <button
          type="button"
          onClick={() => onPause(info)}
          title="Pause"
          className={`${pillBase} border border-emerald-500/30 text-emerald-400`}
        >
          <Loader2 size={iconSize} className="animate-spin" />
          {Math.round(info.progress * 100)}%
        </button>
      )

    case 'paused':
      return (
        <div className="ml-2 flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onResume(info)}
            title="Resume"
            className={`${pillBase} ml-0 border border-rs-border text-rs-text-secondary hover:text-rs-text`}
          >
            <Play size={iconSize} />
            {!compact && 'Paused'}
          </button>
          <button
            type="button"
            onClick={() => onCancel(info)}
            title="Cancel"
            className="rounded p-1 text-rs-text-secondary transition-colors hover:text-red-400"
          >
            <XCircle size={iconSize} />
          </button>
        </div>
      )

    case 'completed':
      return (
        <button
          type="button"
          onClick={() => onOpenFolder(info)}
          title="Open folder"
          className={`${pillBase} border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10`}
        >
          {compact ? <FolderOpen size={iconSize} /> : <CheckCircle2 size={iconSize} />}
          {!compact && 'Imported'}
        </button>
      )

    case 'error':
      return (
        <button
          type="button"
          onClick={() => onRetry(info)}
          title="Retry"
          className={`${pillBase} border border-red-500/30 text-red-400 hover:bg-red-500/10`}
        >
          <RotateCcw size={iconSize} />
          {!compact && 'Failed'}
        </button>
      )

    default:
      return <></>
  }
}
