import { ElectronAPI } from '@electron-toolkit/preload'

interface IpcResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
  path?: string
}

interface IGDBApi {
  search: (query: string) => Promise<IpcResult>
  getGame: (igdbId: number) => Promise<IpcResult>
  getDashboard: () => Promise<IpcResult>
  getGameTypes: () => Promise<{
    gameTypes: { id: number; label: string }[]
    defaultExcluded: number[]
  }>
  cacheImage: (imageId: string, size: string) => Promise<IpcResult>
  cacheSize: () => Promise<{ files: number; bytes: number }>
  clearCache: () => Promise<IpcResult>
}

interface CustomDeviceConfig {
  id: string
  name: string
  platformIds: number[]
}

interface AddonsConfigShape {
  enabled: string[]
  sourcesDisplayMode: 'expandable' | 'compact'
  config: Record<string, unknown>
}

interface AppConfigShape {
  igdb: {
    clientId: string
    clientSecret: string
  }
  igdbSetupSkipped: boolean
  igdbExcludedGameTypes: number[]
  devices: string[]
  customDevices: CustomDeviceConfig[]
  addons: AddonsConfigShape
  libraryPath: string
  importPath: string
  maxConcurrentImports: number
  importsBadgeStyle: 'count' | 'dot' | 'none'
}

interface ConfigApi {
  get: () => Promise<AppConfigShape>
  set: (config: Record<string, unknown>) => Promise<AppConfigShape>
  testIgdb: () => Promise<boolean>
}

interface DeviceProfileShape {
  id: string
  name: string
  manufacturer: string
  platformIds: number[]
}

interface PlatformInfoShape {
  igdbId: number
  name: string
  shortName: string
}

interface DevicesApi {
  getProfiles: () => Promise<DeviceProfileShape[]>
  getPlatforms: () => Promise<PlatformInfoShape[]>
}

interface LibraryGameSnapshot {
  igdbId: number
  title: string
  platforms: string[]
  platformsShort: string[]
  coverImageId?: string
  year?: number
  developer?: string
  genre?: string
  description?: string
  rating?: number
  igdbUrl?: string
  igdbGameType?: number
}

interface LibraryApi {
  getAll: () => Promise<LibraryGameSnapshot[]>
  add: (snapshot: LibraryGameSnapshot) => Promise<{ ok: boolean }>
  remove: (igdbId: number) => Promise<{ ok: boolean }>
  isIn: (igdbId: number) => Promise<boolean>
}

// ---------- Addon types ----------

interface AddonConfigFieldShape {
  key: string
  label: string
  type: 'boolean' | 'select' | 'multi-select' | 'number' | 'path'
  options?: { label: string; value: string }[]
  default: unknown
}

interface AddonManifestShape {
  id: string
  name: string
  version: string
  author: string
  description: string
  icon?: string
  homepage?: string
  capabilities: ('sources:games' | 'sources:bios' | 'metadata')[]
  configSchema?: AddonConfigFieldShape[]
}

interface AddonStatusShape {
  indexedItems: number
  lastUpdated: string | null
  details?: Record<string, unknown>
}

interface AddonInfoShape {
  manifest: AddonManifestShape
  enabled: boolean
  builtIn: boolean
  status: AddonStatusShape | null
}

interface SourceResultShape {
  id: string
  romFilename: string
  fileSize: number
  region: string | null
  collection: string
  platformId: number
  sourceRef: string
}

interface SourceSearchResultShape {
  sources: SourceResultShape[]
  matchType: 'exact' | 'fuzzy' | 'none'
}

interface AddonSourcesResultShape {
  addonId: string
  addonName: string
  results: SourceSearchResultShape
}

interface AddonsApi {
  list: () => Promise<AddonInfoShape[]>
  findSources: (
    gameName: string,
    platformIds: number[]
  ) => Promise<IpcResult<AddonSourcesResultShape[]>>
  getStatus: (addonId: string) => Promise<AddonStatusShape | null>
  buildIndex: (
    addonId: string,
    platformIds?: number[]
  ) => Promise<IpcResult<{ indexed: number; total: number }>>
  clearData: (addonId: string) => Promise<IpcResult>
  setEnabled: (addonId: string, enabled: boolean) => Promise<{ ok: boolean }>
  remove: (addonId: string) => Promise<{ ok: boolean }>
  getConfig: (addonId: string) => Promise<Record<string, unknown>>
  setConfig: (addonId: string, config: Record<string, unknown>) => Promise<{ ok: boolean }>
  cacheSize: (addonId: string) => Promise<{ files: number; bytes: number } | null>
  install: () => Promise<IpcResult<{ manifest: AddonManifestShape; sourcePath: string }>>
  installConfirm: (sourcePath: string) => Promise<IpcResult<AddonManifestShape>>
  uninstall: (addonId: string) => Promise<{ ok: boolean; error?: string }>
  selectFolder: () => Promise<string | null>
}

// ---------- Import types ----------

type ImportStatusShape = 'queued' | 'importing' | 'paused' | 'completed' | 'error'

interface ImportRecordShape {
  id: string
  addonId: string
  sourceRef: string | null
  romFilename: string
  gameName: string | null
  platformId: number
  collection: string
  status: ImportStatusShape
  progress: number
  totalSize: number
  importedSize: number
  savePath: string | null
  error: string | null
  createdAt: string
  completedAt: string | null
}

interface StartImportParamsShape {
  addonId: string
  sourceRef: string
  romFilename: string
  gameName: string
  platformId: number
  collection: string
  saveSubdir?: string
}

interface ImportProgressEventShape {
  id: string
  status: ImportStatusShape
  progress: number
  importedSize: number
  totalSize: number
  speed: number
  eta: number
}

interface ImportsApi {
  start: (params: StartImportParamsShape) => Promise<IpcResult<string>>
  pause: (id: string) => Promise<{ ok: boolean }>
  resume: (id: string) => Promise<{ ok: boolean }>
  cancel: (id: string) => Promise<{ ok: boolean }>
  remove: (id: string) => Promise<{ ok: boolean }>
  retry: (id: string) => Promise<{ ok: boolean }>
  list: () => Promise<ImportRecordShape[]>
  clearCompleted: () => Promise<{ ok: boolean }>
  openFile: (id: string) => Promise<{ ok: boolean }>
  openFolder: (id: string) => Promise<{ ok: boolean }>
  selectLibraryPath: () => Promise<string | null>
  selectImportPath: () => Promise<string | null>
  checkSameFs: (pathA: string, pathB: string) => Promise<boolean>
  onProgress: (callback: (data: ImportProgressEventShape) => void) => () => void
  onListChanged: (callback: () => void) => () => void
}

// ---------- BIOS types ----------

interface BiosSourceEntryShape {
  id: number
  romFilename: string
  romSize: number
  region: string | null
  sourceRef: string
  platformId: number
  system: string
}

interface BiosPlatformGroupShape {
  addonId: string
  platformId: number
  system: string
  platformName: string
  sources: BiosSourceEntryShape[]
}

interface LocalBiosFileShape {
  name: string
  size: number
}

interface LocalBiosStatusShape {
  platformId: number
  system: string
  platformName: string
  files: LocalBiosFileShape[]
}

interface BiosApi {
  listSources: () => Promise<IpcResult<BiosPlatformGroupShape[]>>
  install: (zipPath: string, system: string) => Promise<IpcResult<string[]>>
  getDir: () => Promise<string>
  scanLocal: () => Promise<LocalBiosStatusShape[]>
  openFolder: (system: string) => Promise<void>
  deleteFile: (system: string, filename: string) => Promise<IpcResult>
}

interface CustomApi {
  igdb: IGDBApi
  config: ConfigApi
  devices: DevicesApi
  library: LibraryApi
  addons: AddonsApi
  imports: ImportsApi
  bios: BiosApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomApi
  }
}
