import { clean, has, year } from './types.ts'
import type { Importer, ImportRow } from './types.ts'

/** ISBN cells, including Goodreads' spreadsheet-proof ="9780593158364" */
const isbn = (s: any) => {
  const v = String(s ?? '').replace(/[^0-9X]/gi, '').toUpperCase()
  return v.length === 10 || v.length === 13 ? v : undefined
}

/** "The Way of Kings (The Stormlight Archive, #1)" -> title, saga and volume */
export function seriesTitle(raw: string) {
  const m = raw.match(/^(.*\S)\s*\(([^()]*?),?\s*#\s*(\d+(?:\.\d+)?)\)\s*$/)
  return m ? { title: m[1], saga: clean(m[2]), volume: m[3] } : { title: raw }
}

const DIGITAL = /kindle|e-?book|audio|audible|digital|epub|pdf/i
const WISHLIST = /wish|to-?buy|want/i

export const goodreads: Importer = {
  id: 'goodreads',
  name: 'Goodreads',
  type: 'book',
  url: 'https://www.goodreads.com/review/import',
  header: (c) => has(c, 'Book Id', 'Title', 'Author', 'Exclusive Shelf'),
  rows: (records) => records.map((r): ImportRow => {
    const shelf = r['Exclusive Shelf']
    const shelves = r.Bookshelves || ''
    return {
      fields: {
        ...seriesTitle(clean(r.Title) || ''),
        author: clean(r.Author),
        editor: clean(r.Publisher),
        isbn: isbn(r.ISBN13) || isbn(r.ISBN),
        release_date: year(r['Original Publication Year']) || year(r['Year Published']),
        consumed: shelf === 'read',
        digitalized: DIGITAL.test(r.Binding || ''),
        comment: clean(r['Private Notes']),
      },
      excluded: shelf === 'to-read' ? 'toConsume' : WISHLIST.test(shelves) ? 'wishlist' : undefined,
    }
  }),
}

// The StoryGraph says whether a book is owned: only those are imported (read or not).
export const storygraph: Importer = {
  id: 'storygraph',
  name: 'The StoryGraph',
  type: 'book',
  url: 'https://app.thestorygraph.com/user-export',
  header: (c) => has(c, 'Title', 'Authors', 'Read Status') && c.some((h) => /^owned/i.test(h)),
  rows: (records) => records.map((r): ImportRow => {
    const ownedKey = Object.keys(r).find((k) => /^owned/i.test(k))!
    const status = (r['Read Status'] || '').toLowerCase()
    return {
      fields: {
        ...seriesTitle(clean(r.Title) || ''),
        author: clean(r.Authors),
        isbn: isbn(r['ISBN/UID']),
        consumed: status === 'read',
        digitalized: DIGITAL.test(r.Format || ''),
      },
      excluded: !/^(yes|true|1)$/i.test(r[ownedKey] || '') ? 'notOwned' : undefined,
    }
  }),
}
