// Add session: the items being added through one method (scan, photo, search), reviewed one by one.
// A single scan is a queue of one. Kept in sessionStorage: it survives a detour through the form and a reload.
import { reactive, watch } from 'vue'

const KEY = 'collector.add'

/**
 * origin: 'scan' | 'photo' | 'search'
 * items: [{
 *   id,
 *   query: { code?, text? }          what the sources are asked (editable during the review)
 *   seed: candidate | null           the AI reading of a photo, shown as one more source
 *   known: candidate[] | null        results already found (search): no lookup needed
 *   preset: { barcode?, isbn?, cover? }   values the item already has (scanned code, photo as cover)
 *   picked: fields | null            the picks, kept while the form is open
 *   status: 'pending' | 'added' | 'skipped', itemId
 * }]
 * current: id of the item under review (null: the list)
 */
const blank = () => ({ origin: null, type: null, items: [], current: null })

function load() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null') } catch { return null }
}

export const session = reactive(load() || blank())

watch(session, (value) => {
  try { sessionStorage.setItem(KEY, JSON.stringify(value)) } catch {}
}, { deep: true })

export function startSession(origin, type, items) {
  Object.assign(session, {
    origin,
    type,
    items: items.map((item, id) => ({ seed: null, known: null, preset: {}, picked: null, ...item, id, status: 'pending', itemId: null })),
    current: 0,
  })
}

export function clearSession() {
  Object.assign(session, blank())
}

export const currentItem = () => session.items.find((i) => i.id === session.current) || null

export function nextPending(afterId = -1) {
  const pending = session.items.filter((i) => i.status === 'pending')
  return pending.find((i) => i.id > afterId) || pending[0] || null
}

export const reviewPath = (type = session.type) => `/add/${type}/review`

/** Where a method starts: the scanner, the photo, the search box, or the blank form. */
export const startPath = (origin, type) => (origin === 'manual' ? `/new/${type}?from=manual` : `/add/${type}/${origin}`)

/**
 * The current item is done (saved or ignored): next one, or the end of the process.
 * Alone: saved -> its page (with "Add another"); ignored -> back to where the method starts.
 * In a queue: the next pending item, or the list once all are reviewed.
 */
export function finishItem(router, status, itemId = null) {
  const item = currentItem()
  if (!item) return router.replace(reviewPath())
  item.status = status
  item.itemId = itemId
  item.picked = null
  if (session.items.length === 1) {
    const { origin, type } = session
    clearSession()
    if (status === 'added') return router.replace({ path: `/item/${itemId}`, query: { from: origin } })
    return router.replace(startPath(origin, type))
  }
  session.current = nextPending(item.id)?.id ?? null
  return router.replace(reviewPath())
}
