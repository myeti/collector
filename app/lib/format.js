// Small display helpers shared by the library list and grid.
import { PLATFORM_LABELS } from '../../shared/media.js'

export { norm } from '../../shared/text.js'

/** Author, artist, director or studio, depending on the media type */
export function creator(item) {
  return item.author || ''
}

/** Platform of a video game ("Switch", "PlayStation 5"), empty for "other" or any other media */
export function platform(item) {
  return item.type === 'videogame' ? PLATFORM_LABELS[item.format] || '' : ''
}

// What the grid and the list show under the title, per media type: a saga line or not, then the details line.
const LINES = {
  book: { saga: true, meta: ['author', 'year'] },
  music: { saga: false, meta: ['author', 'year'] },
  movie: { saga: true, meta: ['author', 'editor', 'year'] },
  videogame: { saga: false, meta: ['author', 'format', 'year'] },
  custom: { saga: true, meta: ['author', 'year'] },
}

/**
 * The lines under an item's title, as groups of parts rendered separated by " · ".
 * Parts marked `shrink` truncate with an ellipsis; the others (volume, platform, year) always stay visible:
 * "La trilogie des sor… #2".
 *   saga: [[saga, #volume]] or [] · meta: e.g. [[author], [editor], [year]]
 */
export function itemLines(item) {
  const layout = LINES[item.type] || LINES.custom
  const saga = layout.saga && (item.saga || item.volume)
    ? [[item.saga && { text: item.saga, shrink: true }, item.volume && { text: `#${item.volume}` }].filter(Boolean)]
    : []
  const parts = {
    author: () => creator(item) && { text: creator(item), shrink: true },
    editor: () => item.editor && { text: item.editor, shrink: true },
    format: () => platform(item) && { text: platform(item) },
    year: () => item.release_date && { text: item.release_date.slice(0, 4) },
  }
  const meta = layout.meta.map((p) => parts[p]()).filter(Boolean).map((part) => [part])
  return { saga, meta }
}
