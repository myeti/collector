// Startup splash (markup and styles inline in index.html, so it shows before the bundle loads).

// Long enough for the neon to switch on, short enough not to slow anyone down.
const MIN_VISIBLE = 900

export function hideSplash() {
  const el = document.getElementById('splash')
  if (!el || el.classList.contains('out')) return
  setTimeout(() => {
    el.classList.add('out')
    el.addEventListener('transitionend', () => el.remove(), { once: true })
    setTimeout(() => el.remove(), 1000) // no transition (reduced motion, background tab…)
  }, Math.max(0, MIN_VISIBLE - performance.now()))
}
