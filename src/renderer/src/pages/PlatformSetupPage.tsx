import { useEffect, useState, useCallback, useMemo } from 'react'
import log from 'electron-log/renderer'
import {
  Shield,
  Import,
  ChevronDown,
  ChevronUp,
  Loader2,
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  RotateCcw,
  RefreshCw,
  FileQuestion,
  FolderOpen,
  Trash2
} from 'lucide-react'

const biosLog = log.scope('platform-setup')

// ---------- Types ----------

interface BiosSourceEntry {
  id: number
  romFilename: string
  romSize: number
  region: string | null
  sourceRef: string
  platformId: number
  system: string
}

interface BiosPlatformGroup {
  addonId: string
  platformId: number
  system: string
  platformName: string
  sources: BiosSourceEntry[]
}

type ImportStatus = 'queued' | 'importing' | 'paused' | 'completed' | 'error'

interface ImportInfo {
  id: string
  status: ImportStatus
  progress: number
  error: string | null
}

interface LocalBiosFile {
  name: string
  size: number
}

interface LocalBiosStatus {
  platformId: number
  system: string
  platformName: string
  files: LocalBiosFile[]
}

/** A row in the merged file list */
type MergedFileRow =
  | {
      type: 'source'
      source: BiosSourceEntry
      addonId: string
      localMatch: boolean
      localFilename: string | null
    }
  | { type: 'local'; file: LocalBiosFile }

/** A unified platform card */
interface UnifiedPlatform {
  platformId: number
  system: string
  platformName: string
  localCount: number
  moreCount: number
  rows: MergedFileRow[]
}

// ---------- Helpers ----------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

function dlKey(romFilename: string): string {
  return `bios:${romFilename}`
}

/** Build the unified platform list by merging local files + addon sources. */
function buildUnifiedPlatforms(
  localBios: LocalBiosStatus[],
  groups: BiosPlatformGroup[]
): UnifiedPlatform[] {
  // Index addon sources by platformId
  const sourcesByPlatform = new Map<number, { sources: BiosSourceEntry[]; addonId: string }>()
  for (const group of groups) {
    const existing = sourcesByPlatform.get(group.platformId)
    if (existing) {
      existing.sources.push(...group.sources)
    } else {
      sourcesByPlatform.set(group.platformId, {
        sources: [...group.sources],
        addonId: group.addonId
      })
    }
  }

  return localBios.map((platform) => {
    const addonData = sourcesByPlatform.get(platform.platformId)
    const sources = addonData?.sources ?? []
    const addonId = addonData?.addonId ?? ''

    // Build a map of lowercase → actual local filename for cross-referencing
    const localNameMap = new Map<string, string>()
    for (const f of platform.files) {
      localNameMap.set(f.name.toLowerCase(), f.name)
    }

    // Build a set of source filenames (lowercase) to find local-only files
    const sourceNamesLower = new Set(sources.map((s) => s.romFilename.toLowerCase()))

    const rows: MergedFileRow[] = []

    // Add addon source rows
    for (const src of sources) {
      const localFilename = localNameMap.get(src.romFilename.toLowerCase()) ?? null
      rows.push({
        type: 'source',
        source: src,
        addonId,
        localMatch: localFilename !== null,
        localFilename
      })
    }

    // Add local-only rows (files not in any addon source)
    for (const file of platform.files) {
      if (!sourceNamesLower.has(file.name.toLowerCase())) {
        rows.push({ type: 'local', file })
      }
    }

    // Sort alphabetically by filename (case-insensitive)
    rows.sort((a, b) => {
      const nameA = a.type === 'source' ? a.source.romFilename : a.file.name
      const nameB = b.type === 'source' ? b.source.romFilename : b.file.name
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' })
    })

    // Counts
    const localCount = platform.files.length
    const moreCount = sources.filter((s) => !localNameMap.has(s.romFilename.toLowerCase())).length

    return {
      platformId: platform.platformId,
      system: platform.system,
      platformName: platform.platformName,
      localCount,
      moreCount,
      rows
    }
  })
}

// ---------- Main component ----------

export default function PlatformSetupPage(): React.JSX.Element {
  const [groups, setGroups] = useState<BiosPlatformGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<number>>(new Set())
  const [localBios, setLocalBios] = useState<LocalBiosStatus[]>([])

  // Import status map: "bios:romFilename" → ImportInfo
  const [dlMap, setDlMap] = useState<Map<string, ImportInfo>>(new Map())

  // ── Fetch BIOS sources ──
  const fetchSources = useCallback(async () => {
    setLoading(true)
    try {
      const [sourcesResult, localResult] = await Promise.all([
        window.api.bios.listSources(),
        window.api.bios.scanLocal()
      ])
      if (sourcesResult.ok && sourcesResult.data) {
        setGroups(sourcesResult.data)
      }
      setLocalBios(localResult)
    } catch (err) {
      biosLog.error('fetchSources → error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Defer to microtask so the synchronous setLoading(true) inside
    // fetchSources doesn't run within the effect's synchronous body.
    queueMicrotask(() => fetchSources())
  }, [fetchSources])

  // ── Fetch existing imports + subscribe to progress ──
  useEffect(() => {
    let cancelled = false

    window.api.imports.list().then((list) => {
      if (cancelled) return
      const map = new Map<string, ImportInfo>()
      for (const dl of list) {
        if (dl.collection === 'BIOS') {
          map.set(dlKey(dl.romFilename), {
            id: dl.id,
            status: dl.status as ImportStatus,
            progress: dl.progress,
            error: dl.error ?? null
          })
        }
      }
      setDlMap(map)
    })

    const unsubscribe = window.api.imports.onProgress((data) => {
      if (cancelled) return
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
        // New import appeared — reload full list
        window.api.imports.list().then((list) => {
          const fresh = new Map<string, ImportInfo>()
          for (const dl of list) {
            if (dl.collection === 'BIOS') {
              fresh.set(dlKey(dl.romFilename), {
                id: dl.id,
                status: dl.status as ImportStatus,
                progress: dl.progress,
                error: dl.error ?? null
              })
            }
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

  // ── Import actions ──
  const handleStart = useCallback(async (src: BiosSourceEntry, addonId: string) => {
    const result = await window.api.imports.start({
      addonId,
      sourceRef: src.sourceRef,
      romFilename: src.romFilename,
      gameName: `BIOS: ${src.romFilename}`,
      platformId: src.platformId,
      collection: 'BIOS',
      saveSubdir: `BIOS/${src.system}`
    })
    if (result.ok && result.data) {
      setDlMap((prev) => {
        const next = new Map(prev)
        next.set(dlKey(src.romFilename), {
          id: result.data!,
          status: 'queued',
          progress: 0,
          error: null
        })
        return next
      })
    }
  }, [])

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
    await window.api.imports.openFolder(info.id)
  }, [])

  const togglePlatform = useCallback((platformId: number) => {
    setExpandedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(platformId)) {
        next.delete(platformId)
      } else {
        next.add(platformId)
      }
      return next
    })
  }, [])

  const handleOpenBiosFolder = useCallback(async (system: string) => {
    await window.api.bios.openFolder(system)
  }, [])

  const handleDeleteFile = useCallback(
    async (system: string, filename: string) => {
      const confirmed = window.confirm(`Delete "${filename}"? This cannot be undone.`)
      if (!confirmed) return
      const result = await window.api.bios.deleteFile(system, filename)
      if (result.ok) {
        await fetchSources()
      } else {
        biosLog.error('handleDeleteFile → error:', result.error)
      }
    },
    [fetchSources]
  )

  // ── Build unified platform list ──
  const platforms = useMemo(() => buildUnifiedPlatforms(localBios, groups), [localBios, groups])

  const totalSources = groups.reduce((n, g) => n + g.sources.length, 0)
  const hasAddonSources = groups.length > 0

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-8">
      {/* ---- Page header ---- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-rs-text">Platform Setup</h1>
          <p className="mt-1 text-sm text-rs-text-secondary">Firmware & BIOS Files</p>
        </div>
        <button
          type="button"
          onClick={fetchSources}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-rs-panel px-3 py-2 text-sm font-medium text-rs-text border border-rs-border transition-colors hover:bg-rs-panel-light disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="flex max-w-2xl flex-col gap-6">
        {/* ---- Loading state ---- */}
        {loading && localBios.length === 0 && (
          <div className="flex items-center gap-3 rounded-xl bg-rs-panel px-4 py-3 border border-rs-border">
            <Loader2 size={20} className="animate-spin text-rs-text-secondary" />
            <span className="text-sm text-rs-text-secondary">Loading BIOS sources...</span>
          </div>
        )}

        {/* ---- Summary (only when addons provide sources) ---- */}
        {hasAddonSources && (
          <div className="flex items-center gap-3 rounded-xl bg-rs-accent/10 px-4 py-3 border border-rs-accent/30">
            <Shield size={20} className="text-rs-accent" />
            <span className="text-sm font-medium text-rs-text">
              {totalSources} BIOS file{totalSources !== 1 ? 's' : ''} available across{' '}
              {groups.length} platform{groups.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* ---- BIOS Files section ---- */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-rs-text">BIOS Files</h2>
          <div className="flex flex-col gap-4">
            {platforms.map((platform) => {
              const expanded = expandedPlatforms.has(platform.platformId)
              const hasLocalFiles = platform.localCount > 0

              return (
                <section
                  key={platform.platformId}
                  className="rounded-xl bg-rs-panel border border-rs-border"
                >
                  {/* Platform header (collapsible) */}
                  <div className="flex w-full items-center justify-between px-4 py-3.5 transition-colors hover:bg-rs-panel-light">
                    <button
                      type="button"
                      onClick={() => togglePlatform(platform.platformId)}
                      className="flex flex-1 items-center gap-3"
                    >
                      {hasLocalFiles ? (
                        <CheckCircle2 size={16} className="text-emerald-400" />
                      ) : (
                        <FileQuestion size={16} className="text-rs-text-secondary/40" />
                      )}
                      <span className="text-sm font-bold text-rs-text">
                        {platform.platformName}
                      </span>
                      {hasLocalFiles ? (
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400">
                          {platform.localCount} file{platform.localCount !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="rounded-full bg-rs-panel-light px-2.5 py-0.5 text-[11px] font-medium text-rs-text-secondary">
                          No files
                        </span>
                      )}
                      {platform.moreCount > 0 && (
                        <span className="rounded-full bg-rs-panel-light px-2.5 py-0.5 text-[11px] font-medium text-rs-text-secondary">
                          {platform.moreCount} more
                        </span>
                      )}
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenBiosFolder(platform.system)}
                        title="Open folder"
                        className="rounded p-1 text-rs-text-secondary/40 transition-colors hover:text-rs-accent"
                      >
                        <FolderOpen size={14} />
                      </button>
                      <button type="button" onClick={() => togglePlatform(platform.platformId)}>
                        {expanded ? (
                          <ChevronUp size={16} className="text-rs-text-secondary" />
                        ) : (
                          <ChevronDown size={16} className="text-rs-text-secondary" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded file list */}
                  {expanded && (
                    <div className="border-t border-rs-border px-3 py-2">
                      {platform.rows.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {platform.rows.map((row) => {
                            if (row.type === 'source') {
                              const info = dlMap.get(dlKey(row.source.romFilename)) ?? null
                              return (
                                <div
                                  key={`src-${row.source.id}`}
                                  className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-rs-panel-light"
                                >
                                  <div className="flex min-w-0 flex-col gap-0.5">
                                    <span className="truncate text-xs font-medium text-rs-text">
                                      {row.source.romFilename}
                                    </span>
                                    <div className="flex items-center gap-2 text-[10px] text-rs-text-secondary">
                                      {row.source.region && <span>{row.source.region}</span>}
                                      {row.source.romSize > 0 && (
                                        <span>{formatBytes(row.source.romSize)}</span>
                                      )}
                                    </div>
                                  </div>
                                  {row.localMatch ? (
                                    <div className="ml-2 flex shrink-0 items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenBiosFolder(platform.system)}
                                        title="Open folder"
                                        className="flex items-center gap-1 rounded-md border border-rs-border px-2 py-1 text-[10px] font-medium text-rs-text-secondary transition-colors hover:border-rs-accent hover:text-rs-accent"
                                      >
                                        <FolderOpen size={11} />
                                        Open
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteFile(platform.system, row.localFilename!)
                                        }
                                        title="Delete"
                                        className="flex items-center gap-1 rounded-md border border-rs-border px-2 py-1 text-[10px] font-medium text-rs-text-secondary transition-colors hover:border-red-500/30 hover:text-red-400"
                                      >
                                        <Trash2 size={11} />
                                        Delete
                                      </button>
                                    </div>
                                  ) : (
                                    <SourceAction
                                      info={info}
                                      onStart={() => handleStart(row.source, row.addonId)}
                                      onPause={handlePause}
                                      onResume={handleResume}
                                      onCancel={handleCancel}
                                      onRetry={handleRetry}
                                      onOpenFolder={handleOpenFolder}
                                    />
                                  )}
                                </div>
                              )
                            }

                            // Local-only file
                            return (
                              <div
                                key={`local-${row.file.name}`}
                                className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-rs-panel-light"
                              >
                                <span className="truncate text-xs font-medium text-rs-text">
                                  {row.file.name}
                                </span>
                                <div className="ml-2 flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenBiosFolder(platform.system)}
                                    title="Open folder"
                                    className="flex items-center gap-1 rounded-md border border-rs-border px-2 py-1 text-[10px] font-medium text-rs-text-secondary transition-colors hover:border-rs-accent hover:text-rs-accent"
                                  >
                                    <FolderOpen size={11} />
                                    Open
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteFile(platform.system, row.file.name)}
                                    title="Delete"
                                    className="flex items-center gap-1 rounded-md border border-rs-border px-2 py-1 text-[10px] font-medium text-rs-text-secondary transition-colors hover:border-red-500/30 hover:text-red-400"
                                  >
                                    <Trash2 size={11} />
                                    Delete
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="px-3 py-2 text-xs text-rs-text-secondary">
                          No BIOS files detected.
                        </p>
                      )}
                    </div>
                  )}
                </section>
              )
            })}
            {localBios.length === 0 && !loading && (
              <p className="text-xs text-rs-text-secondary">
                No BIOS-requiring platforms detected.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- SourceAction: status-aware button/badge ----------

function SourceAction({
  info,
  onStart,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onOpenFolder
}: {
  info: ImportInfo | null
  onStart: () => void
  onPause: (info: ImportInfo) => void
  onResume: (info: ImportInfo) => void
  onCancel: (info: ImportInfo) => void
  onRetry: (info: ImportInfo) => void
  onOpenFolder: (info: ImportInfo) => void
}): React.JSX.Element {
  const iconSize = 11
  const pillBase =
    'ml-2 flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors'

  if (!info) {
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
          Queued
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
            Paused
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
          <CheckCircle2 size={iconSize} />
          Imported
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
          Failed
        </button>
      )

    default:
      return <></>
  }
}
