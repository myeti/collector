import { clean, has, year } from './types.ts'
import type { Importer, ImportRow } from './types.ts'

// Discogs grading -> our 4 conditions
const CONDITIONS: [RegExp, string][] = [
  [/^(mint|near mint)/i, 'perfect'], [/^very good/i, 'good'], [/^(good|fair)/i, 'fair'], [/^poor/i, 'poor'],
]

function format(descriptors: string[]) {
  for (const d of descriptors) {
    // "LP", "2xLP", "12\"", "Vinyl"…
    if (/LP\b|Vinyl|Flexi|\d+"/i.test(d)) return { format: 'vinyl' }
    if (/CDr?\b|SACD/i.test(d)) return { format: 'cd' }
    if (/\bCass/i.test(d)) return { format: 'tape' }
    if (/\b(File|Digital)\b/i.test(d)) return { digitalized: true }
  }
  return {}
}

function category(descriptors: string[], title: string) {
  if (/soundtrack|motion picture|bande originale|\bO\.?S\.?T\b/i.test(title)) return 'soundtrack'
  if (descriptors.includes('Comp')) return 'compilation'
  if (descriptors.some((d) => /^(EP|Mini-Album)$/.test(d))) return 'ep'
  if (descriptors.some((d) => /Single/.test(d))) return 'single'
  return 'album'
}

export const discogs: Importer = {
  id: 'discogs',
  name: 'Discogs',
  type: 'music',
  url: 'https://www.discogs.com/users/export',
  header: (c) => has(c, 'Artist', 'Title', 'Format', 'release_id'),
  rows: (records, filename) => records.map((r): ImportRow => {
    const descriptors = (r.Format || '').split(',').map((d) => d.trim()).filter(Boolean)
    const title = clean(r.Title) || ''
    // The wantlist export has no collection columns
    const wantlist = !('CollectionFolder' in r) || /want/i.test(filename)
    return {
      fields: {
        title,
        // "Prince (2)" / "Supertramp*": Discogs disambiguation marks
        author: clean((r.Artist || '').replace(/\s*\(\d+\)/g, '').replace(/\*/g, '')),
        label: clean([...new Set((r.Label || '').split(',').map((l) => l.replace(/\s*\(\d+\)/g, '').trim()))][0]),
        release_date: year(r.Released),
        category: category(descriptors, title),
        ...format(descriptors),
        condition: CONDITIONS.find(([re]) => re.test(r['Collection Media Condition'] || ''))?.[1],
        comment: clean(r['Collection Notes']),
      },
      excluded: wantlist ? 'wishlist' : undefined,
    }
  }),
}
