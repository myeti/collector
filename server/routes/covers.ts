import { Router } from 'express'
import { Item, Op } from '../db.ts'
import { MEDIA_TYPES } from '../../shared/media.js'
import { findCover } from '../lib/covers.ts'
import { readSecrets } from '../lib/secrets.ts'
import { badRequest, HttpError } from '../lib/http.ts'
import { throttled } from '../lib/guard.ts'

// Covers for items saved without one. The app sends small batches and shows the progress, so a long run
// (a whole imported library) never holds a request open for minutes.
export const coversRouter = Router()
const BATCH = 8

/** The user's own items without a cover, by media type (only the owner can change an item). */
coversRouter.get('/missing', async (req: any, res) => {
  const rows: any[] = await Item.findAll({
    where: { user_id: req.user.id, cover: null },
    attributes: ['id', 'type'],
    order: [['created_at', 'DESC']],
    raw: true,
  })
  const types: Record<string, string[]> = Object.fromEntries(MEDIA_TYPES.map((t) => [t, []]))
  for (const r of rows) types[r.type].push(r.id)
  res.json({ types })
})

coversRouter.post('/fill', async (req: any, res) => {
  const ids = req.body?.ids
  if (!Array.isArray(ids) || !ids.length || ids.length > BATCH || !ids.every((id) => typeof id === 'string')) throw badRequest('invalid_ids')
  if (throttled(`covers:${req.user.id}`, 400)) throw new HttpError(429, 'too_many_requests')

  const items: any[] = await Item.findAll({ where: { id: { [Op.in]: ids }, user_id: req.user.id, cover: null } })
  const { keys } = readSecrets(req.user)
  const locale = req.user.locale || 'en'
  // Two at a time: sources such as MusicBrainz refuse bursts.
  const results: { id: string; cover: string | null }[] = []
  for (let i = 0; i < items.length; i += 2) {
    await Promise.all(items.slice(i, i + 2).map(async (item) => {
      const cover = await findCover(item, { keys, type: item.type, locale }).catch(() => null)
      if (cover) await item.update({ cover })
      results.push({ id: item.id, cover })
    }))
  }
  res.json({ results })
})
