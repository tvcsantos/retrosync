import { app } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import log from 'electron-log/main'
import * as schema from './schema'

const dbLog = log.scope('db')

let db: ReturnType<typeof drizzle<typeof schema>> | null = null
let sqliteInstance: InstanceType<typeof Database> | null = null

function getMigrationsPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'migrations')
  }
  return join(app.getAppPath(), 'resources', 'migrations')
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (db) return db

  const dbPath = join(app.getPath('userData'), 'retrosync.db')
  dbLog.info('Opening database at:', dbPath)

  sqliteInstance = new Database(dbPath)
  sqliteInstance.pragma('journal_mode = WAL')

  db = drizzle(sqliteInstance, { schema })

  const migrationsPath = getMigrationsPath()
  dbLog.info('Running migrations from:', migrationsPath)
  migrate(db, { migrationsFolder: migrationsPath })

  dbLog.info('Database ready')
  return db
}

/** Return the raw better-sqlite3 Database instance (for addon DDL). */
export function getSqlite(): InstanceType<typeof Database> {
  if (!sqliteInstance) {
    // Ensure the DB has been initialised
    getDb()
  }
  return sqliteInstance!
}
