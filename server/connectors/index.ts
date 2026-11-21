import books from './books.ts'
import music from './music.ts'
import movies from './movies.ts'
import games from './games.ts'
import generic from './generic.ts'
import { cleanProductTitle, enabled } from './types.ts'
import type { Candidate, Connector, Ctx, MediaType } from './types.ts'
import { isIsbn } from '../../shared/media.js'

export const CONNECTORS: Connector[] = [...books, ...music, ...movies, ...games, ...generic]
const GENERIC = new Set(generic.map((c) => c.id))

export interface LookupResult {
  type: MediaType
  query?: string
  candidates: Candidate[]
  sources: string[]
  errors: { source: string; message: string }[]
}

function forType(type: MediaType, keys: Record<string, string>) {
  return CONNECTORS.filter((c) => (c.media.includes(type) || c.media.includes('*')) && enabled(c, keys))
}

async function run(
  connectors: Connector[],
  call: (c: Connector) => Promise<Candidate[]> | undefined,
  result: LookupResult,
) {
  const settled = await Promise.allSettled(connectors.map(async (c) => {
    if (!result.sources.includes(c.name)) result.sources.push(c.name)
    return (await call(c)) || []
  }))
  const found: Candidate[] = []
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') found.push(...s.value.filter((c) => c.fields.title))
    else result.errors.push({ source: connectors[i].name, message: String(s.reason?.message || s.reason) })
  })
  return found
}

export async function lookupBarcode(rawCode: string, ctx: Ctx): Promise<LookupResult> {
  const code = rawCode.replace(/[^0-9X]/gi, '').toUpperCase()
  // ISBNs ("Bookland" EAN 978/979) are always books, whatever tab the user scanned from.
  const type: MediaType = isIsbn(code) ? 'book' : ctx.type
  const c = { ...ctx, type }
  const result: LookupResult = { type, candidates: [], sources: [], errors: [] }

  const connectors = forType(type, ctx.keys).filter((x) => x.barcode)
  const hits = await run(connectors, (x) => x.barcode!(code, c), result)
  const specialised = hits.filter((h) => !GENERIC.has(h.source))
  const productHits = hits.filter((h) => GENERIC.has(h.source))
  result.candidates.push(...specialised, ...productHits)

  // Shop databases gave us a product name: ask the specialised APIs about that title.
  const titles = [...new Set(productHits.map((h) => cleanProductTitle(h.fields.title)).filter((t) => t.length > 1))]
  if (titles.length && (type === 'movie' || type === 'videogame' || type === 'custom' || specialised.length === 0)) {
    const searchers = forType(type, ctx.keys).filter((x) => x.search && !GENERIC.has(x.id))
    result.query = titles[0]
    const extra = await run(searchers, (x) => x.search!(titles[0], c), result)
    const hint = productHits[0].fields
    for (const e of extra) {
      e.fields.barcode ??= code
      if (hint.format) e.fields.format ??= hint.format
      // The scanned box tells the exact platform, while game APIs list every platform of the game.
      if (type === 'videogame' && hint.category) e.fields.category = hint.category
    }
    result.candidates.push(...extra)
  }
  return result
}

/**
 * Finding an item, the same everywhere (add review, "Search sources", cover finder):
 * its identifier (barcode, ISBN) first; when that finds nothing and a text is known, the text.
 * The identifier may move the item to another media type (an ISBN scanned from the music tab is a book).
 */
export async function findItem(query: { code?: string; text?: string }, ctx: Ctx): Promise<LookupResult> {
  let result: LookupResult | null = null
  if (query.code) result = await lookupBarcode(query.code, ctx)
  if ((!result || !result.candidates.length) && query.text && query.text.length >= 2) {
    const search = await searchAll(query.text, { ...ctx, type: result?.type || ctx.type })
    result = result
      ? { ...search, type: result.type, sources: [...new Set([...result.sources, ...search.sources])], errors: [...result.errors, ...search.errors] }
      : search
  }
  return result || { type: ctx.type, candidates: [], sources: [], errors: [] }
}

export async function searchAll(query: string, ctx: Ctx): Promise<LookupResult> {
  const result: LookupResult = { type: ctx.type, query, candidates: [], sources: [], errors: [] }
  const searchers = forType(ctx.type, ctx.keys).filter((x) => x.search)
  result.candidates = await run(searchers, (x) => x.search!(query, ctx), result)
  return result
}

/** Public description of the connectors, for the settings screen. */
export function describeConnectors(keys: Record<string, string>) {
  return CONNECTORS.map((c) => ({
    id: c.id,
    name: c.name,
    media: c.media,
    docs: c.docs,
    keysOptional: !!c.keysOptional,
    capabilities: [c.barcode && 'barcode', c.search && 'search'].filter(Boolean),
    keys: c.keys.map((k) => ({ id: k.id, label: k.label })),
    enabled: enabled(c, keys),
  }))
}

export type { Candidate, Ctx, MediaType }
