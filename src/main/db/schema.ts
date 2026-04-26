import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const libraryGames = sqliteTable('library_games', {
  igdbId: integer('igdb_id').primaryKey(),
  title: text('title').notNull(),
  platforms: text('platforms').notNull(), // JSON array
  platformsShort: text('platforms_short').notNull(), // JSON array
  coverImageId: text('cover_image_id'),
  year: integer('year'),
  developer: text('developer'),
  genre: text('genre'),
  description: text('description'),
  rating: real('rating'),
  igdbUrl: text('igdb_url'),
  igdbGameType: integer('igdb_game_type'),
  addedAt: text('added_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString())
})

export type LibraryGameRow = typeof libraryGames.$inferSelect
export type LibraryGameInsert = typeof libraryGames.$inferInsert

// ---------- Imports ----------

export const imports = sqliteTable('imports', {
  id: text('id').primaryKey(),
  addonId: text('addon_id').notNull(),
  sourceRef: text('source_ref'),
  romFilename: text('rom_filename').notNull(),
  gameName: text('game_name'),
  platformId: integer('platform_id').notNull(),
  collection: text('collection').notNull(),
  status: text('status').notNull(), // queued | importing | paused | completed | error
  progress: real('progress').notNull().default(0),
  totalSize: integer('total_size').notNull().default(0),
  importedSize: integer('imported_size').notNull().default(0),
  savePath: text('save_path'),
  error: text('error'),
  createdAt: text('created_at').notNull(),
  completedAt: text('completed_at')
})

export type ImportRow = typeof imports.$inferSelect
export type ImportInsert = typeof imports.$inferInsert
