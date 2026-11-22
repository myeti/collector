import { Router } from 'express'
import { Op } from 'sequelize'
import { Item, User, sequelize, visibleUserIds, hasUnaccent } from '../db.ts'
import { MEDIA_TYPES, CONDITIONS, fieldsFor, allowedValue, defaultFormat } from '../../shared/media.js'
import { badRequest, forbidden, notFound } from '../lib/http.ts'
import { importRemoteImage, deleteImage, ownsUpload } from '../lib/images.ts'
import { serializeItem } from './serializers.ts'
import { ownedMatcher } from '../lib/matching.ts'

export const itemsRouter = Router()

const SORTS: Record<string, [string, string][]> = {
  recent: [['created_at', 'DESC']],
  title: [['title', 'ASC']],
  author: [['author', 'ASC NULLS LAST'], ['title', 'ASC']],
  release: [['release_date', 'DESC NULLS LAST'], ['title', 'ASC']],
  saga: [['saga', 'ASC NULLS LAST'], [sequelize.literal(`NULLIF(regexp_replace(volume, '\\D', '', 'g'), '')::int`) as any, 'ASC NULLS LAST'], ['title', 'ASC']],
}

const SEARCHABLE = ['title', 'author', 'editor', 'saga', 'barcode', 'isbn', 'genre', 'category', 'format', 'comment']

/** Keeps only the fields that belong to the item's media type, with light validation. */
export function sanitize(body: any, type: string) {
  const out: Record<string, any> = {}
  for (const f of fieldsFor(type)) {
    if (!(f in body)) continue
    let v = body[f]
    if (f === 'consumed' || f === 'digitalized') { out[f] = !!v; continue }
    if (v === '' || v === undefined) v = null
    if (v !== null) v = String(v).trim()
    if (f === 'condition' && v && !CONDITIONS.includes(v)) throw badRequest('invalid_condition')
    if (f === 'format' && !allowedValue(type, 'format', v)) throw badRequest('invalid_format')
    if (f === 'format' && !v) v = defaultFormat(type) // required: cannot be emptied
    if ((f === 'barcode' || f === 'isbn') && v) v = v.replace(/[^0-9X]/gi, '').toUpperCase() || null
    if (f === 'release_date' && v && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(v)) throw badRequest('invalid_release_date')
    // Covers are our own uploads or web images (downloaded on save): nothing else ends up in <img src>.
    if (f === 'cover' && v && !/^\/uploads\/[\w-]+\.webp$/.test(v) && !/^https?:\/\/[^\s]+$/i.test(v)) throw badRequest('invalid_cover')
    out[f] = v
  }
  if (body.extra && typeof body.extra === 'object' && !Array.isArray(body.extra)) out.extra = body.extra
  return out
}

/** Whose items a shelf shows: one family member (?owner=), or everyone visible to the user. */
async function shelfOwners(req: any) {
  const ids = await visibleUserIds(req.user)
  const owner = String(req.query.owner || '')
  return owner && ids.includes(owner) ? [owner] : ids
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
  const { type, q, category, genre, consumed, digitalized, format, condition, sort = 'title' } = req.query
  const limit = Math.min(Number(req.query.limit) || 60, 200)
  const offset = Math.max(Number(req.query.offset) || 0, 0)
  const where: any = { user_id: { [Op.in]: await shelfOwners(req) } }
  if (type && MEDIA_TYPES.includes(type)) where.type = type
  if (category) where.category = category
  if (genre) where.genre = genre
  if (format) where.format = format
  if (condition) where.condition = condition
  if (consumed === 'true' || consumed === 'false') where.consumed = consumed === 'true'
  if (digitalized === 'true' || digitalized === 'false') where.digitalized = digitalized === 'true'
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
    order: SORTS[sort] || SORTS.title,
    limit,
    offset,
  })
  res.json({ items: rows.map((i) => serializeItem(i, req.user)), total: count, limit, offset })
})

itemsRouter.get('/stats', async (req: any, res) => {
  const rows: any[] = await Item.findAll({
    where: { user_id: { [Op.in]: await shelfOwners(req) } },
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
  const ids = await shelfOwners(req)
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

/**
 * Is this item already in the family's collection? Strict (same barcode / ISBN) or wide (same title and author).
 * Asked live while an item is being added or edited; exclude: the item being edited.
 */
itemsRouter.post('/duplicates', async (req: any, res) => {
  const type = req.body?.type
  if (!MEDIA_TYPES.includes(type)) throw badRequest('invalid_type')
  const fields = req.body?.fields && typeof req.body.fields === 'object' ? req.body.fields : {}
  const exclude = typeof req.body?.exclude === 'string' && /^[0-9a-f-]{36}$/i.test(req.body.exclude) ? req.body.exclude : undefined
  const match = await ownedMatcher(req.user, type, { exclude })
  res.json({ duplicate: match(fields) })
})

/** Distinct values already used, to power autocompletion (sagas, authors, labels…). */
itemsRouter.get('/suggestions', async (req: any, res) => {
  const field = String(req.query.field || '')
  const allowed = ['author', 'editor', 'saga', 'genre', 'category', 'format']
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
  data.format ||= defaultFormat(type) // required where the type has a list
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
