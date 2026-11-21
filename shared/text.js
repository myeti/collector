// Text helpers shared by the server and the app, so both compare and search items the same way.

/** Lowercase, no accents, no punctuation: "L’Étranger !" -> "l etranger" */
export function norm(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

/** What to search an item by: its title, the author where sources index it (books, music), its volume. */
export function queryText(fields = {}, type) {
  return [fields.title, type === 'book' || type === 'music' ? fields.author : '', fields.volume].filter(Boolean).join(' ').trim()
}
