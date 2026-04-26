import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  igdb: {
    search: (query: string) => ipcRenderer.invoke('igdb:search', query),
    getGame: (igdbId: number) => ipcRenderer.invoke('igdb:get-game', igdbId),
    getDashboard: () => ipcRenderer.invoke('igdb:get-dashboard'),
    getGameTypes: () => ipcRenderer.invoke('igdb:get-game-types'),
    cacheImage: (imageId: string, size: string) =>
      ipcRenderer.invoke('igdb:cache-image', imageId, size),
    cacheSize: () => ipcRenderer.invoke('igdb:cache-size'),
    clearCache: () => ipcRenderer.invoke('igdb:clear-cache')
  },
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (config: Record<string, unknown>) => ipcRenderer.invoke('config:set', config),
    testIgdb: () => ipcRenderer.invoke('config:test-igdb')
  },
  devices: {
    getProfiles: () => ipcRenderer.invoke('devices:get-profiles'),
    getPlatforms: () => ipcRenderer.invoke('devices:get-platforms')
  },
  library: {
    getAll: () => ipcRenderer.invoke('library:get-all'),
    add: (snapshot: Record<string, unknown>) => ipcRenderer.invoke('library:add', snapshot),
    remove: (igdbId: number) => ipcRenderer.invoke('library:remove', igdbId),
    isIn: (igdbId: number) => ipcRenderer.invoke('library:is-in', igdbId)
  },
  addons: {
    list: () => ipcRenderer.invoke('addon:list'),
    findSources: (gameName: string, platformIds: number[]) =>
      ipcRenderer.invoke('addon:find-sources', gameName, platformIds),
    getStatus: (addonId: string) => ipcRenderer.invoke('addon:get-status', addonId),
    buildIndex: (addonId: string, platformIds?: number[]) =>
      ipcRenderer.invoke('addon:build-index', addonId, platformIds),
    clearData: (addonId: string) => ipcRenderer.invoke('addon:clear-data', addonId),
    setEnabled: (addonId: string, enabled: boolean) =>
      ipcRenderer.invoke('addon:set-enabled', addonId, enabled),
    remove: (addonId: string) => ipcRenderer.invoke('addon:remove', addonId),
    getConfig: (addonId: string) => ipcRenderer.invoke('addon:get-config', addonId),
    setConfig: (addonId: string, config: Record<string, unknown>) =>
      ipcRenderer.invoke('addon:set-config', addonId, config),
    cacheSize: (addonId: string) => ipcRenderer.invoke('addon:cache-size', addonId),
    install: () => ipcRenderer.invoke('addon:install'),
    installConfirm: (sourcePath: string) => ipcRenderer.invoke('addon:install-confirm', sourcePath),
    uninstall: (addonId: string) => ipcRenderer.invoke('addon:uninstall', addonId),
    selectFolder: () => ipcRenderer.invoke('addon:select-folder')
  },
  imports: {
    start: (params: Record<string, unknown>) => ipcRenderer.invoke('imports:start', params),
    pause: (id: string) => ipcRenderer.invoke('imports:pause', id),
    resume: (id: string) => ipcRenderer.invoke('imports:resume', id),
    cancel: (id: string) => ipcRenderer.invoke('imports:cancel', id),
    remove: (id: string) => ipcRenderer.invoke('imports:remove', id),
    retry: (id: string) => ipcRenderer.invoke('imports:retry', id),
    list: () => ipcRenderer.invoke('imports:list'),
    clearCompleted: () => ipcRenderer.invoke('imports:clear-completed'),
    openFile: (id: string) => ipcRenderer.invoke('imports:open-file', id),
    openFolder: (id: string) => ipcRenderer.invoke('imports:open-folder', id),
    selectLibraryPath: () => ipcRenderer.invoke('imports:select-library-path'),
    selectImportPath: () => ipcRenderer.invoke('imports:select-import-path'),
    checkSameFs: (pathA: string, pathB: string) =>
      ipcRenderer.invoke('imports:check-same-fs', pathA, pathB),
    onProgress: (callback: (data: unknown) => void) => {
      const handler = (_event: unknown, data: unknown): void => callback(data)
      ipcRenderer.on('imports:progress', handler)
      return () => {
        ipcRenderer.removeListener('imports:progress', handler)
      }
    },
    onListChanged: (callback: () => void) => {
      const handler = (): void => callback()
      ipcRenderer.on('imports:listChanged', handler)
      return () => {
        ipcRenderer.removeListener('imports:listChanged', handler)
      }
    }
  },
  bios: {
    listSources: () => ipcRenderer.invoke('bios:list-sources'),
    install: (zipPath: string, system: string) =>
      ipcRenderer.invoke('bios:install', zipPath, system),
    getDir: () => ipcRenderer.invoke('bios:get-dir'),
    scanLocal: () => ipcRenderer.invoke('bios:scan-local'),
    openFolder: (system: string) => ipcRenderer.invoke('bios:open-folder', system),
    deleteFile: (system: string, filename: string) =>
      ipcRenderer.invoke('bios:delete-file', system, filename)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
