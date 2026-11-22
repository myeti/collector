// Data changes between releases, applied once each, in order, on start (see runMigrations in db.ts).
// Never edit or reorder a migration that has shipped: add a new one. Each must work on a fresh database too
// (sync() creates tables from the current models, so check what exists before moving data).
import { commonFields } from './001-common-fields.ts'
import { requiredFormat } from './002-required-format.ts'

export interface Migration {
  name: string
  up(ctx: {
    query: (sql: string, replacements?: Record<string, any>) => Promise<any>
    /** Names of a table's current columns */
    columns: (table: string) => Promise<Set<string>>
  }): Promise<void>
}

export const MIGRATIONS: Migration[] = [commonFields, requiredFormat]
