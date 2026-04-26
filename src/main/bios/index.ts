// ---------- BIOS IPC handlers ----------
// Registers handlers for BIOS source listing and post-importing installation.
// Source listing is delegated to the addon registry (any addon declaring the
// 'sources:bios' capability can contribute BIOS sources).

import { ipcMain, shell } from 'electron'
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { join, extname, basename } from 'path'
import log from 'electron-log/main'
import AdmZip from 'adm-zip'

import { addonRegistry } from '../addons/registry'
import { getConfig } from '../config'

const biosLog = log.scope('bios')

// ---------- BIOS platform requirements (generic / factual) ----------

/** Platforms known to require BIOS files for emulation. */
export const BIOS_PLATFORMS: { platformId: number; system: string; platformName: string }[] = [
  { platformId: 7, system: 'PS1', platformName: 'PlayStation' },
  { platformId: 8, system: 'PS2', platformName: 'PlayStation 2' },
  { platformId: 21, system: 'GCN', platformName: 'Nintendo GameCube' },
  { platformId: 11, system: 'Xbox', platformName: 'Xbox' }
]

// ---------- BIOS directory helpers ----------

/** Get the root BIOS directory: {libraryPath}/BIOS */
export function getBiosDir(): string {
  const config = getConfig()
  return join(config.libraryPath, 'BIOS')
}

/** Get the system-specific BIOS directory: {libraryPath}/BIOS/{system} */
export function getBiosSystemDir(system: string): string {
  return join(getBiosDir(), system)
}

// ---------- Local BIOS scanning ----------

export interface LocalBiosFile {
  name: string
  size: number
}

export interface LocalBiosStatus {
  platformId: number
  system: string
  platformName: string
  files: LocalBiosFile[]
}

/** Scan the BIOS directory for locally available files per system. */
export function scanLocalBios(): LocalBiosStatus[] {
  const results: LocalBiosStatus[] = []

  for (const platform of BIOS_PLATFORMS) {
    const dir = getBiosSystemDir(platform.system)
    const files: LocalBiosFile[] = []

    if (existsSync(dir)) {
      try {
        const entries = readdirSync(dir)
        for (const entry of entries) {
          const fullPath = join(dir, entry)
          const stat = statSync(fullPath)
          if (stat.isFile()) {
            const ext = extname(entry).toLowerCase()
            // Skip non-BIOS files
            if (!['.txt', '.nfo', '.md', '.html', '.log'].includes(ext)) {
              files.push({ name: entry, size: stat.size })
            }
          }
        }
      } catch {
        // Dir exists but unreadable - skip
      }
    }

    results.push({
      platformId: platform.platformId,
      system: platform.system,
      platformName: platform.platformName,
      files
    })
  }

  return results
}

// ---------- ZIP extraction ----------

/**
 * Extract a imported BIOS zip file into the appropriate BIOS/{system}/ directory.
 * Returns the list of extracted file paths.
 */
export function installBiosZip(zipPath: string, system: string): string[] {
  const targetDir = getBiosSystemDir(system)
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true })
  }

  biosLog.info('Extracting BIOS zip:', zipPath, '→', targetDir)

  try {
    const zip = new AdmZip(zipPath)
    const entries = zip.getEntries()
    const extracted: string[] = []

    for (const entry of entries) {
      if (entry.isDirectory) continue
      const filename = basename(entry.entryName)
      // Skip non-binary files
      const ext = extname(filename).toLowerCase()
      if (['.txt', '.nfo', '.md', '.html'].includes(ext)) continue

      const destPath = join(targetDir, filename)
      zip.extractEntryTo(entry, targetDir, false, true)
      extracted.push(destPath)
      biosLog.info('Extracted:', filename, '→', destPath)
    }

    return extracted
  } catch (err) {
    biosLog.error('Failed to extract BIOS zip:', err)
    throw err
  }
}

// ---------- IPC registration ----------

export function registerBiosIpcHandlers(): void {
  // List BIOS sources from all enabled addons via the addon registry
  ipcMain.handle('bios:list-sources', async () => {
    biosLog.info('bios:list-sources → querying addons...')
    try {
      const groups = addonRegistry.listBiosSources()
      biosLog.info(
        'bios:list-sources →',
        groups.length,
        'platforms,',
        groups.reduce((n, g) => n + g.sources.length, 0),
        'total entries'
      )
      return { ok: true, data: groups }
    } catch (error) {
      biosLog.error('bios:list-sources → ERROR:', error)
      return { ok: false, error: String(error) }
    }
  })

  // Install a BIOS zip file into the correct directory
  ipcMain.handle('bios:install', async (_event, zipPath: string, system: string) => {
    biosLog.info('bios:install → zip:', zipPath, 'system:', system)
    try {
      const extracted = installBiosZip(zipPath, system)
      return { ok: true, data: extracted }
    } catch (error) {
      biosLog.error('bios:install → ERROR:', error)
      return { ok: false, error: String(error) }
    }
  })

  // Get the BIOS base directory path
  ipcMain.handle('bios:get-dir', () => {
    const dir = getBiosDir()
    return dir
  })

  // Scan local BIOS directories for existing files
  ipcMain.handle('bios:scan-local', () => {
    biosLog.info('bios:scan-local → scanning...')
    const results = scanLocalBios()
    const totalFiles = results.reduce((n, r) => n + r.files.length, 0)
    biosLog.info('bios:scan-local →', totalFiles, 'files found')
    return results
  })

  // Open a system-specific BIOS directory in the OS file manager
  ipcMain.handle('bios:open-folder', (_event, system: string) => {
    const dir = getBiosSystemDir(system)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    biosLog.info('bios:open-folder →', dir)
    shell.openPath(dir)
  })

  // Delete a specific BIOS file from a system directory
  ipcMain.handle('bios:delete-file', (_event, system: string, filename: string) => {
    // Guard against path traversal
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      biosLog.error('bios:delete-file → invalid filename:', filename)
      return { ok: false, error: 'Invalid filename' }
    }

    const filePath = join(getBiosSystemDir(system), filename)
    biosLog.info('bios:delete-file →', filePath)

    try {
      if (!existsSync(filePath)) {
        return { ok: false, error: 'File not found' }
      }
      unlinkSync(filePath)
      biosLog.info('bios:delete-file → deleted:', filePath)
      return { ok: true }
    } catch (error) {
      biosLog.error('bios:delete-file → ERROR:', error)
      return { ok: false, error: String(error) }
    }
  })

  biosLog.info('BIOS IPC handlers registered')
}
