import apicalypse from 'apicalypse'
import type { AxiosResponse } from 'axios'
import axios from 'axios'
import log from 'electron-log/main'
import { getConfig } from './config'
import { getActivePlatformIds } from './platforms'

const igdbLog = log.scope('igdb')

// ---------- Types for IGDB API responses ----------

export interface IGDBCover {
  id: number
  image_id: string
}

export interface IGDBScreenshot {
  id: number
  image_id: string
}

export interface IGDBArtwork {
  id: number
  image_id: string
}

export interface IGDBGenre {
  id: number
  name: string
}

export interface IGDBPlatform {
  id: number
  name: string
  abbreviation?: string
}

export interface IGDBCompany {
  id: number
  company: {
    id: number
    name: string
  }
  developer: boolean
  publisher: boolean
}

export interface IGDBGame {
  id: number
  name: string
  slug?: string
  summary?: string
  storyline?: string
  game_type?: number
  rating?: number
  rating_count?: number
  aggregated_rating?: number
  aggregated_rating_count?: number
  first_release_date?: number
  cover?: IGDBCover
  screenshots?: IGDBScreenshot[]
  artworks?: IGDBArtwork[]
  genres?: IGDBGenre[]
  platforms?: IGDBPlatform[]
  involved_companies?: IGDBCompany[]
}

// ---------- IGDB game type constants ----------

export const IGDB_GAME_TYPES: { id: number; label: string }[] = [
  { id: 0, label: 'Main Game' },
  { id: 1, label: 'DLC / Addon' },
  { id: 2, label: 'Expansion' },
  { id: 3, label: 'Standalone Expansion' },
  { id: 4, label: 'Bundle' },
  { id: 5, label: 'Mod' },
  { id: 6, label: 'Episode' },
  { id: 7, label: 'Season' },
  { id: 8, label: 'Remake' },
  { id: 9, label: 'Remaster' },
  { id: 10, label: 'Expanded Game' },
  { id: 11, label: 'Port' },
  { id: 12, label: 'Fork' },
  { id: 13, label: 'Pack' },
  { id: 14, label: 'Update' }
]

export const DEFAULT_EXCLUDED_GAME_TYPES = [5] // Mods excluded by default

// ---------- Token management ----------

interface TokenInfo {
  accessToken: string
  expiresAt: number
}

let cachedToken: TokenInfo | null = null
let tokenFetchPromise: Promise<TokenInfo> | null = null

const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const IGDB_BASE_URL = 'https://api.igdb.com/v4'

const GAME_FIELDS = [
  'name',
  'slug',
  'url',
  'summary',
  'storyline',
  'game_type',
  'rating',
  'rating_count',
  'aggregated_rating',
  'aggregated_rating_count',
  'first_release_date',
  'cover.image_id',
  'screenshots.image_id',
  'artworks.image_id',
  'genres.name',
  'platforms.name',
  'platforms.abbreviation',
  'involved_companies.company.name',
  'involved_companies.developer',
  'involved_companies.publisher'
].join(',')

async function fetchToken(clientId: string, clientSecret: string): Promise<TokenInfo> {
  igdbLog.info('Fetching Twitch OAuth token...')
  const response = await axios.post(TWITCH_TOKEN_URL, null, {
    params: {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials'
    }
  })

  const { access_token, expires_in } = response.data
  igdbLog.info('Token acquired, expires in', expires_in, 'seconds')
  return {
    accessToken: access_token,
    expiresAt: Date.now() + expires_in * 1000 - 60_000 // refresh 1 min early
  }
}

async function getToken(): Promise<{ clientId: string; accessToken: string }> {
  const config = getConfig()
  const { clientId, clientSecret } = config.igdb

  if (!clientId || !clientSecret) {
    igdbLog.warn('getToken: credentials not configured')
    throw new Error('IGDB credentials not configured')
  }

  if (!cachedToken || Date.now() >= cachedToken.expiresAt) {
    // Use a mutex so concurrent callers share a single in-flight fetch
    if (!tokenFetchPromise) {
      igdbLog.info('getToken: token missing or expired, refreshing...')
      tokenFetchPromise = fetchToken(clientId, clientSecret).finally(() => {
        tokenFetchPromise = null
      })
    } else {
      igdbLog.info('getToken: waiting for in-flight token fetch...')
    }
    cachedToken = await tokenFetchPromise
  }

  return { clientId, accessToken: cachedToken.accessToken }
}

function createClient(clientId: string, accessToken: string): ReturnType<typeof apicalypse> {
  return apicalypse({
    method: 'post',
    baseURL: IGDB_BASE_URL,
    headers: {
      'Client-ID': clientId,
      Authorization: `Bearer ${accessToken}`
    }
  })
}

// ---------- Public API ----------

/**
 * Test whether the current IGDB credentials are valid.
 * Returns true if a token can be fetched, false otherwise.
 */
export async function testCredentials(): Promise<boolean> {
  try {
    const config = getConfig()
    const { clientId, clientSecret } = config.igdb
    if (!clientId || !clientSecret) {
      igdbLog.info('testCredentials: no credentials set')
      return false
    }
    igdbLog.info('testCredentials: testing with clientId:', clientId.substring(0, 6) + '...')
    const token = await fetchToken(clientId, clientSecret)
    cachedToken = token
    igdbLog.info('testCredentials: success')
    return true
  } catch (err) {
    igdbLog.error('testCredentials: failed:', err)
    return false
  }
}

/**
 * Search games by name (filtered to user's selected platforms).
 */
export async function searchGames(query: string, limit = 20): Promise<IGDBGame[]> {
  igdbLog.info('searchGames:', query, 'limit:', limit)
  const { clientId, accessToken } = await getToken()
  const platformFilter = buildPlatformFilter()
  const gameTypeFilter = buildGameTypeFilter()
  const where = ['version_parent = null']
  if (platformFilter) where.push(platformFilter)
  if (gameTypeFilter) where.push(gameTypeFilter)

  const response: AxiosResponse<IGDBGame[]> = await createClient(clientId, accessToken)
    .fields(GAME_FIELDS)
    .search(query)
    .limit(limit)
    .where(where)
    .request('/games')

  igdbLog.info('searchGames: returned', response.data.length, 'results')
  return response.data
}

/**
 * Get a single game by IGDB ID with full details.
 */
export async function getGameById(igdbId: number): Promise<IGDBGame | null> {
  const { clientId, accessToken } = await getToken()
  const response: AxiosResponse<IGDBGame[]> = await createClient(clientId, accessToken)
    .fields(GAME_FIELDS)
    .where(`id = ${igdbId}`)
    .request('/games')

  return response.data[0] ?? null
}

/**
 * Get popular/highly-rated games.
 */
export async function getPopularGames(limit = 20): Promise<IGDBGame[]> {
  const { clientId, accessToken } = await getToken()
  const platformFilter = buildPlatformFilter()
  const gameTypeFilter = buildGameTypeFilter()
  const where = ['version_parent = null', 'rating_count > 20', 'cover != null']
  if (platformFilter) where.push(platformFilter)
  if (gameTypeFilter) where.push(gameTypeFilter)

  const response: AxiosResponse<IGDBGame[]> = await createClient(clientId, accessToken)
    .fields(GAME_FIELDS)
    .where(where)
    .sort('rating', 'desc')
    .limit(limit)
    .request('/games')

  return response.data
}

// Well-known IGDB genre IDs
const GENRE_IDS = {
  rpg: 12,
  platformer: 8,
  fighting: 4,
  adventure: 31,
  strategy: 15,
  shooter: 5,
  puzzle: 9,
  racing: 10,
  sport: 14
} as const

/**
 * Build the IGDB platform filter from the user's selected devices.
 * Returns empty string if no devices are configured.
 */
function buildPlatformFilter(): string {
  const ids = getActivePlatformIds(getConfig())
  if (ids.length === 0) return ''
  return `platforms = (${ids.join(',')})`
}

/**
 * Build the IGDB game type filter from excluded game types.
 * Returns empty string if nothing is excluded.
 */
function buildGameTypeFilter(): string {
  const config = getConfig()
  const excluded: number[] = config.igdbExcludedGameTypes ?? DEFAULT_EXCLUDED_GAME_TYPES
  if (excluded.length === 0) return ''
  const allIds = IGDB_GAME_TYPES.map((c) => c.id)
  const allowed = allIds.filter((id) => !excluded.includes(id))
  if (allowed.length === 0 || allowed.length === allIds.length) return ''
  return `game_type = (${allowed.join(',')})`
}

/**
 * Get games by genre for a dashboard swimlane.
 */
export async function getGamesByGenre(
  genreKey: keyof typeof GENRE_IDS,
  limit = 15
): Promise<IGDBGame[]> {
  const genreId = GENRE_IDS[genreKey]
  const { clientId, accessToken } = await getToken()
  const platformFilter = buildPlatformFilter()
  const gameTypeFilter = buildGameTypeFilter()
  const where = ['version_parent = null', 'cover != null', `genres = [${genreId}]`]
  if (platformFilter) where.push(platformFilter)
  if (gameTypeFilter) where.push(gameTypeFilter)

  const response: AxiosResponse<IGDBGame[]> = await createClient(clientId, accessToken)
    .fields(GAME_FIELDS)
    .where(where)
    .sort('rating', 'desc')
    .limit(limit)
    .request('/games')

  return response.data
}

/**
 * Get recently released retro-style games (homebrew/indie).
 */
export async function getRecentGames(limit = 15): Promise<IGDBGame[]> {
  const { clientId, accessToken } = await getToken()
  const now = Math.floor(Date.now() / 1000)
  const oneYearAgo = now - 365 * 24 * 60 * 60
  const platformFilter = buildPlatformFilter()
  const gameTypeFilter = buildGameTypeFilter()
  const where = [
    'version_parent = null',
    'cover != null',
    `first_release_date > ${oneYearAgo}`,
    `first_release_date < ${now}`
  ]
  if (platformFilter) where.push(platformFilter)
  if (gameTypeFilter) where.push(gameTypeFilter)

  const response: AxiosResponse<IGDBGame[]> = await createClient(clientId, accessToken)
    .fields(GAME_FIELDS)
    .where(where)
    .sort('first_release_date', 'desc')
    .limit(limit)
    .request('/games')

  return response.data
}

/**
 * Get top-rated games for the hero carousel.
 * Uses a higher rating_count threshold to surface well-known titles.
 */
export async function getFeaturedGames(limit = 5): Promise<IGDBGame[]> {
  const { clientId, accessToken } = await getToken()
  const platformFilter = buildPlatformFilter()
  const gameTypeFilter = buildGameTypeFilter()
  const where = ['version_parent = null', 'rating_count > 50', 'cover != null']
  if (platformFilter) where.push(platformFilter)
  if (gameTypeFilter) where.push(gameTypeFilter)

  const response: AxiosResponse<IGDBGame[]> = await createClient(clientId, accessToken)
    .fields(GAME_FIELDS)
    .where(where)
    .sort('rating', 'desc')
    .limit(limit)
    .request('/games')

  return response.data
}

/**
 * Fetch all dashboard data in parallel.
 * Returns named categories with their games, plus a featured list for the hero carousel.
 */
export async function getDashboardData(): Promise<{
  featured: IGDBGame[]
  categories: { id: string; title: string; games: IGDBGame[] }[]
}> {
  igdbLog.info('getDashboardData: fetching all categories in parallel...')
  // Pre-warm the token so parallel calls below all hit the cache
  await getToken()
  const [featured, popular, rpgs, platformers, fighters, recent] = await Promise.all([
    getFeaturedGames(5),
    getPopularGames(15),
    getGamesByGenre('rpg', 15),
    getGamesByGenre('platformer', 15),
    getGamesByGenre('fighting', 15),
    getRecentGames(15)
  ])

  const categories = [
    { id: 'trending', title: 'Trending Now', games: popular },
    { id: 'rpgs', title: 'Top Retro RPGs', games: rpgs },
    { id: 'platformers', title: 'Classic Platformers', games: platformers },
    { id: 'fighters', title: 'Best Fighting Games', games: fighters },
    { id: 'recent', title: 'Recently Released', games: recent }
  ]

  igdbLog.info(
    'getDashboardData: complete →',
    `featured(${featured.length}),`,
    categories.map((c) => `${c.title}(${c.games.length})`).join(', ')
  )
  return { featured, categories }
}

/**
 * Invalidate the cached token (e.g. when credentials change).
 */
export function invalidateToken(): void {
  cachedToken = null
  tokenFetchPromise = null
}
