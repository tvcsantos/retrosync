// ---------- Addon context ----------
// Defines the context object passed to external addons, giving them
// controlled access to the app's database, config, and logging.

import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'

/**
 * Context provided to an addon's factory function.
 * This is the addon's gateway to the host app's infrastructure.
 */
export interface AddonContext {
  /** Drizzle ORM instance for querying the app's shared database. */
  db: BaseSQLiteDatabase<'sync', unknown>

  /** Read this addon's config section from `addons.config.{addonId}`. */
  getAddonConfig(): Record<string, unknown>

  /** Resolved platform IDs for the user's configured devices. */
  getActivePlatformIds(): number[]

  /** The addon's install directory (contains index.js, manifest.json, migrations/, etc.). */
  addonDir: string

  /** Writable directory for the addon to store its own cache/data files. */
  dataDir: string

  /** Scoped logger for the addon. */
  log: {
    info(...args: unknown[]): void
    warn(...args: unknown[]): void
    error(...args: unknown[]): void
    debug(...args: unknown[]): void
  }

  /**
   * Dynamically import a module from the host app's node_modules.
   * Use this for heavy/native dependencies (e.g. webtorrent) that the host
   * already ships rather than bundling them into the addon.
   */
  hostImport(moduleId: string): Promise<unknown>
}

/**
 * The function signature an external addon's index.js must default-export.
 * The loader calls this, passing the context, and expects an Addon back.
 */
export type AddonFactory = (context: AddonContext) => import('./types').Addon
