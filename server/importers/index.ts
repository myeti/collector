// CSV imports from other services. To add one: an Importer in this folder, listed below, and its help text
// in the i18n files (import.sources.<id>).
import { parseCsv, records } from './csv.ts'
import { goodreads, storygraph } from './books.ts'
import { discogs } from './music.ts'
import { letterboxd } from './movies.ts'
import { rawg } from './games.ts'
import type { Importer, ImportRow } from './types.ts'

export type { Importer, ImportRow } from './types.ts'

export const IMPORTERS: Importer[] = [goodreads, storygraph, discogs, letterboxd, rawg]

/** Finds the service (the given one, or any) and its header row within the first lines; null when unrecognised. */
export function readExport(text: string, filename: string, source?: string) {
  const table = parseCsv(text)
  const candidates = source ? IMPORTERS.filter((i) => i.id === source) : IMPORTERS
  for (let h = 0; h < Math.min(table.length, 12); h++) {
    const columns = table[h].map((c) => c.trim())
    const importer = candidates.find((i) => i.header(columns, filename))
    if (importer) return { importer, rows: importer.rows(records(table, h), filename) as ImportRow[] }
  }
  return null
}
