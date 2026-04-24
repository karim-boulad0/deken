import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'
import type { Database } from 'better-sqlite3'

const thisDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * - Dev / unpackaged: `db/migrations` at the repo root (sibling to `out/`).
 * - Packaged: `db/migrations` under `process.resourcesPath` (add as build extra resource).
 */
export function getMigrationsDirectory(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'db', 'migrations')
  }
  // Bundled as `out/main/index.js` → two levels up = repo root (sibling to `out/`).
  return path.join(thisDir, '..', '..', 'db', 'migrations')
}

function schemaMigrationsTableExists(db: Database): boolean {
  const row = db
    .prepare("SELECT 1 as x FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
    .get() as { x: number } | undefined
  return Boolean(row)
}

function getAppliedNames(db: Database): Set<string> {
  if (!schemaMigrationsTableExists(db)) {
    return new Set()
  }
  const rows = db.prepare('SELECT name FROM schema_migrations').all() as { name: string }[]
  return new Set(rows.map((r) => r.name))
}

/**
 * Run pending `*.sql` in lexical order; each file runs in one transaction, then the filename is recorded.
 */
export function migrate(db: Database): void {
  const dir = getMigrationsDirectory()
  if (!existsSync(dir)) {
    throw new Error(`Migrations directory not found: ${dir}`)
  }
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en'))
  if (files.length === 0) {
    throw new Error(`No .sql files in ${dir}`)
  }
  const applied = getAppliedNames(db)
  for (const name of files) {
    if (applied.has(name)) {
      continue
    }
    const sql = readFileSync(path.join(dir, name), 'utf8')
    const run = db.transaction(() => {
      db.exec(sql)
      if (!schemaMigrationsTableExists(db)) {
        throw new Error(
          `Migration must create schema_migrations: ${name}. Check 0001_add_schema_migrations_table.sql.`,
        )
      }
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(name)
    })
    run()
  }
}
