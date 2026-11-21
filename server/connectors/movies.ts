import { fetchJson } from '../lib/http.ts'
import { candidate, take } from './types.ts'
import type { Connector, Ctx } from './types.ts'

// TMDB genre ids are stable across languages: map them straight to our keys.
const TMDB_GENRES: Record<number, string> = {
  28: 'action', 12: 'adventure', 35: 'comedy', 80: 'crime', 99: 'documentary', 18: 'drama',
  10751: 'family', 14: 'fantasy', 36: 'history', 27: 'horror', 10402: 'musical', 9648: 'mystery',
  10749: 'romance', 878: 'science_fiction', 53: 'thriller', 10752: 'war', 37: 'western',
  10759: 'action', 10765: 'science_fiction', 10768: 'war', 10762: 'family',
}

function tmdbFetch(path: string, ctx: Ctx, params: Record<string, string> = {}) {
  const key = ctx.keys.tmdb
  const bearer = key.startsWith('eyJ') // v4 read access token vs v3 api key
  const qs = new URLSearchParams({ language: ctx.locale === 'fr' ? 'fr-FR' : 'en-US', ...params })
  if (!bearer) qs.set('api_key', key)
  return fetchJson(`https://api.themoviedb.org/3${path}?${qs}`, {
    headers: bearer ? { Authorization: `Bearer ${key}` } : {},
  })
}

const tmdb: Connector = {
  id: 'tmdb',
  name: 'TMDB',
  media: ['movie'],
  keys: [{ id: 'tmdb', label: 'API key / read access token' }],
  docs: 'https://www.themoviedb.org/settings/api',
  async search(query, ctx) {
    const data = await tmdbFetch('/search/multi', ctx, { query, include_adult: 'false' })
    const hits = take((data?.results || []).filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv'), 4)
    return Promise.all(hits.map(async (hit: any) => {
      const isTv = hit.media_type === 'tv'
      const d = await tmdbFetch(`/${hit.media_type}/${hit.id}`, ctx, { append_to_response: 'credits' }).catch(() => hit)
      const genreIds: number[] = d.genres?.map((g: any) => g.id) || hit.genre_ids || []
      const animated = genreIds.includes(16)
      const director = isTv
        ? d.created_by?.map((p: any) => p.name)
        : d.credits?.crew?.filter((p: any) => p.job === 'Director').map((p: any) => p.name)
      return candidate(this, 'movie', {
        title: d.title || d.name,
        director,
        release_date: d.release_date || d.first_air_date,
        genre: genreIds.map((g) => TMDB_GENRES[g]).find(Boolean),
        category: isTv ? (animated ? 'animated_series' : 'series') : (animated ? 'animated_movie' : 'movie'),
        saga: d.belongs_to_collection?.name?.replace(/\s*[-–]?\s*(Saga|Collection|la saga)$/i, ''),
        cover: d.poster_path ? `https://image.tmdb.org/t/p/w780${d.poster_path}` : undefined,
        description: d.overview?.slice(0, 2000),
      }, `https://www.themoviedb.org/${hit.media_type}/${hit.id}`)
    }))
  },
}

const omdb: Connector = {
  id: 'omdb',
  name: 'OMDb',
  media: ['movie'],
  keys: [{ id: 'omdb', label: 'API key' }],
  docs: 'https://www.omdbapi.com/apikey.aspx',
  async search(query, ctx) {
    const base = `https://www.omdbapi.com/?apikey=${ctx.keys.omdb}`
    const data = await fetchJson(`${base}&s=${encodeURIComponent(query)}`)
    const hits = take((data?.Search || []).filter((r: any) => r.Type !== 'game'), 3)
    return Promise.all(hits.map(async (hit: any) => {
      const d = (await fetchJson(`${base}&i=${hit.imdbID}`).catch(() => null)) || hit
      const na = (v: any) => (v && v !== 'N/A' ? v : undefined)
      const animated = /animation/i.test(d.Genre || '')
      const series = d.Type === 'series'
      return candidate(this, 'movie', {
        title: d.Title,
        director: na(d.Director) || na(d.Writer),
        release_date: na(d.Released) ? new Date(d.Released).toISOString().slice(0, 10) : na(d.Year),
        genre: na(d.Genre),
        category: series ? (animated ? 'animated_series' : 'series') : (animated ? 'animated_movie' : 'movie'),
        cover: na(d.Poster),
        description: na(d.Plot),
      }, `https://www.imdb.com/title/${hit.imdbID}/`)
    }))
  },
}

export default [tmdb, omdb]
