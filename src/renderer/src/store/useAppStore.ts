import { create } from 'zustand'
import log from 'electron-log/renderer'
import type { Game, GameCategory, Page } from '../types'

const storeLog = log.scope('store')

// ---------- LibraryGameSnapshot matches the preload type ----------
interface LibraryGameSnapshot {
  igdbId: number
  title: string
  platforms: string[]
  platformsShort: string[]
  coverImageId?: string
  year?: number
  developer?: string
  genre?: string
  description?: string
  rating?: number
  igdbUrl?: string
  igdbGameType?: number
}

// ---------- IGDB image URL helper (renderer-side, no main process needed) ----------
const IGDB_IMAGE_BASE = 'https://images.igdb.com/igdb/image/upload'

export function buildImageUrl(imageId: string, size: string): string {
  return `${IGDB_IMAGE_BASE}/${size}/${imageId}.jpg`
}

// ---------- placeholder box-art URL (coloured SVG data-URI, 3:4 portrait) ----------
const boxArt = (label: string, bg: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" rx="8" fill="${bg}"/><text x="150" y="210" text-anchor="middle" fill="white" font-size="16" font-family="sans-serif">${label}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// ---------- IGDB response → Game mapper ----------

interface IGDBGameRaw {
  id: number
  name: string
  slug?: string
  url?: string
  summary?: string
  storyline?: string
  game_type?: number
  rating?: number
  rating_count?: number
  aggregated_rating?: number
  first_release_date?: number
  cover?: { image_id: string }
  screenshots?: { image_id: string }[]
  artworks?: { image_id: string }[]
  genres?: { name: string }[]
  platforms?: { id: number; name: string; abbreviation?: string }[]
  involved_companies?: { company: { name: string }; developer: boolean; publisher: boolean }[]
}

function igdbGameToGame(raw: IGDBGameRaw): Game {
  const developer =
    raw.involved_companies?.find((c) => c.developer)?.company.name ??
    raw.involved_companies?.[0]?.company.name ??
    'Unknown'

  const platforms =
    raw.platforms && raw.platforms.length > 0 ? raw.platforms.map((p) => p.name) : ['Unknown']
  const platformsShort =
    raw.platforms && raw.platforms.length > 0
      ? raw.platforms.map((p) => p.abbreviation ?? p.name.substring(0, 4))
      : ['Unknown']
  const igdbPlatformIds =
    raw.platforms && raw.platforms.length > 0 ? raw.platforms.map((p) => p.id) : []
  const genre = raw.genres?.[0]?.name ?? 'Unknown'
  const year = raw.first_release_date ? new Date(raw.first_release_date * 1000).getFullYear() : 0

  const coverImageId = raw.cover?.image_id
  const artworkImageIds = raw.artworks?.map((a) => a.image_id) ?? []
  const screenshotImageIds = raw.screenshots?.map((s) => s.image_id) ?? []

  const boxArtUrl = coverImageId
    ? buildImageUrl(coverImageId, 't_cover_big')
    : boxArt(raw.name, '#6366F1')

  const heroImageUrl = artworkImageIds[0]
    ? buildImageUrl(artworkImageIds[0], 't_1080p')
    : coverImageId
      ? buildImageUrl(coverImageId, 't_1080p')
      : undefined

  const screenshots = screenshotImageIds.map((id) => buildImageUrl(id, 't_720p'))

  // Normalize IGDB 0-100 rating to 0-5 scale
  const rating = raw.rating ? Math.round((raw.rating / 20) * 10) / 10 : 0

  return {
    id: `igdb-${raw.id}`,
    igdbId: raw.id,
    igdbUrl: raw.url,
    igdbGameType: raw.game_type ?? 0,
    title: raw.name,
    platforms,
    platformsShort,
    igdbPlatformIds,
    year,
    developer,
    genre,
    description: raw.summary ?? raw.storyline ?? '',
    rating,
    boxArtUrl,
    heroImageUrl,
    screenshots,
    coverImageId,
    artworkImageIds,
    screenshotImageIds,
    isMultiDisc: false,
    discs: [],
    requiresBios: false,
    biosStatus: 'ok',
    fileSize: '',
    inCollection: false,
    igdbDetailsFetched: false
  }
}

// ---------- store ----------
interface AppState {
  // Navigation
  currentPage: Page
  setCurrentPage: (page: Page) => void

  // Search
  searchQuery: string
  setSearchQuery: (query: string) => void

  // Games
  allGames: Game[]
  categories: GameCategory[]
  featuredGames: Game[]
  selectedGame: Game | null
  setSelectedGame: (game: Game | null) => void
  toggleCollection: (gameId: string) => Promise<void>
  loadLibrary: () => Promise<void>

  // App initialization
  appInitialized: boolean
  needsSetup: boolean
  devicesConfigured: boolean
  selectedDeviceProfiles: { id: string; name: string; platformIds: number[] }[]
  refreshDeviceProfiles: () => Promise<void>
  initStatus: string
  initializeApp: () => Promise<void>

  // IGDB integration
  igdbConfigured: boolean
  igdbSearchResults: Game[]
  isSearchingIGDB: boolean
  isDashboardLoading: boolean
  isGameDetailLoading: boolean
  dashboardError: string | null
  excludedGameTypes: number[]
  gameTypeDefinitions: { id: number; label: string }[]
  checkIgdbConfig: () => Promise<void>
  searchIGDB: (query: string) => Promise<void>
  loadDashboard: () => Promise<void>
  fetchGameDetails: (igdbId: number) => Promise<void>
  setExcludedGameTypes: (excluded: number[]) => Promise<void>

  // Addons
  sourcesDisplayMode: 'expandable' | 'compact'
  setSourcesDisplayMode: (mode: 'expandable' | 'compact') => Promise<void>

  // Imports
  importsBadgeStyle: 'count' | 'dot' | 'none'
  setImportsBadgeStyle: (style: 'count' | 'dot' | 'none') => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  // Navigation
  currentPage: 'home',
  setCurrentPage: (page) => set({ currentPage: page }),

  // Search
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Games
  allGames: [],
  categories: [],
  featuredGames: [],
  selectedGame: null,
  setSelectedGame: (game) => set({ selectedGame: game }),
  toggleCollection: async (gameId) => {
    const state = get()
    const game =
      state.allGames.find((g) => g.id === gameId) ??
      state.categories.flatMap((c) => c.games).find((g) => g.id === gameId) ??
      (state.selectedGame?.id === gameId ? state.selectedGame : null)

    if (!game?.igdbId) {
      storeLog.warn('toggleCollection → no igdbId for game:', gameId)
      return
    }

    const wasInCollection = game.inCollection
    const newValue = !wasInCollection

    // Optimistic update
    const updateGame = (g: Game): Game => (g.id === gameId ? { ...g, inCollection: newValue } : g)

    set((s) => {
      let updatedAll = s.allGames.map(updateGame)
      // If adding and the game isn't in allGames yet, insert it
      if (newValue && !s.allGames.some((g) => g.id === gameId)) {
        updatedAll = [...updatedAll, { ...game, inCollection: true }]
      }
      // If removing, drop it from allGames (it only lived there because of the library)
      if (!newValue) {
        updatedAll = updatedAll.filter((g) => g.id !== gameId || g.inCollection)
      }
      return {
        allGames: updatedAll,
        categories: s.categories.map((cat) => ({ ...cat, games: cat.games.map(updateGame) })),
        selectedGame:
          s.selectedGame?.id === gameId
            ? { ...s.selectedGame, inCollection: newValue }
            : s.selectedGame
      }
    })

    try {
      if (newValue) {
        const snapshot: LibraryGameSnapshot = {
          igdbId: game.igdbId,
          title: game.title,
          platforms: game.platforms,
          platformsShort: game.platformsShort,
          coverImageId: game.coverImageId,
          year: game.year || undefined,
          developer: game.developer,
          genre: game.genre,
          description: game.description,
          rating: game.rating || undefined,
          igdbUrl: game.igdbUrl,
          igdbGameType: game.igdbGameType
        }
        await window.api.library.add(snapshot)
        storeLog.info('toggleCollection → added to library:', game.title)
      } else {
        await window.api.library.remove(game.igdbId)
        storeLog.info('toggleCollection → removed from library:', game.title)
      }
    } catch (err) {
      storeLog.error('toggleCollection → IPC error, reverting:', err)
      // Revert on failure
      const revert = (g: Game): Game =>
        g.id === gameId ? { ...g, inCollection: wasInCollection } : g
      set((s) => {
        let reverted = s.allGames.map(revert)
        // If we were adding (newValue=true) and it failed, remove the game we just inserted
        if (newValue && !wasInCollection) {
          reverted = reverted.filter((g) => g.id !== gameId || g.inCollection)
        }
        return {
          allGames: reverted,
          categories: s.categories.map((cat) => ({ ...cat, games: cat.games.map(revert) })),
          selectedGame:
            s.selectedGame?.id === gameId
              ? { ...s.selectedGame, inCollection: wasInCollection }
              : s.selectedGame
        }
      })
    }
  },

  loadLibrary: async () => {
    storeLog.info('loadLibrary → fetching from DB...')
    try {
      const snapshots: LibraryGameSnapshot[] = await window.api.library.getAll()
      storeLog.info('loadLibrary → count:', snapshots.length)

      const libraryGames: Game[] = snapshots.map((snap) => ({
        id: `igdb-${snap.igdbId}`,
        igdbId: snap.igdbId,
        igdbUrl: snap.igdbUrl,
        igdbGameType: snap.igdbGameType ?? 0,
        title: snap.title,
        platforms: snap.platforms,
        platformsShort: snap.platformsShort,
        igdbPlatformIds: [], // library snapshots don't store platform IDs; resolved on detail fetch
        year: snap.year ?? 0,
        developer: snap.developer ?? 'Unknown',
        genre: snap.genre ?? 'Unknown',
        description: snap.description ?? '',
        rating: snap.rating ?? 0,
        boxArtUrl: snap.coverImageId
          ? buildImageUrl(snap.coverImageId, 't_cover_big')
          : boxArt(snap.title, '#6366F1'),
        heroImageUrl: snap.coverImageId ? buildImageUrl(snap.coverImageId, 't_1080p') : undefined,
        screenshots: [],
        coverImageId: snap.coverImageId,
        isMultiDisc: false,
        discs: [],
        requiresBios: false,
        biosStatus: 'ok' as const,
        fileSize: '',
        inCollection: true,
        igdbDetailsFetched: false
      }))

      const libraryIds = new Set(libraryGames.map((g) => g.igdbId))

      set((state) => {
        // Merge library games into allGames (avoid duplicates)
        const existingIds = new Set(state.allGames.map((g) => g.igdbId))
        const newGames = libraryGames.filter((g) => !existingIds.has(g.igdbId))
        const updatedAll = state.allGames
          .map((g) => (g.igdbId && libraryIds.has(g.igdbId) ? { ...g, inCollection: true } : g))
          .concat(newGames)

        // Mark category games that are in library
        const updatedCategories = state.categories.map((cat) => ({
          ...cat,
          games: cat.games.map((g) =>
            g.igdbId && libraryIds.has(g.igdbId) ? { ...g, inCollection: true } : g
          )
        }))

        return { allGames: updatedAll, categories: updatedCategories }
      })
    } catch (err) {
      storeLog.error('loadLibrary → error:', err)
    }
  },

  // App initialization
  appInitialized: false,
  needsSetup: false,
  devicesConfigured: false,
  selectedDeviceProfiles: [],
  refreshDeviceProfiles: async () => {
    try {
      const config = await window.api.config.get()
      const allProfiles: { id: string; name: string; platformIds: number[] }[] =
        await window.api.devices.getProfiles()
      const profileMap = new Map(allProfiles.map((p) => [p.id, p]))
      const selected: { id: string; name: string; platformIds: number[] }[] = []

      for (const deviceId of config.devices ?? []) {
        const profile = profileMap.get(deviceId)
        if (profile)
          selected.push({ id: profile.id, name: profile.name, platformIds: profile.platformIds })
      }
      for (const custom of config.customDevices ?? []) {
        selected.push({ id: custom.id, name: custom.name, platformIds: custom.platformIds })
      }

      set({ selectedDeviceProfiles: selected })
    } catch (err) {
      storeLog.warn('refreshDeviceProfiles → error:', err)
    }
  },
  initStatus: 'Starting up...',

  initializeApp: async () => {
    try {
      set({ initStatus: 'Checking configuration...' })
      const config = await window.api.config.get()

      const hasDevices =
        (config.devices && config.devices.length > 0) ||
        (config.customDevices && config.customDevices.length > 0)
      const hasIgdb = !!(config.igdb.clientId && config.igdb.clientSecret)
      const igdbSkipped = !!config.igdbSetupSkipped

      set({
        devicesConfigured: hasDevices,
        igdbConfigured: hasIgdb,
        excludedGameTypes: config.igdbExcludedGameTypes ?? [5],
        sourcesDisplayMode: config.addons?.sourcesDisplayMode ?? 'compact',
        importsBadgeStyle: config.importsBadgeStyle ?? 'count'
      })

      // Resolve selected device profiles for compatibility display
      if (hasDevices) {
        await get().refreshDeviceProfiles()
      }

      // Load game type definitions
      try {
        const catData = await window.api.igdb.getGameTypes()
        set({ gameTypeDefinitions: catData.gameTypes })
      } catch {
        storeLog.warn('initializeApp → could not load game type definitions')
      }

      // If devices are missing, or IGDB is neither configured nor skipped → needs setup
      if (!hasDevices || (!hasIgdb && !igdbSkipped)) {
        set({ needsSetup: true, appInitialized: true })
        return
      }

      if (hasIgdb) {
        set({ initStatus: 'Connecting to IGDB...' })
        await get().loadDashboard()
      }

      set({ initStatus: 'Loading library...' })
      await get().loadLibrary()

      set({ initStatus: 'Ready!' })
      await new Promise((resolve) => setTimeout(resolve, 400))
    } catch (err) {
      storeLog.error('initializeApp → error:', err)
      set({ initStatus: 'Ready!' })
    } finally {
      set({ appInitialized: true })
    }
  },

  // IGDB integration
  igdbConfigured: false,
  igdbSearchResults: [],
  isSearchingIGDB: false,
  isDashboardLoading: false,
  isGameDetailLoading: false,
  dashboardError: null,
  excludedGameTypes: [5], // default: mods excluded
  gameTypeDefinitions: [],

  // Addons
  sourcesDisplayMode: 'compact',
  setSourcesDisplayMode: async (mode) => {
    set({ sourcesDisplayMode: mode })
    try {
      await window.api.config.set({ addons: { sourcesDisplayMode: mode } })
    } catch (err) {
      storeLog.error('setSourcesDisplayMode → error:', err)
    }
  },

  // Imports
  importsBadgeStyle: 'count',
  setImportsBadgeStyle: async (style) => {
    set({ importsBadgeStyle: style })
    try {
      await window.api.config.set({ importsBadgeStyle: style })
    } catch (err) {
      storeLog.error('setImportsBadgeStyle → error:', err)
    }
  },

  checkIgdbConfig: async () => {
    try {
      const config = await window.api.config.get()
      const configured = !!(config.igdb.clientId && config.igdb.clientSecret)
      storeLog.info('checkIgdbConfig → configured:', configured)
      set({ igdbConfigured: configured })
    } catch (err) {
      storeLog.error('checkIgdbConfig → error:', err)
      set({ igdbConfigured: false })
    }
  },

  searchIGDB: async (query: string) => {
    if (!get().igdbConfigured || query.trim().length < 2) {
      set({ igdbSearchResults: [] })
      return
    }

    storeLog.info('searchIGDB → query:', query)
    set({ isSearchingIGDB: true })
    try {
      const result = await window.api.igdb.search(query)
      storeLog.info(
        'searchIGDB → ok:',
        result.ok,
        'data count:',
        Array.isArray(result.data) ? result.data.length : 'n/a'
      )
      if (result.ok && Array.isArray(result.data)) {
        const games = (result.data as IGDBGameRaw[]).map(igdbGameToGame)
        storeLog.info(
          'searchIGDB → mapped games:',
          games.length,
          'with covers:',
          games.filter((g) => g.coverImageId).length
        )
        games.forEach((g) =>
          storeLog.info('  -', g.title, 'boxArtUrl:', g.boxArtUrl.substring(0, 80))
        )
        set({ igdbSearchResults: games })
      } else {
        storeLog.warn('searchIGDB → no data or not ok:', result.error)
        set({ igdbSearchResults: [] })
      }
    } catch (err) {
      storeLog.error('searchIGDB → error:', err)
      set({ igdbSearchResults: [] })
    } finally {
      set({ isSearchingIGDB: false })
    }
  },

  loadDashboard: async () => {
    const { igdbConfigured } = get()
    if (!igdbConfigured) {
      storeLog.info('loadDashboard → skipped (IGDB not configured), using mock data')
      return
    }

    storeLog.info('loadDashboard → fetching from IGDB...')
    set({ isDashboardLoading: true, dashboardError: null })
    try {
      const result = await window.api.igdb.getDashboard()
      storeLog.info('loadDashboard → ok:', result.ok, 'data:', result.data ? 'present' : 'n/a')
      if (result.ok && result.data) {
        const dashData = result.data as {
          featured: IGDBGameRaw[]
          categories: { id: string; title: string; games: IGDBGameRaw[] }[]
        }

        const categories: GameCategory[] = dashData.categories.map((cat) => ({
          id: cat.id,
          title: cat.title,
          games: cat.games.map(igdbGameToGame)
        }))

        const featuredGames = dashData.featured.map(igdbGameToGame)

        storeLog.info(
          'loadDashboard → featured:',
          featuredGames.length,
          'categories:',
          categories.length
        )
        categories.forEach((c) => storeLog.info('  -', c.title, '→', c.games.length, 'games'))
        set({ categories, featuredGames })
      } else {
        storeLog.warn('loadDashboard → failed:', result.error)
      }
    } catch (err) {
      storeLog.error('loadDashboard → error:', err)
      set({ dashboardError: String(err) })
    } finally {
      set({ isDashboardLoading: false })
    }
  },

  fetchGameDetails: async (igdbId: number) => {
    storeLog.info('fetchGameDetails → igdbId:', igdbId)
    set({ isGameDetailLoading: true })
    try {
      const result = await window.api.igdb.getGame(igdbId)
      storeLog.info('fetchGameDetails → ok:', result.ok, 'has data:', !!result.data)
      if (result.ok && result.data) {
        const detailedGame = igdbGameToGame(result.data as IGDBGameRaw)
        detailedGame.igdbDetailsFetched = true
        storeLog.info(
          'fetchGameDetails → title:',
          detailedGame.title,
          'cover:',
          detailedGame.coverImageId ?? 'none',
          'screenshots:',
          detailedGame.screenshotImageIds?.length ?? 0
        )

        // Update selectedGame with full details
        set((state) => {
          const updated =
            state.selectedGame?.igdbId === igdbId
              ? {
                  ...state.selectedGame,
                  ...detailedGame,
                  inCollection: state.selectedGame.inCollection
                }
              : state.selectedGame
          return { selectedGame: updated }
        })

        // Trigger background image caching for cover
        if (detailedGame.coverImageId) {
          window.api.igdb.cacheImage(detailedGame.coverImageId, 't_cover_big').catch(() => {})
        }
        // Cache screenshots
        for (const ssId of detailedGame.screenshotImageIds ?? []) {
          window.api.igdb.cacheImage(ssId, 't_720p').catch(() => {})
        }
        // Cache artwork
        for (const artId of detailedGame.artworkImageIds ?? []) {
          window.api.igdb.cacheImage(artId, 't_1080p').catch(() => {})
        }
      }
    } catch (err) {
      storeLog.error('fetchGameDetails → error:', err)
    } finally {
      set({ isGameDetailLoading: false })
    }
  },

  setExcludedGameTypes: async (excluded: number[]) => {
    storeLog.info('setExcludedGameTypes →', excluded)
    set({ excludedGameTypes: excluded })
    try {
      await window.api.config.set({ igdbExcludedGameTypes: excluded })
      // Re-fetch dashboard with new filter (backend applies it)
      if (get().igdbConfigured) {
        await get().loadDashboard()
        // Re-apply library overlay on refreshed categories
        await get().loadLibrary()
      }
    } catch (err) {
      storeLog.error('setExcludedGameTypes → error:', err)
    }
  }
}))
