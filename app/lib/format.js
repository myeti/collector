// Small display helpers shared by the library list and grid.

/** Author, or director for movies without an author */
export function creator(item) {
  return item.author || item.director || ''
}

/**
 * Metadata as groups of parts, rendered separated by " · ".
 * Parts marked `shrink` truncate with an ellipsis; the others (volume, year) always stay visible:
 * "La trilogie des sor… #2".
 */
export function metaGroups(item, { author = true, saga = true, year = true } = {}) {
  const groups = []
  if (author && creator(item)) groups.push([{ text: creator(item), shrink: true }])
  if (saga && (item.saga || item.volume)) {
    groups.push([item.saga && { text: item.saga, shrink: true }, item.volume && { text: `#${item.volume}` }].filter(Boolean))
  }
  const y = item.release_date?.slice(0, 4)
  if (year && y) groups.push([{ text: y }])
  return groups
}
