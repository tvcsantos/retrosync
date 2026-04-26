// ---------- Import IPC handlers ----------

import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { existsSync, statSync } from 'fs'
import { dirname } from 'path'
import log from 'electron-log/main'

import { importManager } from './manager'
import type { StartImportParams } from './types'

const ipcLog = log.scope('ipc')

/** Walk up from a path to find the closest ancestor that actually exists on disk. */
function closestExistingAncestor(p: string): string | null {
  let current = p
  while (current && current !== dirname(current)) {
    if (existsSync(current)) return current
    current = dirname(current)
  }
  return existsSync(current) ? current : null
}

export function registerImportIpcHandlers(): void {
  ipcMain.handle('imports:start', async (_event, params: StartImportParams) => {
    ipcLog.info('imports:start →', params.romFilename)
    try {
      const id = await importManager.start(params)
      return { ok: true, data: id }
    } catch (error) {
      ipcLog.error('imports:start → ERROR:', error)
      return { ok: false, error: String(error) }
    }
  })

  ipcMain.handle('imports:pause', (_event, importId: string) => {
    ipcLog.info('imports:pause →', importId)
    importManager.pause(importId)
    return { ok: true }
  })

  ipcMain.handle('imports:resume', async (_event, importId: string) => {
    ipcLog.info('imports:resume →', importId)
    await importManager.resume(importId)
    return { ok: true }
  })

  ipcMain.handle('imports:cancel', (_event, importId: string) => {
    ipcLog.info('imports:cancel →', importId)
    importManager.cancel(importId)
    return { ok: true }
  })

  ipcMain.handle('imports:remove', (_event, importId: string) => {
    ipcLog.info('imports:remove →', importId)
    importManager.remove(importId)
    return { ok: true }
  })

  ipcMain.handle('imports:retry', async (_event, importId: string) => {
    ipcLog.info('imports:retry →', importId)
    await importManager.retry(importId)
    return { ok: true }
  })

  ipcMain.handle('imports:list', () => {
    return importManager.getAll()
  })

  ipcMain.handle('imports:clear-completed', () => {
    importManager.clearCompleted()
    return { ok: true }
  })

  ipcMain.handle('imports:open-file', (_event, importId: string) => {
    const record = importManager.getById(importId)
    if (record?.savePath) {
      shell.openPath(record.savePath)
      return { ok: true }
    }
    return { ok: false, error: 'File not found' }
  })

  ipcMain.handle('imports:open-folder', (_event, importId: string) => {
    ipcLog.info('imports:open-folder →', importId)
    const record = importManager.getById(importId)
    ipcLog.info('imports:open-folder → savePath:', record?.savePath ?? 'null')
    if (record?.savePath) {
      if (existsSync(record.savePath)) {
        shell.showItemInFolder(record.savePath)
      } else {
        // File not on disk yet - open the parent directory instead
        const dir = dirname(record.savePath)
        ipcLog.info('imports:open-folder → file missing, opening dir:', dir)
        if (existsSync(dir)) {
          shell.openPath(dir)
        } else {
          return { ok: false, error: 'Directory does not exist' }
        }
      }
      return { ok: true }
    }
    return { ok: false, error: 'No save path for import' }
  })

  ipcMain.handle('imports:select-library-path', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null

    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Library Location'
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const selectedPath = result.filePaths[0]
    importManager.setLibraryPath(selectedPath)
    return selectedPath
  })

  ipcMain.handle('imports:select-import-path', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null

    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Import Directory'
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const selectedPath = result.filePaths[0]
    importManager.setImportPath(selectedPath)
    return selectedPath
  })

  ipcMain.handle('imports:check-same-fs', (_event, pathA: string, pathB: string) => {
    try {
      const resolvedA = existsSync(pathA) ? pathA : closestExistingAncestor(pathA)
      const resolvedB = existsSync(pathB) ? pathB : closestExistingAncestor(pathB)
      if (!resolvedA || !resolvedB) return false
      return statSync(resolvedA).dev === statSync(resolvedB).dev
    } catch {
      return false
    }
  })
}

export { importManager }
