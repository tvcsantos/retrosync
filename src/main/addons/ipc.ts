// ---------- Addon IPC handlers ----------
// All addon:* IPC channels are registered here.

import { ipcMain, dialog, BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import log from 'electron-log/main'
import { addonRegistry } from './registry'
import { readManifest } from './loader'

const ipcLog = log.scope('ipc')

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

  // ── Install addon from disk (opens file dialog, user selects folder) ──
  ipcMain.handle('addon:install', async () => {
    ipcLog.info('addon:install → opening folder dialog')
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: 'Select Addon Folder',
      properties: ['openDirectory'],
      message: 'Select the addon folder containing manifest.json'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, error: 'cancelled' }
    }

    const sourcePath = result.filePaths[0]
    ipcLog.info('addon:install → selected path:', sourcePath)

    // Validate manifest exists before proceeding
    if (!existsSync(join(sourcePath, 'manifest.json'))) {
      return { ok: false, error: 'Selected folder does not contain a manifest.json' }
    }

    try {
      // Read manifest for preview (returned to renderer for confirmation)
      const manifest = readManifest(sourcePath)
      return { ok: true, data: { manifest, sourcePath } }
    } catch (error) {
      ipcLog.error('addon:install → manifest validation failed:', error)
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
