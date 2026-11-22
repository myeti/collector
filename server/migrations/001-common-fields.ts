import type { Migration } from './index.ts'

// Fewer per-type fields: format, editor, saga and volume are common to every item.
//   books, games:  category -> format (novel, comic… / the platform); the category is no longer used
//   music:         label -> editor ("Label")
//   movies:        author ("Studio") -> editor ("Studio"), director -> author ("Director")
//   every item:    original_title dropped (unused since 0.1.0)
const BOOK_FORMATS = ['novel', 'comic', 'manga', 'magazine', 'essay', 'artbook', 'children', 'other']

export const commonFields: Migration = {
  name: '001-common-fields',
  async up({ query, columns }) {
    const items = await columns('items')
    // Only known values move (format is a fixed list); anything else stays where it was
    await query(`UPDATE items SET format = category, category = NULL
      WHERE type = 'book' AND format IS NULL AND category IN (:formats)`, { formats: BOOK_FORMATS })
    await query(`UPDATE items SET format = LEFT(category, 32), category = NULL
      WHERE type = 'videogame' AND format IS NULL AND category IS NOT NULL`)
    if (items.has('label')) {
      await query(`UPDATE items SET editor = label WHERE editor IS NULL AND label IS NOT NULL`)
      await query('ALTER TABLE items DROP COLUMN label')
    }
    if (items.has('director')) {
      await query(`UPDATE items SET editor = COALESCE(editor, author), author = director WHERE type = 'movie'`)
      await query('ALTER TABLE items DROP COLUMN director')
    }
    if (items.has('original_title')) await query('ALTER TABLE items DROP COLUMN original_title')
  },
}
