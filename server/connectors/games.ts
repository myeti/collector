import { fetchJson } from '../lib/http.ts'
import { sha256 } from '../lib/crypto.ts'
import { candidate, take } from './types.ts'
import type { Connector } from './types.ts'
import { matchPlatform } from '../../shared/media.js'

/** First platform of the list we know about: it becomes the item format (shown as Platform). */
const platformOf = (names: string[]) => names.map(matchPlatform).find(Boolean)

// ---------------------------------------------------------------- RAWG
const rawg: Connector = {
  id: 'rawg',
  name: 'RAWG',
  media: ['videogame'],
  keys: [{ id: 'rawg', label: 'API key' }],
  docs: 'https://rawg.io/apidocs',
  languages: ['en'],
  async search(query, ctx) {
    const base = 'https://api.rawg.io/api/games'
    const data = await fetchJson(`${base}?key=${ctx.keys.rawg}&search=${encodeURIComponent(query)}&page_size=4`)
    return Promise.all(take(data?.results, 4).map(async (g: any) => {
      const d = (await fetchJson(`${base}/${g.id}?key=${ctx.keys.rawg}`).catch(() => null)) || g
      return candidate(this, 'videogame', {
        title: d.name,
        author: d.developers?.map((x: any) => x.name),
        editor: d.publishers?.map((x: any) => x.name),
        release_date: d.released,
        genre: d.genres?.map((x: any) => x.name).join(', '),
        format: platformOf((d.platforms || []).map((p: any) => p.platform?.name)),
        cover: d.background_image,
        description: d.description_raw?.slice(0, 2000),
      }, `https://rawg.io/games/${g.slug}`)
    }))
  },
}

// ---------------------------------------------------------------- IGDB (Twitch)
// Keyed by client id AND secret: another user typing the same id with a wrong secret must not reuse the token.
let igdbToken: { key: string; token: string; exp: number } | null = null
async function igdbAuth(id: string, secret: string) {
  const key = `${id}:${sha256(secret)}`
  if (igdbToken && igdbToken.key === key && igdbToken.exp > Date.now()) return igdbToken.token
  const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`, {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Twitch auth failed (${res.status})`)
  const data: any = await res.json()
  igdbToken = { key, token: data.access_token, exp: Date.now() + (data.expires_in - 60) * 1000 }
  return data.access_token
}

const igdb: Connector = {
  id: 'igdb',
  name: 'IGDB',
  media: ['videogame'],
  keys: [{ id: 'igdbClientId', label: 'Twitch client ID' }, { id: 'igdbClientSecret', label: 'Twitch client secret' }],
  docs: 'https://api-docs.igdb.com/#account-creation',
  languages: ['en'],
  async search(query, ctx) {
    const token = await igdbAuth(ctx.keys.igdbClientId, ctx.keys.igdbClientSecret)
    const body = `search "${query.replace(/"/g, '')}"; limit 5;
      fields name,slug,first_release_date,summary,genres.name,cover.image_id,platforms.name,platforms.abbreviation,
      involved_companies.company.name,involved_companies.publisher,involved_companies.developer,franchises.name,collections.name;`
    const res = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: { 'Client-ID': ctx.keys.igdbClientId, Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
      body,
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} on api.igdb.com`)
    const games: any[] = await res.json()
    return games.map((g) => {
      const companies = g.involved_companies || []
      return candidate(this, 'videogame', {
        title: g.name,
        author: companies.filter((c: any) => c.developer).map((c: any) => c.company?.name),
        editor: companies.filter((c: any) => c.publisher).map((c: any) => c.company?.name),
        release_date: g.first_release_date,
        genre: g.genres?.map((x: any) => x.name).join(', '),
        format: platformOf((g.platforms || []).map((p: any) => `${p.name || ''} ${p.abbreviation || ''}`)),
        saga: g.franchises?.[0]?.name || g.collections?.[0]?.name,
        cover: g.cover?.image_id ? `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${g.cover.image_id}.jpg` : undefined,
        description: g.summary?.slice(0, 2000),
      }, `https://www.igdb.com/games/${g.slug}`)
    })
  },
}

export default [igdb, rawg]
