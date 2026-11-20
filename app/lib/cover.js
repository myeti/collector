// Deterministic, pretty placeholder for items without a cover.
function hash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const HUES = { book: 280, music: 24, movie: 145, videogame: 189, custom: 46 }

export function placeholder(title = '', type = 'book') {
  const h = hash(`${type}:${title}`)
  // Stay within ±35° of the media hue so placeholders match the shelf's color.
  const hue = ((HUES[type] ?? 260) + (h % 70) - 35 + 360) % 360
  const hue2 = (hue + 20 + (h >> 8) % 40) % 360
  const angle = (h >> 4) % 360
  return {
    background: `linear-gradient(${angle}deg, hsl(${hue} 65% 42%), hsl(${hue2} 70% 28%))`,
    initials: title
      .replace(/^(the|le|la|les|l')\s*/i, '')
      .split(/\s+/)
      .filter((w) => /\w/.test(w))
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join(''),
  }
}
