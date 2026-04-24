import { app } from 'electron'
import { mkdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { migrate } from './migrate'

let db: Database.Database | null = null

function databaseFilePath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return path.join(dir, 'deken.sqlite')
}

/**
 * Open SQLite (once), run migrations, return the handle. Main process only.
 */
export function getDatabase(): Database.Database {
  if (db) return db
  const filePath = databaseFilePath()
  db = new Database(filePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')
  migrate(db)
  return db
}

export function closeDatabase(): void {
  if (db) {
    try {
      db.close()
    } catch {
      /* already closed or unusable */
    }
    db = null
  }
}

export { databaseFilePath }
