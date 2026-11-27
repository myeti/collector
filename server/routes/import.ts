import { Router } from 'express'
import multer from 'multer'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Item, Op, sequelize } from '../db.ts'
import { MEDIA_TYPES, defaultFormat } from '../../shared/media.js'
import { IMPORTERS, readExport } from '../importers/index.ts'
import { ownedMatcher, norm } from '../lib/matching.ts'
import { openArchive } from '../lib/archive.ts'
import { storeImage, deleteImage } from '../lib/images.ts'
import { badRequest, HttpError } from '../lib/http.ts'
import { throttled } from '../lib/guard.ts'
import { sanitize, canonicalTags } from './items.ts'

export const importRouter = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })
const MAX_ITEMS = 10000

importRouter.get('/sources', (_req, res) => {
  // Collector's own archive first (every media type, covers included), then the CSV services
  const collector = { id: 'collector', name: 'Collector', type: null, url: null }
  res.json({ sources: [collector, ...IMPORTERS.map(({ id, name, type, url }) => ({ id, name, type, url }))] })
})

/**
 * Reads an export file and says what an import would do: the rows to add, those already in the family's
 * collection or repeated in the file (a second copy? left unticked by the app) and those left out
 * (to read, wishlist, not owned).
 * Nothing is saved here.
 */
importRouter.post('/preview', upload.single('file'), async (req: any, res) => {
  if (throttled(`import:${req.user.id}`, 60)) throw new HttpError(429, 'too_many_requests')
  if (!req.file) throw badRequest('file_required')
  const filename = String(req.file.originalname || '')
  const found = readExport(req.file.buffer.toString('utf8'), filename, req.body?.source || undefined)
  if (!found) throw badRequest('import_unrecognized')
  const { importer, rows } = found
  if (rows.length > MAX_ITEMS) throw badRequest('import_too_large')

  const owned = await ownedMatcher(req.user, importer.type)
  const seen = new Set<string>()
  const items: any[] = []
  const excluded: { title: string; reason: string }[] = []
  for (const row of rows) {
    // Only what the item has: no empty strings, no "false" flags
    const fields = Object.fromEntries(Object.entries(row.fields).filter(([, v]) => v !== undefined && v !== null && v !== ''))
    const title = fields.title || ''
    const reason = row.excluded || (!title ? 'untitled' : null)
    if (reason) {
      excluded.push({ title, reason })
      continue
    }
    const key = [title, fields.volume, fields.author, importer.type === 'videogame' ? fields.format : ''].map(norm).join('|')
    // Format is required: games on several platforms get the first one listed (the preview lets the user change it),
    // anything else the type's default, so the preview shows what will be saved
    if (row.choices?.length && !fields.format) fields.format = row.choices[0]
    fields.format ||= defaultFormat(importer.type) || undefined
    items.push({
      id: items.length,
      fields,
      duplicate: owned(fields),
      repeated: seen.has(key) || undefined,
      choices: row.choices?.length ? row.choices : undefined,
    })
    seen.add(key)
  }
  res.json({ source: importer.id, name: importer.name, type: importer.type, items, excluded })
})

/** Saves the rows ticked in the preview, all at once. Rows that do not validate are skipped and counted. */
importRouter.post('/commit', async (req: any, res) => {
  const type = req.body?.type
  const list = req.body?.items
  if (!MEDIA_TYPES.includes(type)) throw badRequest('invalid_type')
  if (!Array.isArray(list) || !list.length) throw badRequest('nothing_to_import')
  if (list.length > MAX_ITEMS) throw badRequest('import_too_large')

  const valid: any[] = []
  let skipped = 0
  for (const fields of list) {
    try {
      const data = sanitize(fields && typeof fields === 'object' ? fields : {}, type)
      if (!data.title) throw badRequest('title_required')
      delete data.cover // imports carry no covers ("Improve from sources" fetches them)
      data.format ||= defaultFormat(type)
      delete data.extra
      valid.push({ ...data, type, user_id: req.user.id })
    } catch {
      skipped++
    }
  }
  const ids: string[] = []
  await sequelize.transaction(async (transaction: any) => {
    for (let i = 0; i < valid.length; i += 500) {
      const created = await Item.bulkCreate(valid.slice(i, i + 500), { transaction })
      ids.push(...created.map((item: any) => item.id))
    }
  })
  // ids: what "Find the covers" works on next
  res.status(201).json({ created: ids.length, skipped, ids })
})

// --- Collector archives (.zip from Settings → Import & export → Export)
// The archive is uploaded once: kept in a temporary file between the preview, the import and the copy of its
// covers (in small batches driven by the app, like "Find the covers"), then deleted.

const TMP = path.join(os.tmpdir(), 'collector-import')
const ARCHIVE_TTL = 60 * 60_000
const COVER_BATCH = 12
const archiveUpload = multer({
  storage: multer.diskStorage({ destination: (_req, _file, cb) => { fs.mkdirSync(TMP, { recursive: true }); cb(null, TMP) }, filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.zip`) }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 1 },
})
const archives = new Map<string, { userId: string; file: string; expires: number }>()

function dropArchive(token: string) {
  const a = archives.get(token)
  archives.delete(token)
  if (a) fs.rm(a.file, { force: true }, () => {})
}
/** The user's pending archive, kept alive while in use */
function pendingArchive(req: any, token: unknown) {
  const a = typeof token === 'string' ? archives.get(token) : undefined
  if (!a || a.userId !== req.user.id || a.expires < Date.now()) throw badRequest('import_expired')
  a.expires = Date.now() + ARCHIVE_TTL
  return a
}
// Expired archives, and files left by a restart
setInterval(() => {
  for (const [token, a] of archives) if (a.expires < Date.now()) dropArchive(token)
}, 10 * 60_000).unref()
fs.rm(TMP, { recursive: true, force: true }, () => {})

// Throttled before the upload is accepted
const throttleImport = (req: any, _res: any, next: any) => {
  if (throttled(`import:${req.user.id}`, 60)) throw new HttpError(429, 'too_many_requests')
  next()
}

importRouter.post('/collector/preview', throttleImport, archiveUpload.single('file'), async (req: any, res) => {
  if (!req.file) throw badRequest('file_required')
  const token = crypto.randomUUID()
  archives.set(token, { userId: req.user.id, file: req.file.path, expires: Date.now() + ARCHIVE_TTL })
  try {
    const archive = await openArchive(req.file.path)
    archive.close()
    if (archive.items.length > MAX_ITEMS) throw badRequest('import_too_large')

    const matchers = new Map<string, Awaited<ReturnType<typeof ownedMatcher>>>()
    const seen = new Set<string>()
    const items: any[] = []
    const excluded: { title: string; reason: string }[] = []
    for (const [index, entry] of archive.items.entries()) {
      let fields: any
      try {
        if (!entry) throw badRequest('invalid_item')
        fields = sanitize(entry.fields, entry.type)
        if (!fields.title) throw badRequest('title_required')
      } catch {
        excluded.push({ title: String(entry?.fields?.title || '').slice(0, 200), reason: 'invalid' })
        continue
      }
      const type = entry.type
      if (!matchers.has(type)) matchers.set(type, await ownedMatcher(req.user, type))
      const shown = Object.fromEntries(Object.entries(fields).filter(([k, v]) => k !== 'extra' && v !== null && v !== '' && v !== false))
      const key = [type, fields.title, fields.volume, fields.author, fields.format].map(norm).join('|')
      items.push({
        id: index,
        type,
        fields: shown,
        cover: !!entry.cover,
        duplicate: matchers.get(type)!(fields),
        repeated: seen.has(key) || undefined,
      })
      seen.add(key)
    }
    res.json({ source: 'collector', name: 'Collector', type: null, token, items, excluded, app: archive.app })
  } catch (e) {
    dropArchive(token)
    throw e
  }
})

/** Cancelled preview: the archive is deleted right away. */
importRouter.post('/collector/discard', (req: any, res) => {
  const a = typeof req.body?.token === 'string' ? archives.get(req.body.token) : undefined
  if (a?.userId === req.user.id) dropArchive(req.body.token)
  res.json({ ok: true })
})

/**
 * Creates the ticked items of an archive (body: { token, items: [{ id, fields }] }, id = its place in the
 * archive). Their type and cover come from the archive, the fields from the preview (a platform may have
 * changed). Covers are copied afterwards: the answer lists the items that have one waiting.
 */
importRouter.post('/collector/commit', async (req: any, res) => {
  const pending = pendingArchive(req, req.body?.token)
  const list = req.body?.items
  if (!Array.isArray(list) || !list.length) throw badRequest('nothing_to_import')
  if (list.length > MAX_ITEMS) throw badRequest('import_too_large')
  const archive = await openArchive(pending.file)
  archive.close()

  const valid: any[] = []
  const covers: (string | null)[] = []
  let skipped = 0
  for (const row of list) {
    const entry = Number.isInteger(row?.id) ? archive.items[row.id] : null
    try {
      if (!entry) throw badRequest('invalid_item')
      const data = sanitize({ ...entry.fields, ...(row.fields && typeof row.fields === 'object' ? row.fields : {}), extra: entry.fields.extra }, entry.type)
      if (!data.title) throw badRequest('title_required')
      data.format ||= defaultFormat(entry.type)
      // A web link is kept as it was; a file in the archive is copied next
      data.cover = entry.cover?.startsWith('https://') ? entry.cover : null
      valid.push({ ...data, type: entry.type, user_id: req.user.id })
      covers.push(entry.cover?.startsWith('covers/') ? entry.cover : null)
    } catch {
      skipped++
    }
  }
  await canonicalTags(valid, req.user)
  const created: any[] = []
  await sequelize.transaction(async (transaction: any) => {
    for (let i = 0; i < valid.length; i += 500) created.push(...await Item.bulkCreate(valid.slice(i, i + 500), { transaction }))
  })
  const withCover = created.map((item, i) => (covers[i] ? { id: item.id, cover: covers[i] } : null)).filter(Boolean)
  if (!withCover.length) dropArchive(req.body.token)
  res.status(201).json({
    created: created.length,
    skipped,
    types: [...new Set(created.map((i) => i.type))],
    // Covers to copy from the archive (/collector/covers), then the items still without one ("Find the covers")
    covers: withCover,
    ids: created.filter((item, i) => !covers[i] && !item.cover).map((item) => item.id),
  })
})

/**
 * Copies a few covers from the archive (body: { token, items: [{ id, cover }], last }). Each one is decoded and
 * re-encoded (storeImage): a file that is not a picture is dropped, never stored. `last` deletes the archive.
 */
importRouter.post('/collector/covers', async (req: any, res) => {
  const pending = pendingArchive(req, req.body?.token)
  const list = req.body?.items
  if (!Array.isArray(list) || list.length > COVER_BATCH) throw badRequest('invalid_ids')
  const ids = list.map((r: any) => r?.id).filter((id: any) => typeof id === 'string')
  const items: any[] = ids.length ? await Item.findAll({ where: { id: { [Op.in]: ids }, user_id: req.user.id, cover: null } }) : []
  const byId = new Map(items.map((i) => [i.id, i]))
  const results: { id: string; cover: string | null }[] = []
  const archive = await openArchive(pending.file, { items: false })
  try {
    for (const row of list) {
      const item = byId.get(row?.id)
      if (!item || typeof row.cover !== 'string') continue
      let cover: string | null = null
      try {
        const bytes = await archive.cover(row.cover)
        if (bytes) cover = await storeImage(bytes, req.user.id)
      } catch {
        cover = null // not a picture (or a broken one): left out
      }
      if (cover) await item.update({ cover }).catch(async () => { await deleteImage(cover, req.user.id); cover = null })
      results.push({ id: row.id, cover })
    }
  } finally {
    archive.close()
  }
  if (req.body?.last) dropArchive(req.body.token)
  res.json({ results })
})
