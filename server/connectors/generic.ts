// Generic product databases: they know (almost) every barcode but return shop-style titles.
// The aggregator uses their titles to run a second, title-based search on specialised APIs.
import { fetchJson } from '../lib/http.ts'
import { candidate, take } from './types.ts'
import type { Connector, Ctx } from './types.ts'
import { matchPlatform } from '../../shared/media.js'

function guessFormat(text: string, ctx: Ctx): Record<string, string> {
  const s = text.toLowerCase()
  if (ctx.type === 'movie') {
    if (/4k|uhd|ultra hd/.test(s)) return { format: 'uhd' }
    if (/blu-?ray/.test(s)) return { format: 'bluray' }
    if (/dvd/.test(s)) return { format: 'dvd' }
  }
  if (ctx.type === 'music') {
    if (/vinyl|vinyle|\blp\b/.test(s)) return { format: 'vinyl' }
    if (/cassette|tape/.test(s)) return { format: 'tape' }
    if (/\bcd\b/.test(s)) return { format: 'cd' }
  }
  if (ctx.type === 'videogame') {
    const platform = matchPlatform(s)
    if (platform) return { category: platform }
  }
  return {}
}

const upcitemdb: Connector = {
  id: 'upcitemdb',
  name: 'UPCitemdb',
  media: ['*'],
  keys: [{ id: 'upcitemdb', label: 'API key (optional, free trial otherwise)' }],
  keysOptional: true,
  docs: 'https://www.upcitemdb.com/wp/docs/main/development/',
  async barcode(code, ctx) {
    const key = ctx.keys.upcitemdb
    const url = key
      ? `https://api.upcitemdb.com/prod/v1/lookup?upc=${code}`
      : `https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`
    const data = await fetchJson(url, { headers: key ? { user_key: key, key_type: '3scale' } : {} })
    return take(data?.items, 3).map((it: any) => candidate(this, ctx.type, {
      title: it.title,
      editor: ctx.type === 'custom' ? it.brand : undefined,
      barcode: code,
      cover: it.images?.[0],
      ...guessFormat(`${it.title} ${it.category || ''}`, ctx),
    }, `https://www.upcitemdb.com/upc/${code}`))
  },
}

const barcodeLookup: Connector = {
  id: 'barcodeLookup',
  name: 'Barcode Lookup',
  media: ['*'],
  keys: [{ id: 'barcodeLookup', label: 'API key' }],
  docs: 'https://www.barcodelookup.com/api',
  async barcode(code, ctx) {
    const data = await fetchJson(`https://api.barcodelookup.com/v3/products?barcode=${code}&formatted=y&key=${ctx.keys.barcodeLookup}`)
    return take(data?.products, 3).map((p: any) => candidate(this, ctx.type, {
      title: p.title,
      author: p.author || p.artist,
      editor: p.publisher || p.manufacturer || p.brand,
      label: ctx.type === 'music' ? p.brand : undefined,
      release_date: p.release_date,
      genre: p.genre,
      barcode: code,
      cover: p.images?.[0],
      ...guessFormat(`${p.title} ${p.format || ''} ${p.category || ''}`, ctx),
    }, `https://www.barcodelookup.com/${code}`))
  },
}

const goUpc: Connector = {
  id: 'goUpc',
  name: 'Go-UPC',
  media: ['*'],
  keys: [{ id: 'goUpc', label: 'API key' }],
  docs: 'https://go-upc.com/api',
  async barcode(code, ctx) {
    const data = await fetchJson(`https://go-upc.com/api/v1/code/${code}`, {
      headers: { Authorization: `Bearer ${ctx.keys.goUpc}` },
    })
    const p = data?.product
    if (!p?.name) return []
    return [candidate(this, ctx.type, {
      title: p.name,
      barcode: code,
      cover: p.imageUrl,
      ...guessFormat(`${p.name} ${p.category || ''}`, ctx),
    }, `https://go-upc.com/search?q=${code}`)]
  },
}

export default [upcitemdb, barcodeLookup, goUpc]
