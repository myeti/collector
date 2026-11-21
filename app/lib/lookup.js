// Metadata lookup shared by every add method and by "Search sources" in the form. The server decides
// (an identifier first, then the text: findItem); this caches answers for the page's life.
import { api, qs } from './api.js'

const cache = new Map() // results of this page session, so a queued item opens instantly once prefetched

export { queryText } from '../../shared/text.js'

/** "9782070612758" -> identifier; anything else is text. */
export function parseQuery(input) {
  const raw = String(input || '').trim()
  const code = raw.replace(/[\s-]/g, '')
  return /^[0-9]{7,13}[0-9X]$/i.test(code) ? { code } : { text: raw }
}

/**
 * { code } and/or { text } -> { type, candidates, sources, errors }.
 * type may differ from the one asked: an ISBN scanned from the music tab is a book.
 * fresh: ask again (the "Search" button), whatever was found before.
 */
export async function lookupFor(query, type, { fresh = false } = {}) {
  const key = JSON.stringify([type, query.code || '', query.text || ''])
  if (fresh || !cache.has(key)) {
    const run = api.get(`/lookup${qs({ code: query.code, q: query.text, type })}`)
    cache.set(key, run)
    // A failure, or a source that failed (rate limit, timeout…), is asked again next time
    run.then((r) => { if (r.errors?.length) cache.delete(key) }, () => cache.delete(key))
  }
  return cache.get(key)
}
