import { Router } from 'express'
import { Op } from 'sequelize'
import { Item, User, sequelize, visibleUserIds, hasUnaccent } from '../db.ts'
import { MEDIA, MEDIA_TYPES, CONDITIONS, fieldsFor } from '../../shared/media.js'
import { badRequest, forbidden, notFound } from '../lib/http.ts'
import { importRemoteImage, deleteImage, ownsUpload } from '../lib/images.ts'
import { serializeItem } from './serializers.ts'

export const itemsRouter = Router()

const SORTS: Record<string, [string, string][]> = {
  recent: [['created_at', 'DESC']],
  title: [['title', 'ASC']],
  author: [['author', 'ASC NULLS LAST'], ['title', 'ASC']],
  release: [['release_date', 'DESC NULLS LAST'], ['title', 'ASC']],
  saga: [['saga', 'ASC NULLS LAST'], [sequelize.literal(`NULLIF(regexp_replace(volume, '\\D', '', 'g'), '')::int`) as any, 'ASC NULLS LAST'], ['title', 'ASC']],
}

const SEARCHABLE = ['title', 'original_title', 'author', 'saga', 'editor', 'label', 'director', 'barcode', 'isbn', 'genre', 'category', 'comment']

/** Keeps only the fields that belong to the item's media type, with light validation. */
function sanitize(body: any, type: string) {
  const out: Record<string, any> = {}
  for (const f of fieldsFor(type)) {
    if (!(f in body)) continue
    let v = body[f]
    if (f === 'consumed') { out.consumed = !!v; continue }
    if (v === '' || v === undefined) v = null
    if (v !== null) v = String(v).trim()
    if (f === 'condition' && v && !CONDITIONS.includes(v)) throw badRequest('invalid_condition')
    if (f === 'format' && v && !MEDIA[type].formats.includes(v)) throw badRequest('invalid_format')
    if ((f === 'barcode' || f === 'isbn') && v) v = v.replace(/[^0-9X]/gi, '').toUpperCase() || null
    if (f === 'release_date' && v && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(v)) throw badRequest('invalid_release_date')
    // Covers are our own uploads or web images (downloaded on save): nothing else ends up in <img src>.
    if (f === 'cover' && v && !/^\/uploads\/[\w-]+\.webp$/.test(v) && !/^https?:\/\/[^\s]+$/i.test(v)) throw badRequest('invalid_cover')
    out[f] = v
  }
  if (body.extra && typeof body.extra === 'object' && !Array.isArray(body.extra)) out.extra = body.extra
  return out
}

async function findVisible(req: any) {
  const ids = await visibleUserIds(req.user)
  const item: any = await Item.findOne({
    where: { id: req.params.id, user_id: { [Op.in]: ids } },
    include: [{ model: User, as: 'owner' }],
  })
  if (!item) throw notFound()
  return item
}

async function prepareCover(data: any, user: any, current: string | null = null) {
  if (!data.cover) return
  if (data.cover.startsWith('/uploads/')) {
    // Only the user's own files (or the cover the item already has): no pointing at, then deleting, others' files.
    if (data.cover !== current && !ownsUpload(data.cover, user.id)) throw badRequest('invalid_cover')
    return
  }
  // Not downloadable (offline source, refused address…): keep a public https link to show as is, else nothing.
  data.cover = (await importRemoteImage(data.cover, user.id)) || (/^https:\/\//i.test(data.cover) ? data.cover : null)
}

/** Removes a replaced/deleted cover file unless another item still shows it. */
async function releaseCover(cover: string | null, ownerId: string) {
  if (!cover?.startsWith('/uploads/')) return
  if (await Item.count({ where: { cover } })) return
  await deleteImage(cover, ownerId)
}

itemsRouter.get('/', async (req: any, res) => {
  const { type, q, category, genre, consumed, owner, format, condition, sort = 'recent' } = req.query
  const limit = Math.min(Number(req.query.limit) || 60, 200)
  const offset = Math.max(Number(req.query.offset) || 0, 0)
  const ids = await visibleUserIds(req.user)

  const where: any = { user_id: { [Op.in]: owner && ids.includes(owner) ? [owner] : ids } }
  if (type && MEDIA_TYPES.includes(type)) where.type = type
  if (category) where.category = category
  if (genre) where.genre = genre
  if (format) where.format = format
  if (condition) where.condition = condition
  if (consumed === 'true' || consumed === 'false') where.consumed = consumed === 'true'
  if (q && String(q).trim()) {
    // Every word must match at least one searchable column: "potter 3" finds volume 3.
    where[Op.and] = String(q).trim().split(/\s+/).slice(0, 6).map((word) => {
      const pattern = `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
      const match = (f: string) => hasUnaccent
        ? sequelize.where(sequelize.fn('unaccent', sequelize.col(`item.${f}`)), Op.iLike, sequelize.fn('unaccent', pattern))
        : { [f]: { [Op.iLike]: pattern } }
      return { [Op.or]: [...SEARCHABLE.map(match), { volume: word }] }
    })
  }

  const { rows, count } = await Item.findAndCountAll({
    where,
    include: [{ model: User, as: 'owner' }],
    order: SORTS[sort] || SORTS.recent,
    limit,
    offset,
  })
  res.json({ items: rows.map((i) => serializeItem(i, req.user)), total: count, limit, offset })
})

itemsRouter.get('/stats', async (req: any, res) => {
  const ids = await visibleUserIds(req.user)
  const rows: any[] = await Item.findAll({
    where: { user_id: { [Op.in]: ids } },
    attributes: ['type', [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.literal('CASE WHEN consumed THEN 1 ELSE 0 END')), 'consumed']],
    group: ['type'],
    raw: true,
  })
  const stats: Record<string, { count: number; consumed: number }> = {}
  for (const t of MEDIA_TYPES) stats[t] = { count: 0, consumed: 0 }
  for (const r of rows) stats[r.type] = { count: Number(r.count), consumed: Number(r.consumed) }
  res.json({ stats })
})

/** Value counts for the quick filter bar: { category: [{ value, count }], format: [...] }. */
itemsRouter.get('/facets', async (req: any, res) => {
  const type = String(req.query.type || '')
  if (!MEDIA_TYPES.includes(type)) throw badRequest('invalid_type')
  const ids = await visibleUserIds(req.user)
  const facets: Record<string, { value: string; count: number }[]> = {}
  for (const field of ['category', 'format']) {
    const rows: any[] = await Item.findAll({
      where: { user_id: { [Op.in]: ids }, type, [field]: { [Op.ne]: null } },
      attributes: [[sequelize.col(field), 'value'], [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: [field],
      raw: true,
    })
    facets[field] = rows.map((r) => ({ value: r.value, count: Number(r.count) })).sort((a, b) => b.count - a.count)
  }
  res.json({ facets })
})

/** Duplicate detection while scanning. */
itemsRouter.get('/by-barcode/:code', async (req: any, res) => {
  const code = String(req.params.code).replace(/[^0-9X]/gi, '').toUpperCase()
  const ids = await visibleUserIds(req.user)
  const items = await Item.findAll({
    where: { user_id: { [Op.in]: ids }, [Op.or]: [{ barcode: code }, { isbn: code }] },
    include: [{ model: User, as: 'owner' }],
  })
  res.json({ items: items.map((i) => serializeItem(i, req.user)) })
})

/** Distinct values already used, to power autocompletion (sagas, authors, labels…). */
itemsRouter.get('/suggestions', async (req: any, res) => {
  const field = String(req.query.field || '')
  const allowed = ['author', 'saga', 'editor', 'label', 'director', 'genre', 'category']
  if (!allowed.includes(field)) throw badRequest('invalid_field')
  const ids = await visibleUserIds(req.user)
  const where: any = { user_id: { [Op.in]: ids }, [field]: { [Op.ne]: null } }
  if (req.query.type) where.type = req.query.type
  const rows: any[] = await Item.findAll({
    where, attributes: [[sequelize.fn('DISTINCT', sequelize.col(field)), 'value']], raw: true, limit: 500,
  })
  res.json({ values: rows.map((r) => r.value).sort((a, b) => a.localeCompare(b)) })
})

itemsRouter.get('/:id', async (req: any, res) => {
  res.json({ item: serializeItem(await findVisible(req), req.user) })
})

itemsRouter.post('/', async (req: any, res) => {
  const type = req.body?.type
  if (!MEDIA_TYPES.includes(type)) throw badRequest('invalid_type')
  const data = sanitize(req.body, type)
  if (!data.title) throw badRequest('title_required')
  await prepareCover(data, req.user)
  const item: any = await Item.create({ ...data, type, user_id: req.user.id })
  item.owner = req.user
  res.status(201).json({ item: serializeItem(item, req.user) })
})

itemsRouter.put('/:id', async (req: any, res) => {
  const item = await findVisible(req)
  if (item.user_id !== req.user.id) throw forbidden('not_owner')
  const type = MEDIA_TYPES.includes(req.body?.type) ? req.body.type : item.type
  const data = sanitize(req.body, type)
  if ('title' in data && !data.title) throw badRequest('title_required')
  await prepareCover(data, req.user, item.cover)
  const previousCover = item.cover
  await item.update({ ...data, type })
  if ('cover' in data && previousCover !== item.cover) await releaseCover(previousCover, req.user.id)
  res.json({ item: serializeItem(item, req.user) })
})

itemsRouter.patch('/:id/consumed', async (req: any, res) => {
  const item = await findVisible(req)
  if (item.user_id !== req.user.id) throw forbidden('not_owner')
  await item.update({ consumed: !!req.body?.consumed })
  res.json({ item: serializeItem(item, req.user) })
})

itemsRouter.delete('/:id', async (req: any, res) => {
  const item = await findVisible(req)
  if (item.user_id !== req.user.id) throw forbidden('not_owner')
  await item.destroy()
  await releaseCover(item.cover, req.user.id)
  res.json({ ok: true })
})
