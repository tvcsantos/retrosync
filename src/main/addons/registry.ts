// ---------- Addon registry ----------
// Manages all addons (built-in + user-installed), enables querying
// them in parallel, and exposes a single API surface for the IPC layer.

import { join } from 'path'
import { existsSync, rmSync, mkdirSync, cpSync } from 'fs'
import log from 'electron-log/main'
import type {
  Addon,
  AddonInfo,
  AddonManifest,
  AddonStatus,
  BiosPlatformGroup,
  SourceSearchResult
} from './types'
import { getConfig, setConfig } from '../config'
import { getActivePlatformIds } from '../platforms'
import { discoverAndLoadAddons, getAddonsDir, loadAddonFromDir, readManifest } from './loader'

const regLog = log.scope('addon-registry')

interface RegisteredAddon {
  addon: Addon
  builtIn: boolean
}

class AddonRegistry {
  private addons: Map<string, RegisteredAddon> = new Map()

  /** Register a built-in addon (cannot be removed, only disabled). */
  async registerBuiltIn(addon: Addon): Promise<void> {
    const id = addon.manifest.id
    regLog.info('registering built-in addon:', id)
    this.addons.set(id, { addon, builtIn: true })
    if (addon.init) {
      await addon.init()
    }
  }

  /** Register an external (user-installed) addon. */
  async registerExternal(addon: Addon): Promise<void> {
    const id = addon.manifest.id
    regLog.info('registering external addon:', id)
    this.addons.set(id, { addon, builtIn: false })
    if (addon.init) {
      await addon.init()
    }
  }

  /** Discover and load all external addons from the addons directory. */
  async loadExternalAddons(): Promise<void> {
    const addons = await discoverAndLoadAddons()
    for (const addon of addons) {
      try {
        await this.registerExternal(addon)
      } catch (err) {
        regLog.error('Failed to register external addon:', addon.manifest.id, err)
      }
    }
  }

  /**
   * Install an addon from a source path (directory or extracted zip).
   * Copies the addon into {userData}/addons/{id}/, loads and registers it.
   * Returns the addon manifest on success.
   */
  async installFromPath(sourcePath: string): Promise<AddonManifest> {
    // Validate the manifest before copying
    const manifest = readManifest(sourcePath)
    const addonId = manifest.id

    // Check if already installed
    if (this.addons.has(addonId)) {
      // Unload the existing version first
      const existing = this.addons.get(addonId)!
      if (existing.addon.destroy) {
        await existing.addon.destroy()
      }
      this.addons.delete(addonId)
    }

    // Copy to addons directory
    const destDir = join(getAddonsDir(), addonId)
    if (existsSync(destDir)) {
      rmSync(destDir, { recursive: true, force: true })
    }
    mkdirSync(destDir, { recursive: true })
    cpSync(sourcePath, destDir, { recursive: true })

    // Load and register
    const addon = await loadAddonFromDir(destDir)
    await this.registerExternal(addon)

    // Auto-enable
    this.setEnabled(addonId, true)

    regLog.info('Installed addon:', addonId, 'v' + manifest.version)
    return manifest
  }

  /**
   * Uninstall a user-installed addon.
   * Destroys the addon, removes it from the registry, disables it,
   * and deletes the addon directory from disk.
   */
  async uninstall(addonId: string): Promise<boolean> {
    const entry = this.addons.get(addonId)
    if (!entry) return false
    if (entry.builtIn) {
      regLog.warn('cannot uninstall built-in addon:', addonId)
      return false
    }

    // Destroy
    if (entry.addon.destroy) {
      await entry.addon.destroy()
    }
    this.addons.delete(addonId)

    // Disable in config
    this.setEnabled(addonId, false)

    // Delete from disk
    const addonDir = join(getAddonsDir(), addonId)
    if (existsSync(addonDir)) {
      rmSync(addonDir, { recursive: true, force: true })
    }

    regLog.info('Uninstalled addon:', addonId)
    return true
  }

  /** Get the set of enabled addon IDs from config. */
  private getEnabledIds(): Set<string> {
    const config = getConfig()
    return new Set(config.addons?.enabled ?? [])
  }

  /** Check if an addon is enabled. */
  isEnabled(addonId: string): boolean {
    return this.getEnabledIds().has(addonId)
  }

  /** Enable or disable an addon. */
  setEnabled(addonId: string, enabled: boolean): void {
    const config = getConfig()
    const current = new Set(config.addons?.enabled ?? [])
    if (enabled) {
      current.add(addonId)
    } else {
      current.delete(addonId)
    }
    setConfig({ addons: { ...config.addons, enabled: [...current] } })
    regLog.info('addon', addonId, enabled ? 'enabled' : 'disabled')
  }

  /** Remove a user-installed addon. Built-in addons cannot be removed. */
  async remove(addonId: string): Promise<boolean> {
    const entry = this.addons.get(addonId)
    if (!entry) return false
    if (entry.builtIn) {
      regLog.warn('cannot remove built-in addon:', addonId)
      return false
    }
    if (entry.addon.destroy) {
      await entry.addon.destroy()
    }
    this.addons.delete(addonId)
    // Also disable
    this.setEnabled(addonId, false)
    regLog.info('removed addon:', addonId)
    return true
  }

  /** Get a specific addon by ID. */
  get(addonId: string): Addon | undefined {
    return this.addons.get(addonId)?.addon
  }

  /** Get all registered addons as serializable info. */
  getAll(): AddonInfo[] {
    const enabledIds = this.getEnabledIds()
    const result: AddonInfo[] = []
    for (const [, entry] of this.addons) {
      const id = entry.addon.manifest.id
      result.push({
        manifest: entry.addon.manifest,
        enabled: enabledIds.has(id),
        builtIn: entry.builtIn,
        status: entry.addon.getStatus?.() ?? null
      })
    }
    return result
  }

  /** Get enabled addons that have findSources. */
  private getEnabledSourceAddons(): Addon[] {
    const enabledIds = this.getEnabledIds()
    const result: Addon[] = []
    for (const [, entry] of this.addons) {
      if (
        enabledIds.has(entry.addon.manifest.id) &&
        entry.addon.manifest.capabilities.includes('sources:games') &&
        entry.addon.findSources
      ) {
        result.push(entry.addon)
      }
    }
    return result
  }

  /**
   * Query all enabled source addons for a game, in parallel.
   * Returns results tagged by addon ID.
   */
  async findSources(
    gameName: string,
    platformIds: number[]
  ): Promise<{ addonId: string; addonName: string; results: SourceSearchResult }[]> {
    const addons = this.getEnabledSourceAddons()
    if (addons.length === 0) return []

    const settled = await Promise.allSettled(
      addons.map(async (addon) => {
        const results = await addon.findSources!(gameName, platformIds)
        return {
          addonId: addon.manifest.id,
          addonName: addon.manifest.name,
          results
        }
      })
    )

    const output: { addonId: string; addonName: string; results: SourceSearchResult }[] = []
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        output.push(result.value)
      } else {
        regLog.error('addon findSources failed:', result.reason)
      }
    }
    return output
  }

  /** Build index for a specific addon. */
  async buildIndex(
    addonId: string,
    platformIds?: number[]
  ): Promise<{ indexed: number; total: number }> {
    const addon = this.get(addonId)
    if (!addon?.buildIndex) {
      throw new Error(`Addon '${addonId}' does not support buildIndex`)
    }
    const ids = platformIds ?? getActivePlatformIds(getConfig())
    return addon.buildIndex(ids)
  }

  /** Get status for a specific addon. */
  getStatus(addonId: string): AddonStatus | null {
    const addon = this.get(addonId)
    return addon?.getStatus?.() ?? null
  }

  /** Clear data for a specific addon. */
  async clearData(addonId: string): Promise<void> {
    const addon = this.get(addonId)
    if (!addon?.clearData) {
      throw new Error(`Addon '${addonId}' does not support clearData`)
    }
    await addon.clearData()
  }

  /** Get config for a specific addon. */
  getAddonConfig(addonId: string): Record<string, unknown> {
    const config = getConfig()
    return (config.addons?.config?.[addonId] as Record<string, unknown>) ?? {}
  }

  /** Set config for a specific addon. */
  setAddonConfig(addonId: string, addonConfig: Record<string, unknown>): void {
    const config = getConfig()
    const allAddonConfigs = config.addons?.config ?? {}
    const oldConfig = (allAddonConfigs[addonId] as Record<string, unknown>) ?? {}
    setConfig({
      addons: {
        ...config.addons,
        config: { ...allAddonConfigs, [addonId]: addonConfig }
      }
    })
    // Notify addon of config change (fire-and-forget)
    const addon = this.get(addonId)
    if (addon?.onConfigChanged) {
      addon.onConfigChanged(oldConfig, addonConfig).catch((err) => {
        regLog.error('addon onConfigChanged failed:', addonId, err)
      })
    }
  }

  /** Get cache size from a specific addon. */
  getCacheSize(addonId: string): { files: number; bytes: number } | null {
    const addon = this.get(addonId)
    return addon?.getCacheSize?.() ?? null
  }

  // ── BIOS capability ──

  /** Get enabled addons that have listBiosSources. */
  private getEnabledBiosAddons(): Addon[] {
    const enabledIds = this.getEnabledIds()
    const result: Addon[] = []
    for (const [, entry] of this.addons) {
      if (
        enabledIds.has(entry.addon.manifest.id) &&
        entry.addon.manifest.capabilities.includes('sources:bios') &&
        entry.addon.listBiosSources
      ) {
        result.push(entry.addon)
      }
    }
    return result
  }

  /**
   * Query all enabled BIOS addons and merge their platform groups.
   * Each group carries the addonId of the providing addon.
   */
  listBiosSources(): BiosPlatformGroup[] {
    const addons = this.getEnabledBiosAddons()
    const allGroups: BiosPlatformGroup[] = []
    for (const addon of addons) {
      try {
        const groups = addon.listBiosSources!()
        allGroups.push(...groups)
      } catch (err) {
        regLog.error('addon listBiosSources failed:', addon.manifest.id, err)
      }
    }
    return allGroups
  }
}

/** Singleton registry instance. */
export const addonRegistry = new AddonRegistry()
