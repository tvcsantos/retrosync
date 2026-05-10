// ---------- Addon IPC handlers ----------
// All addon:* IPC channels are registered here.

import { ipcMain, dialog, BrowserWindow } from 'electron'
import { stat, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import AdmZip from 'adm-zip'
import log from 'electron-log/main'
import { addonRegistry } from './registry'
import { readManifest } from './loader'
import { exists } from '../fs-utils'

const ipcLog = log.scope('ipc')

/** Track temp directories so we can clean up after install confirm/cancel. */
let pendingTempDir: string | null = null

/**
 * Extract a .zip addon to a temp directory and return the path containing
 * manifest.json. Uses async extraction so the main process event loop stays
 * responsive for large zips.
 *
 * Handles both flat zips (manifest at root) and zips with a single wrapper
 * directory.
 */
async function extractAddonZip(zipPath: string): Promise<string> {
  const zip = new AdmZip(zipPath)
  const tempDir = join(tmpdir(), `retrosync-addon-${randomUUID()}`)
  // extractAllToAsync returns a Promise when called without a callback,
  // but @types/adm-zip types the return as void.
  await (zip.extractAllToAsync(tempDir, true) as unknown as Promise<void>)

  // Check if manifest.json is at the root of the extracted content
  if (await exists(join(tempDir, 'manifest.json'))) {
    return tempDir
  }

  // Check if there's a single subdirectory that contains manifest.json
  const entries = zip.getEntries()
  const topLevelDirs = new Set<string>()
  for (const entry of entries) {
    const firstSegment = entry.entryName.split('/')[0]
    topLevelDirs.add(firstSegment)
  }

  if (topLevelDirs.size === 1) {
    const nested = join(tempDir, [...topLevelDirs][0])
    const info = await stat(nested).catch(() => null)
    if (info?.isDirectory() && (await exists(join(nested, 'manifest.json')))) {
      return nested
    }
  }

  // Clean up on failure
  await rm(tempDir, { recursive: true, force: true })
  throw new Error('ZIP does not contain a valid addon (manifest.json not found)')
}

/** Remove the pending temp directory if one exists. */
async function cleanupTempDir(): Promise<void> {
  if (pendingTempDir) {
    const dir = pendingTempDir
    pendingTempDir = null
    await rm(dir, { recursive: true, force: true }).catch(() => {
      // best-effort cleanup
    })
  }
}

export function registerAddonIpcHandlers(): void {
  // ── List all addons ──
  ipcMain.handle('addon:list', () => {
    const addons = addonRegistry.getAll()
    ipcLog.info('addon:list →', addons.length, 'addons')
    return addons
  })

  // ── Find sources from all enabled addons ──
  ipcMain.handle('addon:find-sources', async (_event, gameName: string, platformIds: number[]) => {
    ipcLog.info('addon:find-sources → game:', gameName, 'platforms:', platformIds)
    try {
      const results = await addonRegistry.findSources(gameName, platformIds)
      const totalSources = results.reduce((n, r) => n + r.results.sources.length, 0)
      ipcLog.info(
        'addon:find-sources → found',
        totalSources,
        'sources from',
        results.length,
        'addons'
      )
      return { ok: true, data: results }
    } catch (error) {
      ipcLog.error('addon:find-sources → ERROR:', error)
      return { ok: false, error: String(error) }
    }
  })

  // ── Get status for a specific addon ──
  ipcMain.handle('addon:get-status', (_event, addonId: string) => {
    ipcLog.info('addon:get-status → addonId:', addonId)
    return addonRegistry.getStatus(addonId)
  })

  // ── Build index for a specific addon ──
  ipcMain.handle('addon:build-index', async (_event, addonId: string, platformIds?: number[]) => {
    ipcLog.info('addon:build-index → addonId:', addonId, 'platforms:', platformIds ?? 'all')
    try {
      const result = await addonRegistry.buildIndex(addonId, platformIds)
      ipcLog.info('addon:build-index → indexed:', result.indexed, 'total:', result.total)
      return { ok: true, data: result }
    } catch (error) {
      ipcLog.error('addon:build-index → ERROR:', error)
      return { ok: false, error: String(error) }
    }
  })

  // ── Clear data for a specific addon ──
  ipcMain.handle('addon:clear-data', async (_event, addonId: string) => {
    ipcLog.info('addon:clear-data → addonId:', addonId)
    try {
      await addonRegistry.clearData(addonId)
      return { ok: true }
    } catch (error) {
      ipcLog.error('addon:clear-data → ERROR:', error)
      return { ok: false, error: String(error) }
    }
  })

  // ── Enable/disable an addon ──
  ipcMain.handle('addon:set-enabled', (_event, addonId: string, enabled: boolean) => {
    ipcLog.info('addon:set-enabled → addonId:', addonId, 'enabled:', enabled)
    addonRegistry.setEnabled(addonId, enabled)
    return { ok: true }
  })

  // ── Remove a user-installed addon ──
  ipcMain.handle('addon:remove', async (_event, addonId: string) => {
    ipcLog.info('addon:remove → addonId:', addonId)
    const removed = await addonRegistry.remove(addonId)
    return { ok: removed }
  })

  // ── Get addon-specific config ──
  ipcMain.handle('addon:get-config', (_event, addonId: string) => {
    return addonRegistry.getAddonConfig(addonId)
  })

  // ── Set addon-specific config ──
  ipcMain.handle('addon:set-config', (_event, addonId: string, config: Record<string, unknown>) => {
    ipcLog.info('addon:set-config → addonId:', addonId, 'keys:', Object.keys(config))
    addonRegistry.setAddonConfig(addonId, config)
    return { ok: true }
  })

  // ── Get cache size from a specific addon ──
  ipcMain.handle('addon:cache-size', (_event, addonId: string) => {
    return addonRegistry.getCacheSize(addonId)
  })

  // ── Install addon from disk (opens file dialog, user selects folder or zip) ──
  ipcMain.handle('addon:install', async () => {
    ipcLog.info('addon:install → opening file dialog')
    const win = BrowserWindow.getFocusedWindow()

    // Clean up any leftover temp dir from a previous cancelled install
    await cleanupTempDir()

    const result = await dialog.showOpenDialog(win!, {
      title: 'Select Addon Folder or ZIP',
      properties: ['openFile', 'openDirectory'],
      filters: [{ name: 'Addon ZIP', extensions: ['zip'] }],
      message: 'Select an addon folder or .zip file containing manifest.json'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, error: 'cancelled' }
    }

    const selectedPath = result.filePaths[0]
    ipcLog.info('addon:install → selected path:', selectedPath)

    try {
      let addonPath: string

      // Determine if the selection is a zip file or a directory
      const info = await stat(selectedPath)
      if (info.isFile() && selectedPath.toLowerCase().endsWith('.zip')) {
        ipcLog.info('addon:install → extracting zip')
        addonPath = await extractAddonZip(selectedPath)
        // Track the temp root so we can clean up later (addonPath may be a
        // nested subdirectory inside the temp dir)
        const tempRoot = addonPath.startsWith(tmpdir()) ? addonPath : null
        if (tempRoot) {
          // If addonPath is a nested dir, track the actual temp root
          const relative = addonPath.slice(tmpdir().length + 1)
          const topDir = relative.split('/')[0].split('\\')[0]
          pendingTempDir = join(tmpdir(), topDir)
        }
      } else {
        addonPath = selectedPath
      }

      // Validate manifest exists
      if (!(await exists(join(addonPath, 'manifest.json')))) {
        await cleanupTempDir()
        return { ok: false, error: 'Selected source does not contain a manifest.json' }
      }

      // Read manifest for preview (returned to renderer for confirmation)
      const manifest = readManifest(addonPath)
      return { ok: true, data: { manifest, sourcePath: addonPath } }
    } catch (error) {
      ipcLog.error('addon:install → validation failed:', error)
      await cleanupTempDir()
      return { ok: false, error: String(error) }
    }
  })

  // ── Confirm addon installation (after user accepts disclaimer) ──
  ipcMain.handle('addon:install-confirm', async (_event, sourcePath: string) => {
    ipcLog.info('addon:install-confirm → installing from:', sourcePath)
    try {
      const manifest = await addonRegistry.installFromPath(sourcePath)
      ipcLog.info('addon:install-confirm → installed:', manifest.id, 'v' + manifest.version)
      return { ok: true, data: manifest }
    } catch (error) {
      ipcLog.error('addon:install-confirm → ERROR:', error)
      return { ok: false, error: String(error) }
    } finally {
      await cleanupTempDir()
    }
  })

  // ── Uninstall a user-installed addon ──
  ipcMain.handle('addon:uninstall', async (_event, addonId: string) => {
    ipcLog.info('addon:uninstall → addonId:', addonId)
    try {
      const removed = await addonRegistry.uninstall(addonId)
      return { ok: removed }
    } catch (error) {
      ipcLog.error('addon:uninstall → ERROR:', error)
      return { ok: false, error: String(error) }
    }
  })

  // ── Select a folder path (for 'path' config fields) ──
  ipcMain.handle('addon:select-folder', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Folder'
    })
    return result.canceled ? null : result.filePaths[0]
  })
}
