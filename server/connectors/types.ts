import { matchGenre, MEDIA } from '../../shared/media.js'

export type MediaType = 'book' | 'music' | 'movie' | 'videogame' | 'custom'

export interface Ctx {
  keys: Record<string, string>
  type: MediaType
  locale: string
}

export interface Candidate {
  source: string
  sourceName: string
  url?: string
  type: MediaType
  fields: Record<string, any>
}

export interface Connector {
  id: string
  name: string
  media: (MediaType | '*')[]
  /** Key names stored in user settings. Required unless `keysOptional`. */
  keys: { id: string; label: string }[]
  keysOptional?: boolean
  docs: string
  barcode?: (code: string, ctx: Ctx) => Promise<Candidate[]>
  search?: (query: string, ctx: Ctx) => Promise<Candidate[]>
}

export function enabled(c: Connector, keys: Record<string, string>) {
  return c.keysOptional || c.keys.every((k) => keys[k.id])
}

export function normDate(v: any): string | undefined {
  if (v === null || v === undefined || v === '') return undefined
  if (typeof v === 'number') {
    // Unix seconds (IGDB) or a bare year
    if (v > 3000) return new Date(v * 1000).toISOString().slice(0, 10)
    return String(v)
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/)
  if (m) return [m[1], m[2]?.padStart(2, '0'), m[3]?.padStart(2, '0')].filter(Boolean).join('-')
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/) // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = s.match(/\b(1[89]\d{2}|20\d{2})\b/)
  return m ? m[1] : undefined
}

export function clean(v: any): string | undefined {
  if (v === null || v === undefined) return undefined
  if (Array.isArray(v)) v = v.filter(Boolean).join(', ')
  const s = String(v).replace(/\s+/g, ' ').trim()
  return s || undefined
}

export function https(url: any): string | undefined {
  const s = clean(url)
  return s ? s.replace(/^http:\/\//, 'https://') : undefined
}

/** Builds a candidate, dropping empty values and normalising dates/genres/categories. */
export function candidate(
  source: Connector | { id: string; name: string },
  type: MediaType,
  fields: Record<string, any>,
  url?: string,
): Candidate {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(fields)) {
    const val = k === 'release_date' ? normDate(v) : k === 'cover' ? https(v) : clean(v)
    if (val !== undefined) out[k] = val
  }
  if (out.genre) out.genre = matchGenre(type, out.genre) || out.genre.split(',')[0].trim()
  if (out.category && !MEDIA[type].categories.includes(out.category)) delete out.category
  if (out.format && !MEDIA[type].formats.includes(out.format)) delete out.format
  return { source: source.id, sourceName: source.name, url, type, fields: out }
}

/** "Hergé - Tintin (DVD) [Blu-ray] Édition collector" -> "Hergé - Tintin" for title searches. */
export function cleanProductTitle(title: string): string {
  return title
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/\b(blu-?ray|dvd|4k|uhd|ultra hd|steelbook|digibook|coffret|box ?set|édition|edition|collector|limitée?|limited|special|spéciale|version longue|extended|remastered|import|vf|vost|ps[1-5]|playstation ?[1-5]?|xbox( one| series [xs])?|nintendo|switch|wii ?u?|pc|cd|vinyl|vinyle|lp|cassette)\b/gi, ' ')
    .replace(/\s*[-–:|]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export const take = <T>(arr: T[] | undefined | null, n: number): T[] => (arr || []).slice(0, n)
