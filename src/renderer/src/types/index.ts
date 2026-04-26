export interface Game {
  id: string
  title: string
  platforms: string[]
  platformsShort: string[]
  igdbPlatformIds: number[]
  year: number
  developer: string
  genre: string
  description: string
  rating: number
  boxArtUrl: string
  heroImageUrl?: string
  screenshots: string[]
  isMultiDisc: boolean
  discs: Disc[]
  requiresBios: boolean
  biosStatus: 'ok' | 'missing'
  biosName?: string
  fileSize: string
  inCollection: boolean
  // IGDB integration fields
  igdbId?: number
  igdbUrl?: string
  igdbGameType?: number
  coverImageId?: string
  artworkImageIds?: string[]
  screenshotImageIds?: string[]
  cachedCoverPath?: string
  cachedArtworkPaths?: string[]
  cachedScreenshotPaths?: string[]
  igdbDetailsFetched?: boolean
}

export interface Disc {
  label: string
  files: string[]
}

export interface GameCategory {
  id: string
  title: string
  games: Game[]
}

export type Page =
  | 'home'
  | 'library'
  | 'imports'
  | 'platform-setup'
  | 'addons'
  | 'settings'
  | 'about'
