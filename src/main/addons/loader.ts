// ---------- Addon loader ----------
// Discovers and dynamically loads external addon packages from disk.
// Addons live in {userData}/addons/{addonId}/ and must have a manifest.json.

import { app } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { createRequire } from 'module'
import { existsSync, readdirSync, readFileSync, statSync, mkdirSync } from 'fs'
import log from 'electron-log/main'
import type { Addon, AddonManifest, AddonCapability } from './types'
import type { AddonContext, AddonFactory } from './context'
import { getDb, getSqlite } from '../db'
import { getConfig } from '../config'
import { getActivePlatformIds } from '../platforms'
import { addonRegistry } from './registry'

const loadLog = log.scope('addon-loader')

/** Return the root directory where external addons are installed. */
export function getAddonsDir(): string {
  return join(app.getPath('userData'), 'addons')
}

/** Ensure the addons directory exists. */
export function ensureAddonsDir(): string {
  const dir = getAddonsDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

// ── Manifest validation ──

const VALID_CAPABILITIES: AddonCapability[] = ['sources:games', 'sources:bios', 'metadata']

function validateManifest(raw: unknown, addonDir: string): AddonManifest {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`Invalid manifest in ${addonDir}: not an object`)
  }

  const m = raw as Record<string, unknown>

  // Required string fields
  for (const field of ['id', 'name', 'version', 'author', 'description']) {
    if (typeof m[field] !== 'string' || (m[field] as string).length === 0) {
      throw new Error(`Invalid manifest in ${addonDir}: missing or empty "${field}"`)
    }
  }

  // Capabilities
  if (!Array.isArray(m.capabilities) || m.capabilities.length === 0) {
    throw new Error(`Invalid manifest in ${addonDir}: "capabilities" must be a non-empty array`)
  }
  for (const cap of m.capabilities) {
    if (!VALID_CAPABILITIES.includes(cap as AddonCapability)) {
      throw new Error(`Invalid manifest in ${addonDir}: unknown capability "${cap}"`)
    }
  }

  return {
    id: m.id as string,
    name: m.name as string,
    version: m.version as string,
    author: m.author as string,
    description: m.description as string,
    icon: typeof m.icon === 'string' ? m.icon : undefined,
    homepage: typeof m.homepage === 'string' ? m.homepage : undefined,
    capabilities: m.capabilities as AddonCapability[],
    configSchema: Array.isArray(m.configSchema) ? m.configSchema : undefined,
    entryPoint: typeof m.main === 'string' ? m.main : 'index.js',
    minAppVersion: typeof m.minAppVersion === 'string' ? m.minAppVersion : undefined
  }
}

// ── Single addon loading ──

/** Build an AddonContext for a specific addon. */
export function buildContext(addonId: string, addonDir: string, dataDir: string): AddonContext {
  const addonLog = log.scope(`addon:${addonId}`)
  return {
    db: getDb() as unknown as AddonContext['db'],
    sqlite: getSqlite(),
    getAddonConfig: () => addonRegistry.getAddonConfig(addonId),
    getActivePlatformIds: () => getActivePlatformIds(getConfig()),
    addonDir,
    dataDir,
    log: {
      info: (...args: unknown[]) => addonLog.info(...args),
      warn: (...args: unknown[]) => addonLog.warn(...args),
      error: (...args: unknown[]) => addonLog.error(...args),
      debug: (...args: unknown[]) => addonLog.debug(...args)
    },
    hostImport: async (moduleId: string) => {
      // Resolve from the addon's own node_modules first, then fall back to the host.
      // Use createRequire.resolve() to find the path, then dynamic import() to load it
      // (supports both CJS and ESM packages).
      const addonRequire = createRequire(join(addonDir, 'package.json'))
      try {
        const resolved = addonRequire.resolve(moduleId)
        return await import(pathToFileURL(resolved).href)
      } catch {
        return await import(moduleId)
      }
    }
  }
}

/**
 * Load a single addon from a directory.
 * @param addonDir Absolute path to the addon folder (contains manifest.json)
 */
export async function loadAddonFromDir(addonDir: string): Promise<Addon> {
  // 1. Read and validate manifest
  const manifestPath = join(addonDir, 'manifest.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`No manifest.json found in ${addonDir}`)
  }

  const manifestRaw = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  const manifest = validateManifest(manifestRaw, addonDir)

  // 2. Resolve entry point
  const entryPoint = manifest.entryPoint ?? 'index.js'
  const entryPath = join(addonDir, entryPoint)
  if (!existsSync(entryPath)) {
    throw new Error(`Entry point "${entryPoint}" not found in ${addonDir}`)
  }

  // 3. Build context
  const dataDir = join(addonDir, 'data')
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  const context = buildContext(manifest.id, addonDir, dataDir)

  // 4. Load the addon module
  loadLog.info(`Loading addon "${manifest.id}" from ${addonDir}`)

  // Use a cache-busting query param so re-installs pick up new code
  const mod = await import(`${pathToFileURL(entryPath).href}?t=${Date.now()}`)
  // CJS interop: import() wraps module.exports as mod.default,
  // so a CJS `exports.default = fn` becomes mod.default.default
  const exported = mod.default ?? mod
  const factory: AddonFactory =
    typeof exported === 'function'
      ? exported
      : typeof exported.default === 'function'
        ? exported.default
        : exported

  if (typeof factory !== 'function') {
    throw new Error(`Addon "${manifest.id}" entry point does not export a factory function`)
  }

  // 5. Call the factory
  const addon = factory(context)

  // Ensure the addon's manifest matches what we read from disk
  addon.manifest = { ...manifest }

  loadLog.info(`Addon "${manifest.id}" v${manifest.version} loaded successfully`)
  return addon
}

// ── Batch discovery ──

/**
 * Scan the addons directory and load every valid addon found.
 * Invalid addons are logged and skipped.
 */
export async function discoverAndLoadAddons(): Promise<Addon[]> {
  const dir = ensureAddonsDir()
  const entries = readdirSync(dir)
  const addons: Addon[] = []

  for (const entry of entries) {
    const addonDir = join(dir, entry)
    // Skip non-directories and hidden entries
    if (!statSync(addonDir).isDirectory() || entry.startsWith('.')) continue

    try {
      const addon = await loadAddonFromDir(addonDir)
      addons.push(addon)
    } catch (err) {
      loadLog.error(`Failed to load addon from "${addonDir}":`, err)
    }
  }

  loadLog.info(`Discovered ${addons.length} external addon(s)`)
  return addons
}

/**
 * Read just the manifest from an addon directory (for install preview).
 */
export function readManifest(addonDir: string): AddonManifest {
  const manifestPath = join(addonDir, 'manifest.json')
  const raw = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  return validateManifest(raw, addonDir)
}
