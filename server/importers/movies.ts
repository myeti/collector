import { clean, has, year } from './types.ts'
import type { Importer, ImportRow } from './types.ts'

// Letterboxd: watched.csv / diary.csv / ratings.csv from the data export, or a list export (e.g. "Films I own").
// watchlist.csv has the very same columns as watched.csv: only its name tells them apart.
export const letterboxd: Importer = {
  id: 'letterboxd',
  name: 'Letterboxd',
  type: 'movie',
  url: 'https://letterboxd.com/settings/data/',
  header: (c) => has(c, 'Name', 'Year') && (c.includes('Letterboxd URI') || has(c, 'Position', 'URL')),
  rows: (records, filename) => {
    const list = records[0] && 'Position' in records[0]
    const watchlist = /watchlist/i.test(filename)
    return records.map((r): ImportRow => ({
      fields: {
        title: clean(r.Name),
        release_date: year(r.Year),
        category: 'movie',
        consumed: !list && !watchlist,
      },
      excluded: watchlist ? 'toConsume' : undefined,
    }))
  },
}
