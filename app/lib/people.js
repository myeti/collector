// Family members' visual identity: same color and initial everywhere (settings, badges, item page).

/** Stable per-person gradient derived from the user id. */
export function personColor(id = '') {
  let h = 0
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360
  return `linear-gradient(135deg, hsl(${h} 45% 55%), hsl(${(h + 40) % 360} 45% 40%))`
}

export function initial(person) {
  return String(person?.name || person?.email || '?')[0].toUpperCase()
}
