// ---------- Addons module barrel export ----------

export { addonRegistry } from './registry'
export { registerAddonIpcHandlers } from './ipc'
export { getAddonsDir, ensureAddonsDir, loadAddonFromDir, discoverAndLoadAddons } from './loader'
export type {
  Addon,
  AddonManifest,
  AddonInfo,
  AddonStatus,
  AddonCapability,
  AddonConfigField,
  BiosSourceEntry,
  BiosPlatformGroup,
  SourceResult,
  SourceSearchResult,
  SourceDisplayMode
} from './types'
export type { AddonContext, AddonFactory } from './context'
