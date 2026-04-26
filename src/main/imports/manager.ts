// ---------- Import manager ----------
// Manages file imports by delegating transport to addons via the Transfer Contract.
// The manager owns the queue, concurrency, staging directory, and final library placement.

import { app, BrowserWindow } from 'electron'
import {
  existsSync,
  mkdirSync,
  unlinkSync,
  renameSync,
  rmSync,
  copyFileSync,
  readdirSync
} from 'fs'
import { join, basename, dirname } from 'path'
import { randomUUID } from 'crypto'
import { eq, or } from 'drizzle-orm'
import log from 'electron-log/main'

import { getDb } from '../db'
import { imports as importsTable } from '../db/schema'
import { getConfig, setConfig } from '../config'
import { PLATFORMS } from '../platforms'
import { addonRegistry } from '../addons/registry'

import type { ImportRecord, ImportStatus, StartImportParams, ImportProgressEvent } from './types'
import type { TransferHandle } from '../addons/types'

const dlLog = log.scope('imports')

// ---------- Helpers ----------

function getPlatformShortName(platformId: number): string {
  return PLATFORMS.find((p) => p.igdbId === platformId)?.shortName ?? 'Other'
}

function sendProgress(event: ImportProgressEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('imports:progress', event)
  }
}

function sendListChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('imports:listChanged')
  }
}

function getDefaultImportDir(): string {
  return join(app.getPath('userData'), '.import')
}

/** Move a file, falling back to copy+delete when src and dest are on different filesystems. */
function moveFile(src: string, dest: string): void {
  try {
    renameSync(src, dest)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
      copyFileSync(src, dest)
      unlinkSync(src)
    } else {
      throw err
    }
  }
}

function rowToRecord(row: typeof importsTable.$inferSelect): ImportRecord {
  return {
    id: row.id,
    addonId: row.addonId,
    sourceRef: row.sourceRef ?? null,
    romFilename: row.romFilename,
    gameName: row.gameName,
    platformId: row.platformId,
    collection: row.collection,
    status: row.status as ImportStatus,
    progress: row.progress,
    totalSize: row.totalSize,
    importedSize: row.importedSize,
    savePath: row.savePath,
    error: row.error,
    createdAt: row.createdAt,
    completedAt: row.completedAt
  }
}

// ---------- Active transfer tracking ----------

interface ActiveTransfer {
  handle: TransferHandle
  stagingPath: string
  finalDir: string
  paused: boolean
}

// ---------- ImportManager ----------

class ImportManager {
  private activeTransfers = new Map<string, ActiveTransfer>()
  private maxConcurrent = 3
  private libraryPath = ''
  private importDir = ''
  private initialized = false

  // ── Lifecycle ──

  async init(): Promise<void> {
    if (this.initialized) return

    const config = getConfig()
    this.libraryPath = config.libraryPath
    this.importDir = config.importPath || getDefaultImportDir()
    this.maxConcurrent = config.maxConcurrentImports

    this.initialized = true

    // Restore imports that were in-progress (set them to paused)
    const db = getDb()
    const inProgress = db
      .select()
      .from(importsTable)
      .where(eq(importsTable.status, 'importing'))
      .all()

    for (const row of inProgress) {
      db.update(importsTable).set({ status: 'paused' }).where(eq(importsTable.id, row.id)).run()
    }

    dlLog.info('ImportManager initialized, restored', inProgress.length, 'imports to paused')

    // Clean up stale import directory files (orphans from crashes)
    this.cleanupStaleImportFiles()

    // Process any queued imports
    this.processQueue()
  }

  async destroy(): Promise<void> {
    // Cancel all active transfers
    for (const [id, transfer] of this.activeTransfers) {
      try {
        transfer.handle.cancel()
      } catch {
        /* ignore */
      }

      const db = getDb()
      const row = db.select().from(importsTable).where(eq(importsTable.id, id)).get()
      if (row && row.status === 'importing') {
        db.update(importsTable).set({ status: 'paused' }).where(eq(importsTable.id, id)).run()
      }
    }

    this.activeTransfers.clear()
    this.initialized = false
    dlLog.info('ImportManager destroyed')
  }

  // ── Public operations ──

  async start(params: StartImportParams): Promise<string> {
    if (!params.sourceRef) {
      throw new Error('sourceRef must be provided')
    }

    const db = getDb()

    // Check for duplicate (match by romFilename + sourceRef)
    const existing = db
      .select()
      .from(importsTable)
      .where(eq(importsTable.romFilename, params.romFilename))
      .all()
      .find(
        (r) =>
          (r.status === 'queued' || r.status === 'importing') && r.sourceRef === params.sourceRef
      )

    if (existing) {
      dlLog.info('Import already active/queued:', params.romFilename)
      return existing.id
    }

    const id = randomUUID()
    const platformDir = params.saveSubdir ?? getPlatformShortName(params.platformId)
    const saveDir = join(this.libraryPath, platformDir)
    const savePath = join(saveDir, params.romFilename)

    const record: typeof importsTable.$inferInsert = {
      id,
      addonId: params.addonId,
      sourceRef: params.sourceRef,
      romFilename: params.romFilename,
      gameName: params.gameName,
      platformId: params.platformId,
      collection: params.collection,
      status: 'queued',
      progress: 0,
      totalSize: 0,
      importedSize: 0,
      savePath,
      error: null,
      createdAt: new Date().toISOString(),
      completedAt: null
    }

    db.insert(importsTable).values(record).run()
    dlLog.info('Queued import:', params.romFilename, '→', savePath)

    this.processQueue()
    return id
  }

  pause(importId: string): void {
    this.pauseInternal(importId, true)
  }

  private pauseInternal(importId: string, updateDb: boolean): void {
    const transfer = this.activeTransfers.get(importId)
    if (!transfer) return

    if (transfer.handle.supportsPause) {
      // Real pause - keep the handle alive so we can resume directly
      transfer.handle.pause()
      transfer.paused = true
    } else {
      // No pause support - cancel and discard the handle
      transfer.handle.cancel()
      this.activeTransfers.delete(importId)
    }

    const db = getDb()
    const row = db.select().from(importsTable).where(eq(importsTable.id, importId)).get()
    if (!row) return

    if (updateDb) {
      db.update(importsTable).set({ status: 'paused' }).where(eq(importsTable.id, importId)).run()

      sendProgress({
        id: importId,
        status: 'paused',
        progress: row.progress,
        importedSize: row.importedSize,
        totalSize: row.totalSize,
        speed: 0,
        eta: -1
      })
    }

    dlLog.info('Paused import:', importId)
  }

  async resume(importId: string): Promise<void> {
    const db = getDb()
    const row = db.select().from(importsTable).where(eq(importsTable.id, importId)).get()
    if (!row || (row.status !== 'paused' && row.status !== 'error')) return

    // Check if we still have a paused handle for this import
    const transfer = this.activeTransfers.get(importId)
    if (transfer?.paused) {
      // Direct resume - handle and torrent are still alive
      transfer.handle.resume()
      transfer.paused = false

      db.update(importsTable)
        .set({ status: 'importing', error: null })
        .where(eq(importsTable.id, importId))
        .run()

      sendProgress({
        id: importId,
        status: 'importing',
        progress: row.progress,
        importedSize: row.importedSize,
        totalSize: row.totalSize,
        speed: 0,
        eta: -1
      })

      dlLog.info('Resumed import (direct):', importId)
      return
    }

    // No handle - re-queue for a fresh start
    db.update(importsTable)
      .set({ status: 'queued', error: null })
      .where(eq(importsTable.id, importId))
      .run()

    dlLog.info('Resumed import (queued):', importId)
    this.processQueue()
  }

  cancel(importId: string): void {
    const transfer = this.activeTransfers.get(importId)

    // Cancel the active transfer (addon cleans up staging data)
    if (transfer) {
      try {
        transfer.handle.cancel()
      } catch {
        /* ignore */
      }
      // Also clean up staging file if addon didn't
      if (transfer.stagingPath && existsSync(transfer.stagingPath)) {
        try {
          unlinkSync(transfer.stagingPath)
        } catch {
          /* ignore */
        }
      }
      this.activeTransfers.delete(importId)
    }

    const db = getDb()
    const row = db.select().from(importsTable).where(eq(importsTable.id, importId)).get()

    // Delete from final destination if already moved
    if (row?.savePath && existsSync(row.savePath)) {
      try {
        unlinkSync(row.savePath)
      } catch {
        /* ignore */
      }
    }

    // Remove from DB
    db.delete(importsTable).where(eq(importsTable.id, importId)).run()
    dlLog.info('Cancelled import:', importId)
    sendListChanged()
  }

  remove(importId: string): void {
    // Only remove from DB (keep files)
    const db = getDb()
    db.delete(importsTable).where(eq(importsTable.id, importId)).run()
    dlLog.info('Removed import record:', importId)
    sendListChanged()
  }

  async retry(importId: string): Promise<void> {
    await this.resume(importId)
  }

  clearCompleted(): void {
    const db = getDb()
    db.delete(importsTable).where(eq(importsTable.status, 'completed')).run()
    dlLog.info('Cleared completed imports')
    sendListChanged()
  }

  // ── Queries ──

  getAll(): ImportRecord[] {
    const db = getDb()
    return db.select().from(importsTable).all().map(rowToRecord)
  }

  getById(importId: string): ImportRecord | null {
    const db = getDb()
    const row = db.select().from(importsTable).where(eq(importsTable.id, importId)).get()
    return row ? rowToRecord(row) : null
  }

  // ── Settings ──

  setMaxConcurrent(n: number): void {
    this.maxConcurrent = Math.max(1, n)
    setConfig({ maxConcurrentImports: this.maxConcurrent })
    this.processQueue()
  }

  setLibraryPath(path: string): void {
    this.libraryPath = path
    setConfig({ libraryPath: path })
  }

  setImportPath(path: string): void {
    this.importDir = path || getDefaultImportDir()
    setConfig({ importPath: path })
  }

  getImportDir(): string {
    return this.importDir
  }

  getLibraryPath(): string {
    return this.libraryPath
  }

  // ── Internal: queue processing ──

  private processQueue(): void {
    if (!this.initialized) return

    // Only count non-paused transfers toward concurrency
    const activeCount = [...this.activeTransfers.values()].filter((t) => !t.paused).length
    const slotsAvailable = this.maxConcurrent - activeCount
    if (slotsAvailable <= 0) return

    const db = getDb()
    const queued = db.select().from(importsTable).where(eq(importsTable.status, 'queued')).all()

    const toStart = queued.slice(0, slotsAvailable)
    for (const row of toStart) {
      this.startImport(row).catch((err) => {
        dlLog.error('Failed to start import:', row.id, err)
        db.update(importsTable)
          .set({ status: 'error', error: String(err) })
          .where(eq(importsTable.id, row.id))
          .run()
        sendProgress({
          id: row.id,
          status: 'error',
          progress: 0,
          importedSize: 0,
          totalSize: 0,
          speed: 0,
          eta: -1
        })
      })
    }
  }

  private async startImport(row: typeof importsTable.$inferSelect): Promise<void> {
    if (!row.sourceRef) {
      throw new Error('No sourceRef specified for import')
    }

    // Look up the addon
    const addon = addonRegistry.get(row.addonId)
    if (!addon) {
      throw new Error(`Addon '${row.addonId}' not found`)
    }
    if (!addon.createTransfer) {
      throw new Error(`Addon '${row.addonId}' does not implement createTransfer`)
    }

    const db = getDb()

    // Derive the final destination directory from the stored savePath
    const finalDir = row.savePath
      ? dirname(row.savePath)
      : join(this.libraryPath, getPlatformShortName(row.platformId))

    // Staging path: importDir/<importId>/<romFilename>
    const stagingDir = join(this.importDir, row.id)
    const stagingPath = join(stagingDir, row.romFilename)

    if (!existsSync(stagingDir)) {
      mkdirSync(stagingDir, { recursive: true })
    }

    db.update(importsTable)
      .set({ status: 'importing', savePath: join(finalDir, row.romFilename) })
      .where(eq(importsTable.id, row.id))
      .run()

    dlLog.info('Starting import:', row.romFilename, 'via addon', row.addonId)

    // Create the transfer via the addon
    const handle = addon.createTransfer(row.sourceRef, stagingPath, {
      onProgress: (data) => {
        // Guard: import may have been cancelled/paused before callback fires
        if (!this.activeTransfers.has(row.id)) return

        const progress = data.totalSize > 0 ? data.importedSize / data.totalSize : 0
        const eta =
          data.speed > 0 ? Math.round((data.totalSize - data.importedSize) / data.speed) : -1

        db.update(importsTable)
          .set({
            progress,
            importedSize: data.importedSize,
            totalSize: data.totalSize
          })
          .where(eq(importsTable.id, row.id))
          .run()

        sendProgress({
          id: row.id,
          status: 'importing',
          progress,
          importedSize: data.importedSize,
          totalSize: data.totalSize,
          speed: data.speed,
          eta
        })
      },

      onComplete: () => {
        if (!this.activeTransfers.has(row.id)) return
        this.completeImport(row.id)
      },

      onError: (error) => {
        if (!this.activeTransfers.has(row.id)) return

        this.activeTransfers.delete(row.id)

        db.update(importsTable)
          .set({ status: 'error', error: error.message })
          .where(eq(importsTable.id, row.id))
          .run()

        const currentRow = db.select().from(importsTable).where(eq(importsTable.id, row.id)).get()
        sendProgress({
          id: row.id,
          status: 'error',
          progress: currentRow?.progress ?? 0,
          importedSize: currentRow?.importedSize ?? 0,
          totalSize: currentRow?.totalSize ?? 0,
          speed: 0,
          eta: -1
        })

        dlLog.error('Import error:', row.id, error.message)
        this.processQueue()
      }
    })

    this.activeTransfers.set(row.id, { handle, stagingPath, finalDir, paused: false })
  }

  private completeImport(importId: string): void {
    const transfer = this.activeTransfers.get(importId)
    if (!transfer) return // already completed

    const { stagingPath, finalDir } = transfer
    this.activeTransfers.delete(importId)

    const db = getDb()
    const row = db.select().from(importsTable).where(eq(importsTable.id, importId)).get()

    // Move file from staging directory to the final library destination
    let finalPath = row?.savePath ?? null
    if (stagingPath && existsSync(stagingPath)) {
      const destPath = join(finalDir, row?.romFilename ?? basename(stagingPath))
      try {
        if (!existsSync(finalDir)) mkdirSync(finalDir, { recursive: true })
        moveFile(stagingPath, destPath)
        finalPath = destPath
        dlLog.info('Moved file from staging to library:', destPath)

        // Clean up empty staging subdirectory
        const stagingDir = dirname(stagingPath)
        if (stagingDir !== this.importDir && stagingDir.startsWith(this.importDir)) {
          try {
            rmSync(stagingDir, { recursive: false })
          } catch {
            /* not empty or permission issue */
          }
        }
      } catch (err) {
        dlLog.warn('Could not move file from staging dir:', err)
        finalPath = stagingPath
      }
    }

    const totalSize = row?.totalSize ?? 0

    db.update(importsTable)
      .set({
        status: 'completed',
        progress: 1,
        importedSize: totalSize,
        savePath: finalPath,
        completedAt: new Date().toISOString()
      })
      .where(eq(importsTable.id, importId))
      .run()

    sendProgress({
      id: importId,
      status: 'completed',
      progress: 1,
      importedSize: totalSize,
      totalSize,
      speed: 0,
      eta: 0
    })

    dlLog.info('Import completed:', importId, '→', finalPath)

    // Process next in queue
    this.processQueue()
  }

  /** Remove import directory files that don't correspond to any active import in the DB. */
  private cleanupStaleImportFiles(): void {
    if (!existsSync(this.importDir)) return

    const db = getDb()
    // Check if any imports are still active (queued/importing/paused)
    const activeCount = db
      .select({ id: importsTable.id })
      .from(importsTable)
      .where(
        or(
          eq(importsTable.status, 'queued'),
          eq(importsTable.status, 'importing'),
          eq(importsTable.status, 'paused')
        )
      )
      .all().length

    if (activeCount > 0) {
      dlLog.info('Import cleanup skipped - active imports exist:', activeCount)
      return
    }

    // No active imports: safe to wipe entire import directory
    try {
      const entries = readdirSync(this.importDir)
      for (const entry of entries) {
        const fullPath = join(this.importDir, entry)
        try {
          rmSync(fullPath, { recursive: true, force: true })
          dlLog.info('Removed stale import entry:', fullPath)
        } catch (err) {
          dlLog.warn('Could not remove stale import entry:', fullPath, err)
        }
      }
      dlLog.info('Import directory cleanup complete')
    } catch (err) {
      dlLog.warn('Error scanning import directory:', err)
    }
  }
}

// Singleton instance
export const importManager = new ImportManager()
