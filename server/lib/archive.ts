// Collector's own export: a .zip holding collector.json (the items) and, optionally, covers/<n>.webp.
// Imports never trust the archive: the JSON is validated like any save, entries are size-capped and read
// by exact name (never written to disk under their own name), and every cover is decoded and re-encoded.
import fs from 'node:fs'
import path from 'node:path'
import yauzl from 'yauzl'
import yazl from 'yazl'
import { config } from '../config.ts'
import { MEDIA_TYPES, fieldsFor } from '../../shared/media.js'
import { ownsUpload } from './images.ts'
import { badRequest } from './http.ts'

export const ARCHIVE_FORMAT = 'collector-export'
export const ARCHIVE_VERSION = 1
const JSON_NAME = 'collector.json'
const COVER_NAME = /^covers\/\d{1,6}\.webp$/

// Caps on what an archive may declare (yauzl also checks that each entry inflates to its declared size).
const MAX_ENTRIES = 25_000
const MAX_JSON_BYTES = 64 * 1024 * 1024
const MAX_COVER_BYTES = 20 * 1024 * 1024
const MAX_EXTRA_BYTES = 16 * 1024

export interface ArchiveItem {
  type: string
  fields: Record<string, any>
  /** Entry name of its cover in the archive, or a web link kept as is */
  cover: string | null
}

/** Streams the user's own items (and their uploaded covers when asked) as a zip. */
export function exportArchive(items: any[], { covers, version }: { covers: boolean; version: string }) {
  const zip = new yazl.ZipFile()
  const out: any[] = []
  for (const item of items) {
    const json = item.toJSON()
    const entry: Record<string, any> = { type: json.type }
    for (const f of fieldsFor(json.type)) {
      if (f === 'cover') continue
      if (json[f] !== null && json[f] !== undefined && json[f] !== '' && !(Array.isArray(json[f]) && !json[f].length)) entry[f] = json[f]
    }
    if (json.extra && Object.keys(json.extra).length) entry.extra = json.extra
    if (/^https:\/\//i.test(json.cover || '')) entry.cover = json.cover
    else if (covers && ownsUpload(json.cover, json.user_id)) {
      const file = path.join(config.uploadDir, path.basename(json.cover))
      if (fs.existsSync(file)) {
        entry.cover = `covers/${out.length}.webp`
        zip.addFile(file, entry.cover, { compress: false }) // webp is compressed already
      }
    }
    entry.added_at = json.created_at
    out.push(entry)
  }
  const data = { format: ARCHIVE_FORMAT, version: ARCHIVE_VERSION, app: version, exported_at: new Date().toISOString(), items: out }
  zip.addBuffer(Buffer.from(JSON.stringify(data, null, 1)), JSON_NAME)
  zip.end()
  return zip.outputStream
}

/** An archive on disk: its items (unless `items: false`), and its covers read on demand. Close it when done. */
export async function openArchive(file: string, { items: withItems = true } = {}) {
  let zip: yauzl.ZipFile
  try {
    zip = await yauzl.openPromise(file, { lazyEntries: true, autoClose: false, validateEntrySizes: true, strictFileNames: true })
  } catch {
    throw badRequest('import_invalid_archive')
  }
  try {
    if (zip.entryCount > MAX_ENTRIES) throw badRequest('import_too_large')
    const entries = new Map<string, yauzl.Entry>()
    await new Promise<void>((resolve, reject) => {
      zip.on('entry', (entry: yauzl.Entry) => {
        // Only the two kinds of files Collector writes; anything else is ignored
        if (entry.fileName === JSON_NAME || COVER_NAME.test(entry.fileName)) entries.set(entry.fileName, entry)
        zip.readEntry()
      })
      zip.on('end', resolve)
      zip.on('error', reject)
      zip.readEntry()
    }).catch((e) => { throw e?.status ? e : badRequest('import_invalid_archive') })

    const read = async (entry: yauzl.Entry, max: number) => {
      if (entry.uncompressedSize > max || entry.isEncrypted()) throw badRequest('import_invalid_archive')
      const stream = await new Promise<NodeJS.ReadableStream>((resolve, reject) =>
        zip.openReadStream(entry, (err, s) => (err ? reject(err) : resolve(s!))))
      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of stream as AsyncIterable<Buffer>) {
        size += chunk.length
        if (size > max) throw badRequest('import_invalid_archive')
        chunks.push(chunk)
      }
      return Buffer.concat(chunks)
    }

    const cover = (name: string) => {
      const entry = COVER_NAME.test(name) ? entries.get(name) : undefined
      return entry ? read(entry, MAX_COVER_BYTES) : Promise.resolve(null)
    }
    const close = () => zip.close()
    if (!withItems) return { items: [] as (ArchiveItem | null)[], app: null, cover, close }

    const json = entries.get(JSON_NAME)
    if (!json) throw badRequest('import_unrecognized')
    let data: any
    try {
      data = JSON.parse((await read(json, MAX_JSON_BYTES)).toString('utf8'))
    } catch (e: any) {
      throw e?.status ? e : badRequest('import_invalid_archive')
    }
    if (data?.format !== ARCHIVE_FORMAT || !Array.isArray(data.items)) throw badRequest('import_unrecognized')
    if (!(Number(data.version) >= 1)) throw badRequest('import_unrecognized')
    if (data.version > ARCHIVE_VERSION) throw badRequest('import_newer_version')

    const items: (ArchiveItem | null)[] = data.items.map((raw: any) => {
      if (!raw || typeof raw !== 'object' || !MEDIA_TYPES.includes(raw.type)) return null
      const fields: Record<string, any> = {}
      for (const f of fieldsFor(raw.type)) if (f !== 'cover' && raw[f] !== undefined && raw[f] !== null) fields[f] = raw[f]
      if (raw.extra && typeof raw.extra === 'object' && !Array.isArray(raw.extra) && JSON.stringify(raw.extra).length <= MAX_EXTRA_BYTES) fields.extra = raw.extra
      const cover = typeof raw.cover === 'string' && (entries.has(raw.cover) && COVER_NAME.test(raw.cover) || /^https:\/\/[^\s]+$/i.test(raw.cover)) ? raw.cover : null
      return { type: raw.type, fields, cover }
    })

    return {
      items,
      app: typeof data.app === 'string' ? data.app.slice(0, 20) : null,
      /** The bytes of a cover entry (still to be checked: see storeImage) */
      cover,
      close,
    }
  } catch (e) {
    zip.close()
    throw e
  }
}
