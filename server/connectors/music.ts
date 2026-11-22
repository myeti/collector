import { fetchJson } from '../lib/http.ts'
import { sha256 } from '../lib/crypto.ts'
import { config } from '../config.ts'
import { candidate, take } from './types.ts'
import type { Connector, MediaType } from './types.ts'

function musicFormat(raw?: string): string | undefined {
  const s = (raw || '').toLowerCase()
  if (/vinyl|lp|12"|7"|10"/.test(s)) return 'vinyl'
  if (/cassette|tape|k7/.test(s)) return 'tape'
  if (/cd/.test(s)) return 'cd'
  return undefined
}

function musicCategory(raw?: string): string | undefined {
  const s = (raw || '').toLowerCase()
  if (/compil/.test(s)) return 'compilation'
  if (/live/.test(s)) return 'live'
  if (/soundtrack|bande originale/.test(s)) return 'soundtrack'
  if (/spoken|audiobook|story|stories|audio drama/.test(s)) return 'stories'
  if (/\bep\b/.test(s)) return 'ep'
  if (/single/.test(s)) return 'single'
  if (/album/.test(s)) return 'album'
  return undefined
}

// ---------------------------------------------------------------- MusicBrainz
const musicBrainz: Connector = {
  id: 'musicBrainz',
  name: 'MusicBrainz',
  media: ['music'],
  keys: [],
  keysOptional: true,
  docs: 'https://musicbrainz.org/doc/MusicBrainz_API',
  async barcode(code) {
    return this.search!(`barcode:${code}`, null as any)
  },
  async search(query) {
    const q = query.startsWith('barcode:') ? query : `release:"${query.replace(/"/g, '')}"`
    // MusicBrainz asks for an identifiable User-Agent with a contact.
    const data = await fetchJson(`https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(q)}&fmt=json&limit=5`, {
      headers: { 'User-Agent': `Collector/0.1 ( ${config.publicUrl} )` },
    })
    return take(data?.releases, 5).map((r: any) => {
      const rg = r['release-group'] || {}
      const secondary = (rg['secondary-types'] || []).join(' ')
      return candidate(this, 'music', {
        title: r.title,
        author: r['artist-credit']?.map((a: any) => a.name + (a.joinphrase || '')).join('').trim(),
        editor: r['label-info']?.[0]?.label?.name,
        release_date: r.date,
        format: musicFormat(r.media?.map((m: any) => m.format).join(' ')),
        category: musicCategory(`${secondary} ${rg['primary-type'] || ''}`),
        barcode: r.barcode,
        cover: `https://coverartarchive.org/release/${r.id}/front-500`,
      }, `https://musicbrainz.org/release/${r.id}`)
    })
  },
}

// ---------------------------------------------------------------- Discogs
function discogsResult(this: Connector, r: any) {
  const [artist, ...rest] = String(r.title || '').split(' - ')
  const formats = (r.format || []).join(' ')
  return candidate(this, 'music', {
    title: rest.length ? rest.join(' - ') : r.title,
    author: rest.length ? artist.replace(/\s*\(\d+\)$/, '') : undefined,
    editor: r.label?.[0],
    release_date: r.year,
    genre: [...(r.style || []), ...(r.genre || [])].join(', '),
    format: musicFormat(formats),
    category: musicCategory(formats) || 'album',
    barcode: r.barcode?.[0]?.replace(/\D/g, ''),
    cover: r.cover_image && !r.cover_image.endsWith('spacer.gif') ? r.cover_image : undefined,
  }, r.uri ? `https://www.discogs.com${r.uri}` : undefined)
}

const discogs: Connector = {
  id: 'discogs',
  name: 'Discogs',
  media: ['music'],
  keys: [{ id: 'discogs', label: 'Personal access token' }],
  docs: 'https://www.discogs.com/settings/developers',
  async barcode(code, ctx) {
    const data = await fetchJson(`https://api.discogs.com/database/search?barcode=${code}&type=release&per_page=5&token=${ctx.keys.discogs}`)
    return take(data?.results, 5).map((r: any) => {
      const c = discogsResult.call(this, r)
      c.fields.barcode = code
      return c
    })
  },
  async search(query, ctx) {
    const data = await fetchJson(`https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&per_page=5&token=${ctx.keys.discogs}`)
    return take(data?.results, 5).map((r: any) => discogsResult.call(this, r))
  },
}

// ---------------------------------------------------------------- Deezer
const deezer: Connector = {
  id: 'deezer',
  name: 'Deezer',
  media: ['music'],
  keys: [],
  keysOptional: true,
  docs: 'https://developers.deezer.com/api',
  async barcode(code) {
    const a = await fetchJson(`https://api.deezer.com/album/upc:${code}`)
    if (!a || a.error) return []
    return [candidate(this, 'music', {
      title: a.title,
      author: a.artist?.name,
      editor: a.label,
      release_date: a.release_date,
      genre: a.genres?.data?.map((g: any) => g.name).join(', '),
      category: musicCategory(a.record_type),
      barcode: code,
      cover: a.cover_xl || a.cover_big,
    }, a.link)]
  },
  async search(query) {
    const data = await fetchJson(`https://api.deezer.com/search/album?q=${encodeURIComponent(query)}&limit=5`)
    return take(data?.data, 5).map((a: any) => candidate(this, 'music', {
      title: a.title,
      author: a.artist?.name,
      category: musicCategory(a.record_type),
      cover: a.cover_xl || a.cover_big,
    }, a.link))
  },
}

// ---------------------------------------------------------------- iTunes (music + movies)
function itunesArtwork(url?: string) {
  return url?.replace(/\/\d+x\d+bb\./, '/1200x1200bb.')
}

function itunesItem(this: Connector, r: any, type: MediaType, code?: string) {
  if (type === 'movie') {
    return candidate(this, 'movie', {
      title: r.trackName || r.collectionName,
      author: r.artistName,
      release_date: r.releaseDate,
      genre: r.primaryGenreName,
      category: r.kind === 'feature-movie' ? 'movie' : undefined,
      barcode: code,
      cover: itunesArtwork(r.artworkUrl100),
    }, r.trackViewUrl || r.collectionViewUrl)
  }
  return candidate(this, 'music', {
    title: r.collectionName?.replace(/ - (Single|EP)$/, ''),
    author: r.artistName,
    release_date: r.releaseDate,
    genre: r.primaryGenreName,
    category: musicCategory(r.collectionName) || 'album',
    barcode: code,
    cover: itunesArtwork(r.artworkUrl100),
  }, r.collectionViewUrl)
}

const itunes: Connector = {
  id: 'itunes',
  name: 'Apple iTunes',
  media: ['music'],
  keys: [],
  keysOptional: true,
  docs: 'https://performance-partners.apple.com/search-api',
  async barcode(code, ctx) {
    const data = await fetchJson(`https://itunes.apple.com/lookup?upc=${code}`)
    return take(data?.results, 3).map((r: any) => itunesItem.call(this, r, ctx.type, code))
  },
  async search(query, ctx) {
    const entity = ctx.type === 'movie' ? 'movie' : 'album'
    const country = (ctx.language || ctx.locale) === 'fr' ? 'FR' : 'US'
    const data = await fetchJson(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=${entity}&limit=5&country=${country}`)
    return take(data?.results, 5).map((r: any) => itunesItem.call(this, r, ctx.type))
  },
}

// ---------------------------------------------------------------- Spotify
// Keyed by client id AND secret: another user typing the same id with a wrong secret must not reuse the token.
let spotifyToken: { key: string; token: string; exp: number } | null = null
async function spotifyAuth(id: string, secret: string) {
  const key = `${id}:${sha256(secret)}`
  if (spotifyToken && spotifyToken.key === key && spotifyToken.exp > Date.now()) return spotifyToken.token
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Spotify auth failed (${res.status})`)
  const data: any = await res.json()
  spotifyToken = { key, token: data.access_token, exp: Date.now() + (data.expires_in - 60) * 1000 }
  return data.access_token
}

const spotify: Connector = {
  id: 'spotify',
  name: 'Spotify',
  media: ['music'],
  keys: [{ id: 'spotifyClientId', label: 'Client ID' }, { id: 'spotifyClientSecret', label: 'Client secret' }],
  docs: 'https://developer.spotify.com/dashboard',
  async barcode(code, ctx) {
    return (await this.search!(`upc:${code}`, ctx)).map((c) => ({ ...c, fields: { ...c.fields, barcode: code } }))
  },
  async search(query, ctx) {
    const token = await spotifyAuth(ctx.keys.spotifyClientId, ctx.keys.spotifyClientSecret)
    const data = await fetchJson(`https://api.spotify.com/v1/search?type=album&limit=5&q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return take(data?.albums?.items, 5).map((a: any) => candidate(this, 'music', {
      title: a.name,
      author: a.artists?.map((x: any) => x.name),
      release_date: a.release_date,
      category: a.album_type === 'compilation' ? 'compilation' : musicCategory(a.album_type),
      cover: a.images?.[0]?.url,
    }, a.external_urls?.spotify))
  },
}

// ---------------------------------------------------------------- Last.fm
const lastfm: Connector = {
  id: 'lastfm',
  name: 'Last.fm',
  media: ['music'],
  keys: [{ id: 'lastfm', label: 'API key' }],
  docs: 'https://www.last.fm/api/account/create',
  async search(query, ctx) {
    const base = `https://ws.audioscrobbler.com/2.0/?format=json&api_key=${ctx.keys.lastfm}`
    const data = await fetchJson(`${base}&method=album.search&limit=3&album=${encodeURIComponent(query)}`)
    const albums = take(data?.results?.albummatches?.album, 3)
    return Promise.all(albums.map(async (a: any) => {
      const info = await fetchJson(`${base}&method=album.getinfo&artist=${encodeURIComponent(a.artist)}&album=${encodeURIComponent(a.name)}`).catch(() => null)
      const tags = info?.album?.tags?.tag
      const img = (info?.album?.image || a.image || []).at(-1)?.['#text']
      return candidate(this, 'music', {
        title: a.name,
        author: a.artist,
        genre: (Array.isArray(tags) ? tags : tags ? [tags] : []).map((t: any) => t.name).join(', '),
        cover: img,
      }, a.url)
    }))
  },
}

export default [musicBrainz, deezer, itunes, discogs, spotify, lastfm]
