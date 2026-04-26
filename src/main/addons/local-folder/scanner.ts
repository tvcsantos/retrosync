// ---------- Local folder scanner ----------
// Recursively scans a directory for ROM and BIOS files.

import { existsSync, readdirSync, statSync } from 'fs'
import { join, extname, basename } from 'path'

export interface IndexedFile {
  filename: string
  absolutePath: string
  size: number
  extension: string
}

/** A BIOS file found during scanning, tagged with its system. */
export interface BiosFile {
  filename: string
  absolutePath: string
  size: number
  system: string
  platformId: number
}

/** Common ROM / disc-image extensions. */
const ROM_EXTENSIONS = new Set([
  // Nintendo
  '.nes',
  '.fds',
  '.sfc',
  '.smc',
  '.gba',
  '.gbc',
  '.gb',
  '.nds',
  '.n64',
  '.z64',
  '.v64',
  '.gcm',
  '.gcz',
  '.rvz',
  '.wbfs',
  '.wad',
  '.3ds',
  '.cia',
  // Sega
  '.gen',
  '.md',
  '.smd',
  '.gg',
  '.sms',
  '.32x',
  '.cdi',
  // Sony
  '.iso',
  '.bin',
  '.cue',
  '.img',
  '.mdf',
  '.mds',
  '.nrg',
  '.pbp',
  '.chd',
  // Atari / misc handhelds
  '.a26',
  '.a78',
  '.lnx',
  '.ngp',
  '.ngc',
  '.ws',
  '.wsc',
  // Archives (often contain ROMs)
  '.zip',
  '.7z'
])

/**
 * Recursively scan a folder and return all files matching ROM extensions.
 */
export function scanFolder(folderPath: string): IndexedFile[] {
  const files: IndexedFile[] = []

  function walk(dir: string): void {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return // skip unreadable directories
    }

    for (const entry of entries) {
      if (entry.startsWith('.')) continue // skip hidden files

      const fullPath = join(dir, entry)
      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          walk(fullPath)
        } else if (stat.isFile()) {
          const ext = extname(entry).toLowerCase()
          if (ROM_EXTENSIONS.has(ext)) {
            files.push({
              filename: basename(entry),
              absolutePath: fullPath,
              size: stat.size,
              extension: ext
            })
          }
        }
      } catch {
        // skip unreadable files
      }
    }
  }

  walk(folderPath)
  return files
}

// ---------- BIOS scanning ----------

/** Known BIOS subfolder names → system mapping (case-insensitive). */
const BIOS_FOLDER_ALIASES: Record<string, { system: string; platformId: number }> = {
  ps1: { system: 'PS1', platformId: 7 },
  psx: { system: 'PS1', platformId: 7 },
  playstation: { system: 'PS1', platformId: 7 },
  'playstation 1': { system: 'PS1', platformId: 7 },
  ps2: { system: 'PS2', platformId: 8 },
  'playstation 2': { system: 'PS2', platformId: 8 },
  gcn: { system: 'GCN', platformId: 21 },
  gamecube: { system: 'GCN', platformId: 21 },
  'nintendo gamecube': { system: 'GCN', platformId: 21 },
  xbox: { system: 'Xbox', platformId: 11 }
}

/** File extensions commonly found in BIOS packages. */
const BIOS_EXTENSIONS = new Set([
  '.bin',
  '.rom',
  '.nvm',
  '.erom',
  '.rom1',
  '.rom2',
  '.mec',
  '.dat',
  '.sys',
  '.bios',
  '.ipl',
  '.zip',
  '.7z'
])

/** Extensions to skip (documentation / metadata). */
const BIOS_SKIP_EXTENSIONS = new Set([
  '.txt',
  '.nfo',
  '.md',
  '.html',
  '.log',
  '.url',
  '.jpg',
  '.png',
  '.gif'
])

/**
 * Scan a folder for BIOS files. Expects files organized in system subfolders
 * (e.g. PS1/, PS2/, GCN/, Xbox/) matching the aliases above.
 * Each subfolder's files are collected and tagged with the system.
 */
export function scanBiosFolder(folderPath: string): BiosFile[] {
  if (!existsSync(folderPath)) return []

  const results: BiosFile[] = []
  let entries: string[]
  try {
    entries = readdirSync(folderPath)
  } catch {
    return []
  }

  for (const entry of entries) {
    if (entry.startsWith('.')) continue
    const fullPath = join(folderPath, entry)

    try {
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        // Check if this subfolder matches a known system alias
        const alias = BIOS_FOLDER_ALIASES[entry.toLowerCase()]
        if (alias) {
          // Collect all BIOS files from this system subfolder
          const files = collectBiosFiles(fullPath)
          for (const file of files) {
            results.push({ ...file, system: alias.system, platformId: alias.platformId })
          }
        }
      }
    } catch {
      // skip unreadable entries
    }
  }

  return results
}

/** Collect BIOS-eligible files from a directory (non-recursive). */
function collectBiosFiles(dir: string): Omit<BiosFile, 'system' | 'platformId'>[] {
  const files: Omit<BiosFile, 'system' | 'platformId'>[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }

  for (const entry of entries) {
    if (entry.startsWith('.')) continue
    const fullPath = join(dir, entry)
    try {
      const stat = statSync(fullPath)
      if (!stat.isFile()) continue

      const ext = extname(entry).toLowerCase()
      // Include files with known BIOS extensions, or files without an extension,
      // but skip documentation / metadata
      if (BIOS_SKIP_EXTENSIONS.has(ext)) continue
      if (ext === '' || BIOS_EXTENSIONS.has(ext)) {
        files.push({
          filename: basename(entry),
          absolutePath: fullPath,
          size: stat.size
        })
      }
    } catch {
      // skip unreadable files
    }
  }

  return files
}
