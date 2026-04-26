// ---------- Addon system types ----------

/** Capabilities an addon can declare. */
export type AddonCapability = 'sources:games' | 'sources:bios' | 'metadata'

/** Display modes for source results in the game detail panel. */
export type SourceDisplayMode = 'expandable' | 'compact'

/** A single ROM source entry returned by a source-capable addon. */
export interface SourceResult {
  id: string
  romFilename: string
  fileSize: number
  region: string | null
  collection: string
  platformId: number
  /** Opaque reference the addon uses to create a transfer. */
  sourceRef: string
}

/** Result of a source search from a single addon. */
export interface SourceSearchResult {
  sources: SourceResult[]
  matchType: 'exact' | 'fuzzy' | 'none'
}

/** Status information for an addon (index state, etc.). */
export interface AddonStatus {
  indexedItems: number
  lastUpdated: string | null
  details?: Record<string, unknown>
}

// ── BIOS types ──

/** A single BIOS source entry returned by a bios-capable addon. */
export interface BiosSourceEntry {
  id: number
  romFilename: string
  romSize: number
  region: string | null
  /** Opaque reference the addon uses to create a transfer. */
  sourceRef: string
  platformId: number
  system: string
}

/** BIOS sources grouped by platform, tagged with the providing addon. */
export interface BiosPlatformGroup {
  addonId: string
  platformId: number
  system: string
  platformName: string
  sources: BiosSourceEntry[]
}

// ── Transfer contract ──

/** Progress data reported by an addon's transfer. */
export interface TransferProgress {
  /** Bytes transferred so far. */
  importedSize: number
  /** Total size in bytes (0 if unknown upfront). */
  totalSize: number
  /** Transfer speed in bytes/sec (0 if unknown). */
  speed: number
}

/** Callbacks the app provides; the addon calls them during transfer. */
export interface TransferCallbacks {
  onProgress(data: TransferProgress): void
  onComplete(): void
  onError(error: Error): void
}

/** Handle returned by createTransfer/resumeTransfer for controlling an active transfer. */
export interface TransferHandle {
  /** Whether this transfer supports in-flight pause/resume. */
  supportsPause: boolean
  /** Pause the transfer. No-op if supportsPause is false. */
  pause(): void
  /** Resume after in-flight pause. No-op if supportsPause is false. */
  resume(): void
  /** Cancel the transfer and clean up any partial data in stagingPath. */
  cancel(): void
}

/** Schema for an addon-specific config field exposed to the user. */
export interface AddonConfigField {
  key: string
  label: string
  type: 'boolean' | 'select' | 'multi-select' | 'number' | 'path'
  options?: { label: string; value: string }[]
  default: unknown
}

/** The manifest that describes an addon. */
export interface AddonManifest {
  id: string
  name: string
  version: string
  author: string
  description: string
  icon?: string
  homepage?: string
  capabilities: AddonCapability[]
  configSchema?: AddonConfigField[]
  /** JS entry point relative to addon directory (default: "index.js"). External addons only. */
  entryPoint?: string
  /** Minimum app version required to run this addon (semver). External addons only. */
  minAppVersion?: string
  /** Max parallel transfers this addon can handle. Default: no per-addon limit. */
  maxConcurrentTransfers?: number
}

/** The interface every addon must implement. */
export interface Addon {
  manifest: AddonManifest

  /** Called once when the addon is loaded / registered. */
  init?(): Promise<void>

  /** Called when the addon is being unloaded / removed. */
  destroy?(): Promise<void>

  /** Called when the addon's config changes (allows cleanup / re-index). */
  onConfigChanged?(
    oldConfig: Record<string, unknown>,
    newConfig: Record<string, unknown>
  ): Promise<void>

  // ── Source capability ──

  /** Search for ROM sources matching a game. */
  findSources?(gameName: string, platformIds: number[]): Promise<SourceSearchResult>

  /** Build/refresh the source index (for indexed addons). */
  buildIndex?(platformIds?: number[]): Promise<{ indexed: number; total: number }>

  /** Get addon-specific status information. */
  getStatus?(): AddonStatus

  /** Clear the addon's cached/indexed data. */
  clearData?(): Promise<void>

  /** Get cache size information. */
  getCacheSize?(): { files: number; bytes: number }

  // ── BIOS capability ──

  /** List available BIOS sources grouped by platform. */
  listBiosSources?(): BiosPlatformGroup[]

  // ── Transfer capability ──

  /**
   * Start a fresh transfer for a source.
   * Required for any addon declaring 'sources:games' or 'sources:bios'.
   *
   * @param sourceRef    Opaque string the addon previously returned in SourceResult
   *                     or BiosSourceEntry. The addon knows how to interpret it.
   * @param stagingPath  Absolute path to a staging file the addon must write to.
   *                     The app will move it to the final library location on
   *                     completion. Any existing file at this path should be deleted
   *                     (stale data from a previous failed attempt).
   * @param callbacks    Progress / completion / error callbacks.
   * @returns A handle the app uses to pause or cancel the active transfer.
   */
  createTransfer(
    sourceRef: string,
    stagingPath: string,
    callbacks: TransferCallbacks
  ): TransferHandle

  /**
   * Resume a previously paused transfer from existing partial staging data.
   * Optional — addons that cannot resume omit this method, and the app falls
   * back to createTransfer() (fresh start).
   *
   * @param sourceRef    Same opaque reference from the original createTransfer call.
   * @param stagingPath  Same staging path; partial data may exist here.
   * @param callbacks    Progress / completion / error callbacks.
   * @returns A handle the app uses to pause or cancel the active transfer.
   */
  resumeTransfer?(
    sourceRef: string,
    stagingPath: string,
    callbacks: TransferCallbacks
  ): TransferHandle
}

/** Serializable info about an addon (for IPC transfer to renderer). */
export interface AddonInfo {
  manifest: AddonManifest
  enabled: boolean
  builtIn: boolean
  status: AddonStatus | null
}
