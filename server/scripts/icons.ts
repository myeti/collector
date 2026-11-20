// Usage: npm run icons — renders the neon cassette mark to PNG (PWA icons + email logo).
// Source of truth for the drawing: app/components/AppLogo.vue (24×24 grid).
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const PURPLE = '#b26ee0' // Books accent, the default collection
const CORE = '#e8d6f6' // light tube core
const BG = '#111113'

const CASSETTE = `
  <rect x="4" y="2" width="16" height="20" rx="2"/>
  <circle cx="10" cy="8" r="2"/>
  <circle cx="10" cy="16" r="2"/>
  <path d="M12 8v8"/>
  <path d="M20 6l-2.6.7a1.4 1.4 0 0 0-1.1 1.4v7.8a1.4 1.4 0 0 0 1.1 1.4L20 18"/>`

/**
 * 64×64 artboard. `scale` sizes the 24-grid mark; it is centred.
 * `radius` rounds the tile (0 = full bleed for maskable / iOS, null = transparent background).
 */
function svg({ scale, radius }: { scale: number; radius: number | null }) {
  const offset = 32 - 12 * scale
  const tile = radius === null ? '' : `<rect width="64" height="64" rx="${radius}" fill="${BG}"/>`
  const tube = (stroke: string, width: number, extra = '') =>
    `<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}>${CASSETTE}</g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter></defs>
  ${tile}
  ${tube(PURPLE, 3.2, 'filter="url(#glow)" opacity="0.9"')}
  ${tube(PURPLE, 2)}
  ${tube(CORE, 0.9)}
</svg>`
}

async function render(file: string, size: number, opts: { scale: number; radius: number | null }) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await sharp(Buffer.from(svg(opts)), { density: (72 * size) / 64 * 4 }).resize(size, size).png().toFile(file)
  console.log(`✓ ${file} (${size}px)`)
}

const icons = path.resolve('app/public/icons')
await render(`${icons}/icon-192.png`, 192, { scale: 1.6667, radius: 14 })
await render(`${icons}/icon-512.png`, 512, { scale: 1.6667, radius: 14 })
// Maskable: full bleed, mark inside the 80% safe circle
await render(`${icons}/maskable-512.png`, 512, { scale: 1.25, radius: 0 })
// iOS applies its own rounded mask: full bleed
await render(`${icons}/apple-touch-icon.png`, 180, { scale: 1.5, radius: 0 })
// Email header logo: transparent, glow over the dark card
await render(path.resolve('server/emails/logo.png'), 144, { scale: 2.1, radius: null })
