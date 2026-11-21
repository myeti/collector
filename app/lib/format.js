// Small display helpers shared by the library list and grid.
import { PLATFORM_LABELS } from '../../shared/media.js'

export { norm } from '../../shared/text.js'

/** Author, or director for movies without an author */
export function creator(item) {
  return item.author || item.director || ''
}

/** Platform of a video game ("Switch", "PlayStation 5"), empty for "other" or any other media */
export function platform(item) {
  return item.type === 'videogame' ? PLATFORM_LABELS[item.category] || '' : ''
}

/**
 * Metadata as groups of parts, rendered separated by " · ".
 * Parts marked `shrink` truncate with an ellipsis; the others (volume, year) always stay visible:
 * "La trilogie des sor… #2".
 */
export function metaGroups(item, { author = true, saga = true, year = true } = {}) {
  const groups = []
  // Games: "Switch · Nintendo", the platform first
  if (author && platform(item)) groups.push([{ text: platform(item) }])
  if (author && creator(item)) groups.push([{ text: creator(item), shrink: true }])
  if (saga && (item.saga || item.volume)) {
    groups.push([item.saga && { text: item.saga, shrink: true }, item.volume && { text: `#${item.volume}` }].filter(Boolean))
  }
  const y = item.release_date?.slice(0, 4)
  if (year && y) groups.push([{ text: y }])
  return groups
}
