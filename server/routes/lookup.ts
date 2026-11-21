import { Router } from 'express'
import multer from 'multer'
import { MEDIA_TYPES } from '../../shared/media.js'
import { findItem } from '../connectors/index.ts'
import type { Ctx, MediaType } from '../connectors/index.ts'
import { readSecrets } from '../lib/secrets.ts'
import { llmEnabled, detectMany } from '../lib/ai.ts'
import { ownedMatcher } from '../lib/matching.ts'
import { storeImage, toVisionJpeg } from '../lib/images.ts'
import { badRequest, HttpError } from '../lib/http.ts'
import { throttled } from '../lib/guard.ts'

export const lookupRouter = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

function ctxFor(req: any, rawType: any): Ctx {
  const type = (MEDIA_TYPES.includes(rawType) ? rawType : 'book') as MediaType
  return { keys: readSecrets(req.user).keys, type, locale: req.user.locale || 'en' }
}

/**
 * ?code= (barcode, ISBN) and/or ?q= (title, author…): the identifier first, then the text (see findItem).
 * Each result says whether it is already in the family's collection (lists show it before the review).
 */
lookupRouter.get('/', async (req: any, res) => {
  const code = String(req.query.code || '').replace(/[^0-9X]/gi, '')
  const text = String(req.query.q || '').trim().slice(0, 300)
  if (code.length < 8 && text.length < 2) throw badRequest('query_too_short')
  const ctx = ctxFor(req, req.query.type)
  const result: any = await findItem({ code: code.length >= 8 ? code : undefined, text: text || undefined }, ctx)
  const owned = await ownedMatcher(req.user, result.type)
  for (const c of result.candidates) c.owned = owned(c.fields)
  res.json(result)
})

/**
 * Photo of one cover or of a whole shelf: the AI lists every item it can read. Metadata lookups happen later,
 * item by item, while the user reviews (so the list comes back fast). Items already in the collection are flagged.
 * A single item: the photo is kept, to be offered as its cover.
 */
lookupRouter.post('/photo', upload.single('file'), async (req: any, res) => {
  if (throttled(`photo:${req.user.id}`, 60)) throw new HttpError(429, 'too_many_requests')
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

  const owned = await ownedMatcher(req.user, ctx.type)
  const items = detected.map((c, i) => ({ id: i, fields: c.fields, sourceName: c.sourceName, owned: owned(c.fields) }))
  const cover = items.length === 1 ? await storeImage(req.file.buffer, req.user.id) : null
  res.json({ type: ctx.type, items, cover, errors: [] })
})
