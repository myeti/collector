import type { Migration } from './index.ts'

// Format becomes required for books, music, movies and games: items without one get the first value of their list.
// (Values frozen here: a migration must keep meaning what it meant when it shipped.)
const DEFAULTS: Record<string, string> = { book: 'novel', music: 'vinyl', movie: 'dvd', videogame: 'switch2' }

export const requiredFormat: Migration = {
  name: '002-required-format',
  async up({ query }) {
    for (const [type, format] of Object.entries(DEFAULTS)) {
      await query(`UPDATE items SET format = :format WHERE type = :type AND (format IS NULL OR format = '')`, { type, format })
    }
  },
}
