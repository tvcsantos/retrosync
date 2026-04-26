import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import log from 'electron-log/main'
import { getConfig, setConfig } from './config'
import type { AppConfig } from './config'
import {
  searchGames,
  getGameById,
  getDashboardData,
  testCredentials,
  invalidateToken,
  IGDB_GAME_TYPES,
  DEFAULT_EXCLUDED_GAME_TYPES
} from './igdb'
import { cacheImage, clearImageCache, getImageCacheSize } from './imageCache'
import { DEVICE_PROFILES, PLATFORMS } from './platforms'
import { getLibraryGames, addToLibrary, removeFromLibrary, isInLibrary } from './library'
import type { LibraryGameSnapshot } from './library'
import { addonRegistry, registerAddonIpcHandlers } from './addons'
import { registerImportIpcHandlers, importManager } from './imports'
import { registerBiosIpcHandlers } from './bios'
import createLocalFolderAddon from './addons/local-folder'
import { buildContext } from './addons/loader'

// Initialize electron-log for renderer process IPC transport
log.initialize()

const ipcLog = log.scope('ipc')

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'RetroSync',
    backgroundColor: '#0F0F0F',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpcHandlers(): void {
  // ── Config ──
  ipcMain.handle('config:get', () => {
    const config = getConfig()
    ipcLog.info(
      'config:get → igdb configured:',
      !!(config.igdb.clientId && config.igdb.clientSecret)
    )
    return config
  })

  ipcMain.handle('config:set', (_event, partial: Partial<AppConfig>) => {
    ipcLog.info('config:set → keys:', Object.keys(partial))
    invalidateToken()
    return setConfig(partial)
  })

  ipcMain.handle('config:test-igdb', async () => {
    ipcLog.info('config:test-igdb → testing credentials...')
    const result = await testCredentials()
    ipcLog.info('config:test-igdb → result:', result)
    return result
  })

  // ── IGDB ──
  ipcMain.handle('igdb:search', async (_event, query: string) => {
    ipcLog.info('igdb:search → query:', query)
    try {
      const data = await searchGames(query)
      ipcLog.info(
        'igdb:search → returned',
        data.length,
        'games, covers:',
        data.filter((g) => g.cover).length
      )
      return { ok: true, data }
    } catch (error) {
      ipcLog.error('igdb:search → ERROR:', error)
      return { ok: false, error: String(error) }
    }
  })

  ipcMain.handle('igdb:get-game', async (_event, igdbId: number) => {
    ipcLog.info('igdb:get-game → id:', igdbId)
    try {
      const data = await getGameById(igdbId)
      ipcLog.info('igdb:get-game → found:', !!data, 'cover:', data?.cover?.image_id ?? 'none')
      return { ok: true, data }
    } catch (error) {
      ipcLog.error('igdb:get-game → ERROR:', error)
      return { ok: false, error: String(error) }
    }
  })

  ipcMain.handle('igdb:get-dashboard', async () => {
    ipcLog.info('igdb:get-dashboard → fetching...')
    try {
      const data = await getDashboardData()
      ipcLog.info(
        'igdb:get-dashboard → returned',
        `featured(${data.featured.length}),`,
        data.categories.map((c) => `${c.title}(${c.games.length})`).join(', ')
      )
      return { ok: true, data }
    } catch (error) {
      ipcLog.error('igdb:get-dashboard → ERROR:', error)
      return { ok: false, error: String(error) }
    }
  })

  // ── Image Cache ──
  ipcMain.handle('igdb:cache-image', async (_event, imageId: string, size: string) => {
    ipcLog.info('igdb:cache-image → imageId:', imageId, 'size:', size)
    try {
      const localPath = await cacheImage(imageId, size)
      ipcLog.info('igdb:cache-image → cached to:', localPath)
      return { ok: true, path: localPath }
    } catch (error) {
      ipcLog.error('igdb:cache-image → ERROR:', error)
      return { ok: false, error: String(error) }
    }
  })

  ipcMain.handle('igdb:cache-size', async () => {
    return getImageCacheSize()
  })

  ipcMain.handle('igdb:clear-cache', async () => {
    await clearImageCache()
    return { ok: true }
  })

  // ── Devices / Platforms ──
  ipcMain.handle('devices:get-profiles', () => {
    return DEVICE_PROFILES
  })

  ipcMain.handle('devices:get-platforms', () => {
    return PLATFORMS
  })

  // ── IGDB Game Types ──
  ipcMain.handle('igdb:get-game-types', () => {
    return { gameTypes: IGDB_GAME_TYPES, defaultExcluded: DEFAULT_EXCLUDED_GAME_TYPES }
  })

  // ── Library ──
  ipcMain.handle('library:get-all', () => {
    ipcLog.info('library:get-all')
    return getLibraryGames()
  })

  ipcMain.handle('library:add', (_event, snapshot: LibraryGameSnapshot) => {
    ipcLog.info('library:add → igdbId:', snapshot.igdbId, 'title:', snapshot.title)
    addToLibrary(snapshot)
    return { ok: true }
  })

  ipcMain.handle('library:remove', (_event, igdbId: number) => {
    ipcLog.info('library:remove → igdbId:', igdbId)
    removeFromLibrary(igdbId)
    return { ok: true }
  })

  ipcMain.handle('library:is-in', (_event, igdbId: number) => {
    return isInLibrary(igdbId)
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Set dock icon on macOS (in dev mode the app bundle icon is the Electron default)
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(icon)
  }

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  registerAddonIpcHandlers()
  registerImportIpcHandlers()
  registerBiosIpcHandlers()

  createWindow()

  // Register built-in addons
  const localFolderContext = buildContext('local-folder', '', '')
  const localFolderAddon = createLocalFolderAddon(localFolderContext)
  addonRegistry.registerBuiltIn(localFolderAddon).catch((err) => {
    log.scope('addons').error('Failed to register local-folder addon:', err)
  })

  // Load all external addons from {userData}/addons/
  addonRegistry.loadExternalAddons().catch((err) => {
    log.scope('addons').error('External addon loading failed:', err)
  })

  // Initialize import manager
  importManager.init().catch((err) => {
    log.scope('imports').error('Import manager init failed:', err)
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Graceful shutdown: destroy import manager before quitting
app.on('before-quit', () => {
  importManager.destroy().catch((err) => {
    log.scope('imports').error('Error destroying import manager:', err)
  })
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
