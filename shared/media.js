// Media definitions shared by the server (validation, connectors) and the app (forms, filters).
// Labels live in the i18n files: media.<type>, category.<type>.<key>, genre.<type>.<key>, format.<key>.

export const CONDITIONS = ['poor', 'fair', 'good', 'perfect']

// Video game platforms, grouped by brand. They are the categories of the `videogame` collection.
export const PLATFORM_GROUPS = [
  { brand: 'nintendo', platforms: ['switch2', 'switch', 'wiiu', 'wii', 'gamecube', 'n64', 'snes', 'nes', '3ds', 'ds', 'gba', 'gbc', 'gb'] },
  { brand: 'playstation', platforms: ['ps5', 'ps4', 'ps3', 'ps2', 'ps1', 'psvita', 'psp'] },
  { brand: 'xbox', platforms: ['xboxseries', 'xboxone', 'xbox360', 'xbox'] },
  { brand: 'sega', platforms: ['dreamcast', 'saturn', 'megadrive', 'mastersystem', 'gamegear'] },
  { brand: 'other', platforms: ['pc', 'neogeo', 'atari', 'other'] },
]

// Proper names, identical in every language ("other" is translated in the i18n files).
export const PLATFORM_LABELS = {
  switch2: 'Switch 2', switch: 'Switch', wiiu: 'Wii U', wii: 'Wii', gamecube: 'GameCube', n64: 'Nintendo 64',
  snes: 'Super Nintendo', nes: 'NES', '3ds': '3DS', ds: 'DS', gba: 'Game Boy Advance', gbc: 'Game Boy Color', gb: 'Game Boy',
  ps5: 'PlayStation 5', ps4: 'PlayStation 4', ps3: 'PlayStation 3', ps2: 'PlayStation 2', ps1: 'PlayStation', psvita: 'PS Vita', psp: 'PSP',
  xboxseries: 'Xbox Series X/S', xboxone: 'Xbox One', xbox360: 'Xbox 360', xbox: 'Xbox',
  dreamcast: 'Dreamcast', saturn: 'Saturn', megadrive: 'Mega Drive', mastersystem: 'Master System', gamegear: 'Game Gear',
  pc: 'PC', neogeo: 'Neo Geo', atari: 'Atari',
}

// Ordered: specific names before the generic ones they contain ("Switch 2" before "Switch", "3DS" before "DS"…).
const PLATFORM_PATTERNS = [
  ['switch2', /switch ?2/], ['switch', /switch|\bnsw?\b/], ['wiiu', /wii ?u\b/], ['wii', /\bwii\b/],
  ['gamecube', /game ?cube|\bngc\b/], ['n64', /nintendo ?64|\bn64\b/], ['snes', /super nintendo|\bsnes\b|super famicom/],
  ['nes', /\bnes\b|famicom|nintendo entertainment system/], ['3ds', /3ds/], ['ds', /\bn?ds\b|nintendo ds/],
  ['gba', /game ?boy ?advance|\bgba\b/], ['gbc', /game ?boy ?colou?r|\bgbc\b/], ['gb', /game ?boy|\bgb\b/],
  ['psvita', /vita/], ['psp', /\bpsp\b|playstation portable/],
  ['ps5', /ps ?5|playstation ?5/], ['ps4', /ps ?4|playstation ?4/], ['ps3', /ps ?3|playstation ?3/],
  ['ps2', /ps ?2|playstation ?2/], ['ps1', /ps ?1\b|\bpsx\b|ps one|playstation/],
  ['xboxseries', /series ?[xs]|\bxsx\b/], ['xboxone', /xbox ?one|\bxone\b|\bxb1\b/], ['xbox360', /360/], ['xbox', /xbox/],
  ['dreamcast', /dreamcast/], ['saturn', /saturn/], ['megadrive', /mega ?drive|genesis/], ['mastersystem', /master ?system/],
  ['gamegear', /game ?gear/], ['neogeo', /neo ?geo/], ['atari', /atari|jaguar|lynx/],
  ['pc', /\bpc\b|windows|steam|\bmac(os)?\b|linux|dos\b/],
]

/** "PlayStation 4" / "PS4" / "Nintendo Switch" -> platform key, or null when nothing matches. */
export function matchPlatform(raw) {
  const s = String(raw || '').toLowerCase()
  if (!s.trim()) return null
  for (const [key, re] of PLATFORM_PATTERNS) if (re.test(s)) return key
  return null
}

export const COMMON_FIELDS = [
  'title', 'original_title', 'author', 'cover', 'genre', 'category',
  'release_date', 'condition', 'barcode', 'consumed', 'comment',
]

export const MEDIA = {
  // quickFilter: the field offered in the quick bar above the bottom navigation.
  book: {
    icon: 'book-open',
    quickFilter: 'category',
    fields: ['editor', 'isbn', 'saga', 'volume'],
    categories: ['novel', 'comic', 'manga', 'magazine', 'essay', 'artbook', 'children', 'other'],
    genres: [
      'fantasy', 'science_fiction', 'romance', 'thriller', 'crime', 'horror', 'adventure',
      'historical', 'biography', 'humor', 'drama', 'poetry', 'slice_of_life', 'shonen',
      'seinen', 'shojo', 'superhero', 'nonfiction', 'cooking', 'travel', 'science', 'youth',
    ],
    formats: [],
  },
  music: {
    icon: 'disc',
    quickFilter: 'format',
    fields: ['label', 'format'],
    categories: ['album', 'single', 'ep', 'live', 'compilation', 'soundtrack', 'stories'],
    genres: [
      'pop', 'rock', 'metal', 'punk', 'jazz', 'blues', 'classical', 'electronic', 'hip_hop',
      'rnb', 'soul', 'funk', 'reggae', 'folk', 'country', 'world', 'chanson', 'soundtrack', 'kids',
    ],
    formats: ['vinyl', 'cd', 'tape'],
  },
  movie: {
    icon: 'film',
    quickFilter: 'format',
    fields: ['director', 'saga', 'volume', 'format'],
    categories: ['movie', 'series', 'animated_movie', 'animated_series', 'documentary'],
    genres: [
      'action', 'adventure', 'comedy', 'drama', 'romance', 'thriller', 'horror', 'science_fiction',
      'fantasy', 'crime', 'war', 'western', 'musical', 'family', 'documentary', 'history', 'mystery',
    ],
    formats: ['dvd', 'bluray', 'uhd'],
  },
  // Video games only (the UI calls it "Games"). Its category is the platform.
  videogame: {
    icon: 'monitor',
    quickFilter: 'category',
    fields: ['editor', 'saga', 'volume'],
    categories: PLATFORM_GROUPS.flatMap((g) => g.platforms),
    genres: [
      'action', 'adventure', 'rpg', 'strategy', 'simulation', 'sports', 'racing', 'puzzle',
      'platformer', 'shooter', 'fighting', 'party', 'family', 'cooperative', 'horror',
    ],
    formats: [],
  },
  custom: {
    icon: 'box',
    quickFilter: 'category',
    fields: ['editor'],
    categories: [],
    genres: [],
    formats: [],
  },
}

export const MEDIA_TYPES = Object.keys(MEDIA)

// Collections shown in the interface by default (users can toggle them in settings), and the one opened on startup.
export const DEFAULT_TYPES = ['book', 'music', 'movie', 'videogame']
export const DEFAULT_START_TYPE = 'book'

/** Normalised UI preferences of a user: { types, startType }. */
export function userPrefs(prefs) {
  const types = Array.isArray(prefs?.types) ? MEDIA_TYPES.filter((t) => prefs.types.includes(t)) : DEFAULT_TYPES
  const enabled = types.length ? types : DEFAULT_TYPES
  const startType = enabled.includes(prefs?.startType) ? prefs.startType : enabled.includes(DEFAULT_START_TYPE) ? DEFAULT_START_TYPE : enabled[0]
  return { types: enabled, startType }
}

// Every media-specific column that may exist on an item.
export const SPECIFIC_FIELDS = [...new Set(MEDIA_TYPES.flatMap((t) => MEDIA[t].fields))]

export const ALL_FIELDS = [...COMMON_FIELDS, ...SPECIFIC_FIELDS]

export function fieldsFor(type) {
  return [...COMMON_FIELDS, ...(MEDIA[type]?.fields || [])]
}

export function isIsbn(code) {
  const c = String(code || '').replace(/[^0-9X]/gi, '')
  return (c.length === 13 && /^97[89]/.test(c)) || c.length === 10
}

// Best-effort: "Science Fiction & Fantasy" -> 'science_fiction'. Returns null when nothing matches.
const GENRE_ALIASES = {
  'sci-fi': 'science_fiction', 'scifi': 'science_fiction', 'science-fiction': 'science_fiction',
  'sf': 'science_fiction', 'policier': 'crime', 'polar': 'crime', 'mystery': 'mystery',
  'detective': 'crime', 'love': 'romance', 'romantic': 'romance', 'comedy': 'comedy',
  'humour': 'humor', 'comédie': 'comedy', 'horreur': 'horror', 'aventure': 'adventure',
  'historique': 'historical', 'history': 'history', 'hip hop': 'hip_hop', 'hip-hop': 'hip_hop',
  'rap': 'hip_hop', 'r&b': 'rnb', 'rhythm and blues': 'rnb', 'electro': 'electronic',
  'electronica': 'electronic', 'dance': 'electronic', 'techno': 'electronic', 'house': 'electronic',
  'classique': 'classical', 'variété': 'chanson', 'french': 'chanson', 'children': 'kids',
  'juvenile': 'youth', 'jeunesse': 'youth', 'role-playing': 'rpg', 'role playing': 'rpg',
  'jeu de rôle': 'rpg', 'shoot': 'shooter', 'fps': 'shooter', 'platform': 'platformer',
  'animation': 'family', 'famille': 'family', 'guerre': 'war', 'documentaire': 'documentary',
  'biographie': 'biography', 'autobiography': 'biography', 'cuisine': 'cooking',
  'cookery': 'cooking', 'fiction': null,
}

export function matchGenre(type, raw) {
  const genres = MEDIA[type]?.genres || []
  if (!raw) return null
  const candidates = String(raw).toLowerCase().split(/[,/|;&]+| and | et /).map((s) => s.trim()).filter(Boolean)
  for (const c of candidates) {
    const key = c.replace(/[\s-]+/g, '_')
    if (genres.includes(key)) return key
    if (c in GENRE_ALIASES && GENRE_ALIASES[c] && genres.includes(GENRE_ALIASES[c])) return GENRE_ALIASES[c]
    for (const g of genres) if (c.includes(g.replace(/_/g, ' '))) return g
    for (const [alias, g] of Object.entries(GENRE_ALIASES)) if (g && c.includes(alias) && genres.includes(g)) return g
  }
  return null
}
