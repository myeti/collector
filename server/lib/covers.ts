// Finding a cover for an item saved without one (imports, manual entries).
import { findItem } from '../connectors/index.ts'
import type { Candidate, Ctx } from '../connectors/index.ts'
import { importRemoteImage } from './images.ts'
import { norm, sameAuthor, similarTitle } from './matching.ts'
import { queryText } from '../../shared/text.js'

const creator = (f: any) => f.author || f.director

/** A wrong cover is worse than none: title, creator, volume (and a movie's year) must agree. */
function matches(item: any, c: Candidate) {
  const f = c.fields
  if (!f.cover || !similarTitle(item.title, f.title) || !sameAuthor(creator(item), creator(f))) return false
  if (item.volume && f.volume && norm(item.volume) !== norm(f.volume)) return false
  const [a, b] = [item.release_date, f.release_date].map((d) => Number(String(d || '').slice(0, 4)))
  return !(item.type === 'movie' && a && b && Math.abs(a - b) > 1)
}

/** Downloads the first usable image; null when none could be stored. */
async function firstStored(urls: string[], ownerId: string) {
  for (const url of [...new Set(urls)].slice(0, 3)) {
    const stored = await importRemoteImage(url, ownerId)
    if (stored) return stored
  }
  return null
}

/**
 * ISBN first (Open Library serves covers by ISBN without any search), then the barcode lookup, then a title search
 * on every source of the media type. Returns the stored cover path, or null.
 */
export async function findCover(item: any, ctx: Ctx): Promise<string | null> {
  if (item.type === 'book' && item.isbn) {
    const stored = await importRemoteImage(`https://covers.openlibrary.org/b/isbn/${item.isbn}-L.jpg?default=false`, item.user_id)
    if (stored) return stored
  }
  const code = item.isbn || item.barcode
  if (code) {
    const { candidates } = await findItem({ code }, ctx)
    // A barcode names one product: its covers are trusted unless the title clearly differs (ISBN lookups are exact).
    const urls = candidates.filter((c) => c.fields.cover && (!c.fields.title || similarTitle(item.title, c.fields.title) || item.type === 'book'))
    const stored = await firstStored(urls.map((c) => c.fields.cover), item.user_id)
    if (stored) return stored
  }
  const { candidates } = await findItem({ text: queryText(item, item.type) }, ctx)
  return firstStored(candidates.filter((c) => matches(item, c)).map((c) => c.fields.cover), item.user_id)
}
