import { fetchJson } from '../lib/http.ts'
import { candidate, take } from './types.ts'
import type { Connector, Ctx } from './types.ts'

/** A book's kind (its format) from subjects, shelves, tags or binding: "Manga", "Bande dessinée", "Juvenile fiction"… */
export function bookFormat(subjects: string): string | undefined {
  const s = subjects.toLowerCase()
  if (/manga/.test(s)) return 'manga'
  if (/comic|bande dessin|graphic novel|bd\b/.test(s)) return 'comic'
  if (/magazine|periodical|journal/.test(s)) return 'magazine'
  if (/juvenile|children|jeunesse/.test(s)) return 'children'
  if (/fiction|novel|roman/.test(s)) return 'novel'
  return undefined
}

/** "Astérix - Tome 12 : Astérix aux jeux olympiques" -> saga/volume hints */
function sagaHints(title?: string, seriesHint?: string) {
  if (!title) return {}
  const m = title.match(/^(.*?)[\s,-]*(?:tome|t\.|vol\.?|volume|#|n°)\s*(\d+)/i)
  if (m) return { saga: seriesHint || m[1].replace(/[\s:,-]+$/, ''), volume: m[2] }
  return seriesHint ? { saga: seriesHint } : {}
}

// Open Library speaks MARC language codes
const MARC: Record<string, string> = { fr: 'fre', en: 'eng', de: 'ger', es: 'spa', it: 'ita', pt: 'por', nl: 'dut', ja: 'jpn' }
const ISO: Record<string, string> = Object.fromEntries(Object.entries(MARC).map(([iso, marc]) => [marc, iso]))

// ---------------------------------------------------------------- Google Books
const googleBooks: Connector = {
  id: 'googleBooks',
  name: 'Google Books',
  media: ['book'],
  keys: [{ id: 'googleBooks', label: 'API key' }],
  keysOptional: true,
  docs: 'https://developers.google.com/books/docs/v1/using#APIKey',
  async barcode(code, ctx) {
    return this.search!(`isbn:${code}`, ctx).then((r) => r.map((c) => ({ ...c, fields: { ...c.fields, barcode: code } })))
  },
  async search(query, ctx) {
    const params = new URLSearchParams({ q: query, maxResults: '5', printType: 'all' })
    if (ctx.language) params.set('langRestrict', ctx.language)
    if (ctx.keys.googleBooks) params.set('key', ctx.keys.googleBooks)
    const data = await fetchJson(`https://www.googleapis.com/books/v1/volumes?${params}`)
    return take(data?.items, 5).map((it: any) => {
      const v = it.volumeInfo || {}
      const isbn = v.industryIdentifiers?.find((i: any) => i.type === 'ISBN_13')?.identifier
      const img = v.imageLinks?.extraLarge || v.imageLinks?.large || v.imageLinks?.medium || v.imageLinks?.thumbnail
      const subjects = (v.categories || []).join(', ')
      return candidate(this, 'book', {
        title: v.title,
        author: v.authors,
        editor: v.publisher,
        release_date: v.publishedDate,
        genre: subjects,
        format: bookFormat(`${subjects} ${v.title}`),
        isbn,
        language: v.language,
        cover: img?.replace('&edge=curl', '').replace('zoom=1', 'zoom=0'),
        description: v.description?.slice(0, 2000),
        ...sagaHints(v.title),
      }, v.infoLink)
    })
  },
}

// ---------------------------------------------------------------- Open Library
const openLibrary: Connector = {
  id: 'openLibrary',
  name: 'Open Library',
  media: ['book'],
  keys: [],
  keysOptional: true,
  docs: 'https://openlibrary.org/developers/api',
  async barcode(code) {
    const data = await fetchJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${code}&format=json&jscmd=data`)
    const b = data?.[`ISBN:${code}`]
    if (!b) return []
    const subjects = (b.subjects || []).map((s: any) => s.name).join(', ')
    return [candidate(this, 'book', {
      title: b.title,
      author: b.authors?.map((a: any) => a.name),
      editor: b.publishers?.[0]?.name,
      release_date: b.publish_date,
      genre: subjects,
      format: bookFormat(subjects),
      isbn: code.length === 13 ? code : undefined,
      barcode: code,
      cover: b.cover?.large || b.cover?.medium,
      ...sagaHints(b.title),
    }, b.url)]
  },
  async search(query, ctx) {
    const params = new URLSearchParams({
      q: query, limit: '5',
      fields: 'key,title,author_name,first_publish_year,publisher,isbn,cover_i,subject,language',
    })
    if (ctx.language && MARC[ctx.language]) params.set('language', MARC[ctx.language])
    const data = await fetchJson(`https://openlibrary.org/search.json?${params}`)
    return take(data?.docs, 5).map((d: any) => {
      const subjects = take(d.subject, 8).join(', ')
      return candidate(this, 'book', {
        title: d.title,
        author: take(d.author_name, 3),
        editor: d.publisher?.[0],
        release_date: d.first_publish_year,
        genre: subjects,
        format: bookFormat(subjects),
        isbn: d.isbn?.find((i: string) => i.length === 13),
        // Open Library lists every edition's language: only a single one says which this is
        language: d.language?.length === 1 ? ISO[d.language[0]] : undefined,
        cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : undefined,
        ...sagaHints(d.title),
      }, `https://openlibrary.org${d.key}`)
    })
  },
}

// ---------------------------------------------------------------- ISBNdb
function isbndbBook(this: Connector, b: any, code?: string) {
  const subjects = (b.subjects || []).join(', ')
  return candidate(this, 'book', {
    title: b.title,
    author: b.authors,
    editor: b.publisher,
    release_date: b.date_published,
    genre: subjects,
    format: bookFormat(`${subjects} ${b.binding || ''}`),
    isbn: b.isbn13,
    language: b.language,
    barcode: code,
    cover: b.image_original || b.image,
    description: b.synopsis?.slice(0, 2000),
    ...sagaHints(b.title),
  }, b.isbn13 ? `https://isbndb.com/book/${b.isbn13}` : undefined)
}

const isbndb: Connector = {
  id: 'isbndb',
  name: 'ISBNdb',
  media: ['book'],
  keys: [{ id: 'isbndb', label: 'API key' }],
  docs: 'https://isbndb.com/apidocs/v2',
  async barcode(code, ctx) {
    const data = await fetchJson(`https://api2.isbndb.com/book/${code}`, { headers: { Authorization: ctx.keys.isbndb } })
    return data?.book ? [isbndbBook.call(this, data.book, code)] : []
  },
  async search(query, ctx) {
    const data = await fetchJson(`https://api2.isbndb.com/books/${encodeURIComponent(query)}?pageSize=5`, {
      headers: { Authorization: ctx.keys.isbndb },
    })
    return take(data?.books, 5).map((b: any) => isbndbBook.call(this, b))
  },
}

// ---------------------------------------------------------------- Comic Vine
const comicVine: Connector = {
  id: 'comicVine',
  name: 'Comic Vine',
  media: ['book'],
  keys: [{ id: 'comicVine', label: 'API key' }],
  docs: 'https://comicvine.gamespot.com/api/',
  languages: ['en'],
  async search(query, ctx) {
    const params = new URLSearchParams({
      api_key: ctx.keys.comicVine, format: 'json', resources: 'volume', query, limit: '5',
      field_list: 'name,publisher,start_year,image,site_detail_url,count_of_issues',
    })
    const data = await fetchJson(`https://comicvine.gamespot.com/api/search/?${params}`)
    return take(data?.results, 5).map((v: any) => candidate(this, 'book', {
      title: v.name,
      saga: v.name,
      editor: v.publisher?.name,
      release_date: v.start_year,
      format: 'comic',
      genre: 'superhero',
      cover: v.image?.original_url || v.image?.medium_url,
    }, v.site_detail_url))
  },
}

// ---------------------------------------------------------------- MangaDex
const mangaDex: Connector = {
  id: 'mangaDex',
  name: 'MangaDex',
  media: ['book'],
  keys: [],
  keysOptional: true,
  docs: 'https://api.mangadex.org/docs/',
  async search(query, ctx: Ctx) {
    const params = new URLSearchParams({ title: query, limit: '4' })
    if (ctx.language) params.append('availableTranslatedLanguage[]', ctx.language)
    params.append('includes[]', 'cover_art')
    params.append('includes[]', 'author')
    const data = await fetchJson(`https://api.mangadex.org/manga?${params}`)
    return take(data?.data, 4).map((m: any) => {
      const a = m.attributes || {}
      const lang = ctx.language || ctx.locale
      const title = a.title?.[lang] || a.title?.en || Object.values(a.title || {})[0]
      const alt = (a.altTitles || []).find((t: any) => t[lang])?.[lang]
      const coverFile = m.relationships?.find((r: any) => r.type === 'cover_art')?.attributes?.fileName
      const tags = (a.tags || []).map((t: any) => t.attributes?.name?.en).filter(Boolean)
      return candidate(this, 'book', {
        title: alt || title,
        author: m.relationships?.filter((r: any) => r.type === 'author').map((r: any) => r.attributes?.name),
        saga: alt || title,
        release_date: a.year,
        format: 'manga',
        genre: [a.publicationDemographic, ...tags].filter(Boolean).join(', '),
        cover: coverFile ? `https://uploads.mangadex.org/covers/${m.id}/${coverFile}` : undefined,
      }, `https://mangadex.org/title/${m.id}`)
    })
  },
}

export default [googleBooks, openLibrary, isbndb, comicVine, mangaDex]
