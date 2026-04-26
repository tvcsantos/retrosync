// ---------- Local Folder addon ----------
// Built-in addon that serves ROM and BIOS sources from local folders.

import type {
  Addon,
  AddonManifest,
  AddonStatus,
  BiosPlatformGroup,
  SourceSearchResult,
  TransferCallbacks,
  TransferHandle
} from '../types'
import type { AddonContext } from '../context'
import { scanFolder, scanBiosFolder, type IndexedFile, type BiosFile } from './scanner'
import { matchFiles } from './matching'
import { createLocalTransfer } from './transfer'
import { BIOS_PLATFORMS } from '../../bios'

const manifest: AddonManifest = {
  id: 'local-folder',
  name: 'Local Folder',
  version: '1.0.0',
  author: 'Romio',
  description: 'Import ROMs and BIOS files from local folders on your filesystem.',
  capabilities: ['sources:games', 'sources:bios'],
  configSchema: [
    {
      key: 'folderPath',
      label: 'ROMs Folder',
      type: 'path',
      default: ''
    },
    {
      key: 'biosPath',
      label: 'BIOS Folder',
      type: 'path',
      default: ''
    }
  ]
}

export default function createLocalFolderAddon(context: AddonContext): Addon {
  let fileIndex: IndexedFile[] = []
  let biosIndex: BiosFile[] = []
  let lastScanned: string | null = null

  function getFolderPath(): string {
    return (context.getAddonConfig().folderPath as string) || ''
  }

  function getBiosPath(): string {
    return (context.getAddonConfig().biosPath as string) || ''
  }

  function doScan(): void {
    const folderPath = getFolderPath()
    if (!folderPath) {
      fileIndex = []
    } else {
      context.log.info(`Scanning ROM folder: ${folderPath}`)
      fileIndex = scanFolder(folderPath)
      context.log.info(`Indexed ${fileIndex.length} ROM files from ${folderPath}`)
    }

    const biosPath = getBiosPath()
    if (!biosPath) {
      biosIndex = []
    } else {
      context.log.info(`Scanning BIOS folder: ${biosPath}`)
      biosIndex = scanBiosFolder(biosPath)
      context.log.info(`Indexed ${biosIndex.length} BIOS files from ${biosPath}`)
    }

    lastScanned = fileIndex.length > 0 || biosIndex.length > 0 ? new Date().toISOString() : null
  }

  return {
    manifest,

    async init() {
      if (getFolderPath() || getBiosPath()) {
        doScan()
      }
    },

    async findSources(gameName: string, _platformIds: number[]): Promise<SourceSearchResult> {
      const folderPath = getFolderPath()
      if (!folderPath) {
        return { sources: [], matchType: 'none' }
      }

      // Re-scan if index is empty but folder is configured (lazy indexing)
      if (fileIndex.length === 0) {
        doScan()
      }

      return matchFiles(fileIndex, gameName)
    },

    async buildIndex(_platformIds?: number[]) {
      doScan()
      return { indexed: 1, total: fileIndex.length + biosIndex.length }
    },

    getStatus(): AddonStatus {
      const folderPath = getFolderPath()
      const biosPath = getBiosPath()
      return {
        indexedItems: fileIndex.length + biosIndex.length,
        lastUpdated: lastScanned,
        details: {
          folderPath: folderPath || '(not configured)',
          biosPath: biosPath || '(not configured)'
        }
      }
    },

    async clearData() {
      fileIndex = []
      biosIndex = []
      lastScanned = null
    },

    // ── BIOS capability ──

    listBiosSources(): BiosPlatformGroup[] {
      const biosPath = getBiosPath()
      if (!biosPath) return []

      // Re-scan if index is empty but path is configured (lazy indexing)
      if (biosIndex.length === 0) {
        doScan()
      }

      // Group BIOS files by system
      const bySystem = new Map<string, BiosFile[]>()
      for (const file of biosIndex) {
        const existing = bySystem.get(file.system)
        if (existing) {
          existing.push(file)
        } else {
          bySystem.set(file.system, [file])
        }
      }

      // Build platform groups for each system that has files
      const groups: BiosPlatformGroup[] = []
      for (const platform of BIOS_PLATFORMS) {
        const files = bySystem.get(platform.system)
        if (!files || files.length === 0) continue

        groups.push({
          addonId: manifest.id,
          platformId: platform.platformId,
          system: platform.system,
          platformName: platform.platformName,
          sources: files.map((f, idx) => ({
            id: idx,
            romFilename: f.filename,
            romSize: f.size,
            region: null,
            sourceRef: f.absolutePath,
            platformId: f.platformId,
            system: f.system
          }))
        })
      }

      return groups
    },

    // ── Transfer capability ──

    createTransfer(
      sourceRef: string,
      stagingPath: string,
      callbacks: TransferCallbacks
    ): TransferHandle {
      return createLocalTransfer(sourceRef, stagingPath, callbacks)
    },

    // resumeTransfer not implemented — file copy cannot meaningfully resume.
    // App falls back to createTransfer (fresh copy).

    async onConfigChanged(oldConfig: Record<string, unknown>, newConfig: Record<string, unknown>) {
      const folderChanged = oldConfig.folderPath !== newConfig.folderPath
      const biosChanged = oldConfig.biosPath !== newConfig.biosPath

      if (folderChanged || biosChanged) {
        fileIndex = []
        biosIndex = []
        lastScanned = null
        if (newConfig.folderPath || newConfig.biosPath) {
          context.log.info('Config changed, re-scanning folders')
          doScan()
        }
      }
    }
  }
}
