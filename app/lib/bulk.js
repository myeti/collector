// Bulk add session (shelf photo → items reviewed one by one). Kept in sessionStorage so it survives
// a detour through the item form and a page reload.
import { reactive, watch } from 'vue'

const KEY = 'collector.bulk'

function load() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null') } catch { return null }
}

/**
 * items: [{ id, fields, sourceName, owned: { id, title } | null, status: 'pending' | 'owned' | 'added' | 'skipped', itemId }]
 * current: id of the item being reviewed, reviewing: true while going through the queue.
 */
export const bulk = reactive(load() || { type: null, items: [], current: null, reviewing: false })

watch(bulk, (value) => {
  try { sessionStorage.setItem(KEY, JSON.stringify(value)) } catch {}
}, { deep: true })

export function startBulk(type, items) {
  bulk.type = type
  bulk.items = items.map((i) => ({ ...i, status: i.owned ? 'owned' : 'pending', itemId: null }))
  bulk.current = null
  bulk.reviewing = false
}

export function clearBulk() {
  bulk.type = null
  bulk.items = []
  bulk.current = null
  bulk.reviewing = false
}

export function nextPending(afterId = -1) {
  const pending = bulk.items.filter((i) => i.status === 'pending')
  return pending.find((i) => i.id > afterId) || pending[0] || null
}

export function markBulk(id, status, itemId = null) {
  const item = bulk.items.find((i) => i.id === id)
  if (item) {
    item.status = status
    if (itemId) item.itemId = itemId
  }
}
