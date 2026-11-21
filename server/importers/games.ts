import { matchPlatform } from '../../shared/media.js'
import { clean, has, year } from './types.ts'
import type { Importer, ImportRow } from './types.ts'

export const rawg: Importer = {
  id: 'rawg',
  name: 'RAWG',
  type: 'videogame',
  url: 'https://rawg.io/',
  header: (c) => has(c, 'Game', 'Game platforms', 'Status'),
  rows: (records) => records.map((r): ImportRow => {
    const status = (r.Status || '').toLowerCase()
    // The platform played on, else the only one the game exists on; otherwise the user picks.
    const listed = [...new Set((r['Game platforms'] || '').split(',').map(matchPlatform).filter(Boolean))] as string[]
    const platform = matchPlatform(r['Played on']) || (listed.length === 1 ? listed[0] : undefined)
    return {
      fields: {
        title: clean((r.Game || '').replace(/\s*\((19|20)\d\d\)\s*$/, '')), // "Mario Kart 64 (1996)"
        release_date: clean(r.Released)?.match(/^\d{4}(-\d{2}(-\d{2})?)?$/)?.[0] || year(r.Released),
        category: platform,
        consumed: /beaten|complet|^played$|dropped|abandon/.test(status),
      },
      choices: platform ? undefined : listed,
      excluded: /wish|to ?play|want/.test(status) ? 'wishlist' : undefined,
    }
  }),
}
