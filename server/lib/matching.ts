// Is it the same item? Used by the duplicate check (adding, editing, importing) and the cover finder.
import { Item, visibleUserIds, Op } from '../db.ts'
import { norm } from '../../shared/text.js'

export { norm }

const code = (s: any) => String(s ?? '').replace(/[^0-9X]/gi, '').toUpperCase()

/**
 * Same work, loosely: equal titles, or one is the other plus an edition note ("Discovery (Remastered)").
 * For picking a cover among search results. The duplicate check is stricter: equal titles only.
 */
export function similarTitle(a: any, b: any) {
  const x = norm(a)
  const y = norm(b)
  return !!x && !!y && (x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `))
}

/** Same creator, as far as we can tell: a shared name ("Goscinny" ~ "René Goscinny, Albert Uderzo"); unknown is no objection. */
export function sameAuthor(a: any, b: any) {
  const words = (s: any) => norm(s).split(' ').filter((w) => w.length > 2)
  const wa = words(a)
  const wb = new Set(words(b))
  return !wa.length || !wb.size || wa.some((w) => wb.has(w))
}

export interface Duplicate {
  id: string
  title: string
  author: string | null
  /** strict: same barcode or ISBN, surely the same item · wide: same title and author, maybe another edition */
  level: 'strict' | 'wide'
}

const creator = (f: any) => f?.author || f?.director

/**
 * Duplicate check against the family's shelf of one media type, the same everywhere (add review, form, lists, import).
 * - strict: same ISBN or barcode;
 * - wide: same title and volume (a result without a volume matches on its title alone: sources often omit it),
 *   by the same author or director when both are known ("Greatest Hits" by Queen is not ABBA's);
 *   games: a known, different platform is another item ("Mario Kart" on Switch and on Wii U).
 * exclude: the item being edited, not a duplicate of itself.
 * Returns a matcher: fields -> Duplicate | null.
 */
export async function ownedMatcher(user: any, type: string, { exclude }: { exclude?: string } = {}) {
  const ids = await visibleUserIds(user)
  const where: any = { user_id: { [Op.in]: ids }, type }
  if (exclude) where.id = { [Op.ne]: exclude }
  const owned: any[] = await Item.findAll({
    where,
    attributes: ['id', 'title', 'author', 'director', 'volume', 'category', 'isbn', 'barcode'],
    raw: true,
  })
  const byCode = new Map<string, any>()
  const byTitle = new Map<string, any[]>()
  for (const o of owned) {
    for (const c of [o.isbn, o.barcode].map(code)) if (c) byCode.set(c, o)
    const key = norm(o.title)
    byTitle.set(key, [...(byTitle.get(key) || []), o])
  }
  const result = (o: any, level: Duplicate['level']): Duplicate | null =>
    (o ? { id: o.id, title: o.title, author: creator(o) || null, level } : null)

  return (fields: any): Duplicate | null => {
    for (const c of [fields?.isbn, fields?.barcode].map(code)) if (c && byCode.has(c)) return result(byCode.get(c), 'strict')
    const volume = norm(fields?.volume)
    const hit = (byTitle.get(norm(fields?.title)) || []).find((o) =>
      (!volume || norm(o.volume) === volume)
      && sameAuthor(creator(fields), creator(o))
      && !(type === 'videogame' && fields?.category && o.category && fields.category !== o.category))
    return result(hit, 'wide')
  }
}
