import { eq } from 'drizzle-orm'
import log from 'electron-log/main'
import { getDb } from './db'
import { libraryGames } from './db/schema'
import type { LibraryGameRow, LibraryGameInsert } from './db/schema'

const libLog = log.scope('library')

export interface LibraryGameSnapshot {
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

function snapshotToRow(snap: LibraryGameSnapshot): LibraryGameInsert {
  return {
    igdbId: snap.igdbId,
    title: snap.title,
    platforms: JSON.stringify(snap.platforms),
    platformsShort: JSON.stringify(snap.platformsShort),
    coverImageId: snap.coverImageId ?? null,
    year: snap.year ?? null,
    developer: snap.developer ?? null,
    genre: snap.genre ?? null,
    description: snap.description ?? null,
    rating: snap.rating ?? null,
    igdbUrl: snap.igdbUrl ?? null,
    igdbGameType: snap.igdbGameType ?? null
  }
}

function rowToSnapshot(row: LibraryGameRow): LibraryGameSnapshot {
  return {
    igdbId: row.igdbId,
    title: row.title,
    platforms: JSON.parse(row.platforms) as string[],
    platformsShort: JSON.parse(row.platformsShort) as string[],
    coverImageId: row.coverImageId ?? undefined,
    year: row.year ?? undefined,
    developer: row.developer ?? undefined,
    genre: row.genre ?? undefined,
    description: row.description ?? undefined,
    rating: row.rating ?? undefined,
    igdbUrl: row.igdbUrl ?? undefined,
    igdbGameType: row.igdbGameType ?? undefined
  }
}

export function getLibraryGames(): LibraryGameSnapshot[] {
  const db = getDb()
  const rows = db.select().from(libraryGames).all()
  libLog.info('getLibraryGames → count:', rows.length)
  return rows.map(rowToSnapshot)
}

export function addToLibrary(snapshot: LibraryGameSnapshot): void {
  const db = getDb()
  const row = snapshotToRow(snapshot)
  libLog.info('addToLibrary → igdbId:', snapshot.igdbId, 'title:', snapshot.title)
  db.insert(libraryGames)
    .values(row)
    .onConflictDoUpdate({
      target: libraryGames.igdbId,
      set: row
    })
    .run()
}

export function removeFromLibrary(igdbId: number): void {
  const db = getDb()
  libLog.info('removeFromLibrary → igdbId:', igdbId)
  db.delete(libraryGames).where(eq(libraryGames.igdbId, igdbId)).run()
}

export function isInLibrary(igdbId: number): boolean {
  const db = getDb()
  const row = db
    .select({ igdbId: libraryGames.igdbId })
    .from(libraryGames)
    .where(eq(libraryGames.igdbId, igdbId))
    .get()
  return !!row
}
