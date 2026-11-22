import { Router } from 'express'
import multer from 'multer'
import { Item, sequelize } from '../db.ts'
import { MEDIA_TYPES, defaultFormat } from '../../shared/media.js'
import { IMPORTERS, readExport } from '../importers/index.ts'
import { ownedMatcher, norm } from '../lib/matching.ts'
import { badRequest, HttpError } from '../lib/http.ts'
import { throttled } from '../lib/guard.ts'
import { sanitize } from './items.ts'

export const importRouter = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })
const MAX_ITEMS = 10000

importRouter.get('/sources', (_req, res) => {
  res.json({ sources: IMPORTERS.map(({ id, name, type, url }) => ({ id, name, type, url })) })
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
