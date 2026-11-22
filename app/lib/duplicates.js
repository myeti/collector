// "Already in the collection?" while an item is added or edited: the server compares with the family's items.
// strict: same barcode or ISBN · wide: same title and author (maybe another edition).
import { api } from './api.js'

/** Only the fields the check uses: nothing to send when there is nothing to compare. */
const KEYS = ['title', 'author', 'volume', 'format', 'isbn', 'barcode']

export async function findDuplicate(type, fields, exclude) {
  const f = Object.fromEntries(KEYS.filter((k) => fields?.[k]).map((k) => [k, fields[k]]))
  if (!f.title && !f.isbn && !f.barcode) return null
  const { duplicate } = await api.post('/items/duplicates', { type, fields: f, exclude })
  return duplicate
}

/** Debounced checker for a component: call it on every change, it keeps the latest answer only. */
export function duplicateWatcher(onResult, delay = 300) {
  let timer = null
  let seq = 0
  return (type, fields, exclude) => {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      const mine = ++seq
      const dup = await findDuplicate(type, fields, exclude).catch(() => null)
      if (mine === seq) onResult(dup)
    }, delay)
  }
}
