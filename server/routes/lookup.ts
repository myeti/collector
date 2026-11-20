import { Router } from 'express'
import multer from 'multer'
import { MEDIA_TYPES } from '../../shared/media.js'
import { lookupBarcode, searchAll } from '../connectors/index.ts'
import type { Ctx, MediaType } from '../connectors/index.ts'
import { readSecrets } from '../lib/secrets.ts'
import { llmEnabled, extractFromCover, detectMany } from '../lib/ai.ts'
import { Item, visibleUserIds, Op } from '../db.ts'
import { storeImage, toVisionJpeg } from '../lib/images.ts'
import { badRequest, HttpError } from '../lib/http.ts'
import { throttled } from '../lib/guard.ts'

export const lookupRouter = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

function ctxFor(req: any, rawType: any): Ctx {
  const type = (MEDIA_TYPES.includes(rawType) ? rawType : 'book') as MediaType
  return { keys: readSecrets(req.user).keys, type, locale: req.user.locale || 'en' }
}

lookupRouter.get('/barcode/:code', async (req: any, res) => {
  const code = String(req.params.code).replace(/[^0-9X]/gi, '')
  if (code.length < 8) throw badRequest('invalid_barcode')
  res.json(await lookupBarcode(code, ctxFor(req, req.query.type)))
})

lookupRouter.get('/search', async (req: any, res) => {
  const q = String(req.query.q || '').trim()
  if (q.length < 2) throw badRequest('query_too_short')
  res.json(await searchAll(q, ctxFor(req, req.query.type)))
})

/**
 * Cover photo: always stored as the item cover. When an LLM is configured, it reads the
 * cover, then its findings seed a barcode/title search on the regular connectors.
 */
lookupRouter.post('/cover', upload.single('file'), async (req: any, res) => {
  if (throttled(`upload:${req.user.id}`, 120)) throw new HttpError(429, 'too_many_requests')
  if (!req.file) throw badRequest('file_required')
  const ctx = ctxFor(req, req.body?.type)
  const cover = await storeImage(req.file.buffer, req.user.id)
  const { llm } = readSecrets(req.user)

  const result: any = { type: ctx.type, cover, candidates: [], sources: [], errors: [], llm: llmEnabled(llm) }
  if (!result.llm) return res.json(result)

  try {
    const found = await extractFromCover(llm, await toVisionJpeg(req.file.buffer), ctx.type, ctx.locale)
    if (found) {
      found.fields.cover = cover
      result.candidates.push(found)
      const f = found.fields
      const code = f.isbn || f.barcode
      const more = code && code.length >= 10
        ? await lookupBarcode(code, ctx)
        : await searchAll([f.title, ctx.type === 'book' || ctx.type === 'music' ? f.author : ''].filter(Boolean).join(' '), ctx)
      result.candidates.push(...more.candidates)
      result.sources = more.sources
      result.errors = more.errors
      result.query = more.query || f.title
    }
  } catch (e: any) {
    result.errors.push({ source: 'AI', message: e.message })
  }
  res.json(result)
})

const norm = (s: any) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Shelf / pile photo: the AI lists every visible item. Metadata lookups happen later, item by item, while the
 * user reviews (so the list comes back fast). Items already in the collection are flagged.
 */
lookupRouter.post('/bulk', upload.single('file'), async (req: any, res) => {
  if (throttled(`bulk:${req.user.id}`, 30)) throw new HttpError(429, 'too_many_requests')
  if (!req.file) throw badRequest('file_required')
  const ctx = ctxFor(req, req.body?.type)
  const { llm } = readSecrets(req.user)
  if (!llmEnabled(llm)) throw badRequest('llm_not_configured')

  let detected
  try {
    detected = await detectMany(llm, await toVisionJpeg(req.file.buffer, 2048), ctx.type, ctx.locale)
  } catch (e: any) {
    return res.json({ type: ctx.type, items: [], errors: [{ source: 'AI', message: e.message }] })
  }

  // Owned check on normalised titles (+ volume): cheap and good enough to warn before adding duplicates.
  const ids = await visibleUserIds(req.user)
  const owned: any[] = await Item.findAll({
    where: { user_id: { [Op.in]: ids }, type: ctx.type },
    attributes: ['id', 'title', 'volume', 'saga'],
    raw: true,
  })
  const index = new Map(owned.map((o) => [`${norm(o.title)}|${norm(o.volume)}`, o]))
  const items = detected.map((c, i) => {
    const hit = index.get(`${norm(c.fields.title)}|${norm(c.fields.volume)}`)
    return { id: i, fields: c.fields, sourceName: c.sourceName, owned: hit ? { id: hit.id, title: hit.title } : null }
  })
  res.json({ type: ctx.type, items, errors: [] })
})
