// A small burst of stars, for moments that deserve it (saving an item, marking it as read…).
export function sparkle(origin, { count = 18, colors } = {}) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const rect = origin?.getBoundingClientRect ? origin.getBoundingClientRect() : null
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
  const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
  const css = getComputedStyle(document.documentElement)
  const accent = css.getPropertyValue('--accent').trim() || '#b26ee0'
  const glow = css.getPropertyValue('--accent-glow').trim() || accent
  const palette = colors || [accent, '#fff6c9', glow, '#ffffff']
  const layer = document.createElement('div')
  layer.className = 'sparkle-layer'
  document.body.appendChild(layer)
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span')
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
    const dist = 40 + Math.random() * 70
    s.className = 'sparkle'
    s.textContent = Math.random() > 0.5 ? '✦' : '✧'
    s.style.left = `${x}px`
    s.style.top = `${y}px`
    s.style.color = palette[i % palette.length]
    s.style.fontSize = `${10 + Math.random() * 14}px`
    s.style.setProperty('--dx', `${Math.cos(angle) * dist}px`)
    s.style.setProperty('--dy', `${Math.sin(angle) * dist}px`)
    s.style.animationDelay = `${Math.random() * 80}ms`
    layer.appendChild(s)
  }
  setTimeout(() => layer.remove(), 1100)
}

export function vibrate(pattern = 30) {
  try { navigator.vibrate?.(pattern) } catch {}
}
