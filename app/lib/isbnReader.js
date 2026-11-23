// Reads printed ISBNs ("ISBN 978-2-07-061275-8") in camera frames, for books whose barcode is not their ISBN.
// OCR by Tesseract (tesseract.js) in a web worker. Its engine and English model are served by Collector itself
// under /ocr/<version>/ (see vite.config.js), downloaded on first use only, then cached: nothing leaves the device.
import { normalizeIsbn } from '../../shared/media.js'

const BASE = `/ocr/${__OCR_VERSION__}`

let workerPromise = null
let idleTimer = null

/** The OCR worker, created on first use and kept for the next scans (released a minute after the scanner closes). */
export function loadIsbnReader() {
  clearTimeout(idleTimer)
  workerPromise ||= (async () => {
    const { createWorker, PSM } = await import('tesseract.js')
    const worker = await createWorker('eng', 1, {
      workerPath: `${BASE}/worker.min.js`,
      corePath: `${BASE}/core`,
      langPath: `${BASE}/lang`,
      workerBlobURL: false, // a same-origin worker file (the CSP allows no blob: workers)
      gzip: true,
    })
    // Digits, X, separators and the "ISBN" label: anything else is noise for us
    await worker.setParameters({ tessedit_char_whitelist: '0123456789Xx-– ISBN:', tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
    return worker
  })()
  workerPromise.catch(() => { workerPromise = null })
  return workerPromise
}

export function releaseIsbnReader() {
  clearTimeout(idleTimer)
  idleTimer = setTimeout(async () => {
    const pending = workerPromise
    workerPromise = null
    ;(await pending?.catch(() => null))?.terminate()
  }, 60_000)
}

/** Valid ISBNs (as ISBN-13) in OCR text: runs of 10 to 13 digits with optional separators, check digit verified. */
export function findIsbns(text) {
  const found = []
  for (const m of String(text).matchAll(/(?:\d[\s\-–—]?){9,12}[\dXx]/g)) {
    const isbn = normalizeIsbn(m[0])
    if (isbn && !found.includes(isbn)) found.push(isbn)
  }
  return found
}

/**
 * A crop of the camera frame (or any image), ready for OCR: at most 1280 px wide, in black and white by an
 * adaptive threshold (Bradley): each pixel is compared with the mean of its own neighbourhood, not one global
 * level, so uneven lighting, shadows and tinted paper do not wash the digits out.
 */
export function prepareFrame(source, sx, sy, sw, sh, canvas = document.createElement('canvas')) {
  if (![sx, sy, sw, sh].every(Number.isFinite) || sw < 1 || sh < 1) return null
  const scale = Math.min(1, 1280 / sw)
  const w = (canvas.width = Math.max(1, Math.round(sw * scale)))
  const h = (canvas.height = Math.max(1, Math.round(sh * scale)))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h)
  const image = ctx.getImageData(0, 0, w, h)
  const px = image.data
  // Grey levels and their integral image (sums over any rectangle in constant time)
  const grey = new Uint8Array(w * h)
  for (let i = 0, j = 0; j < grey.length; i += 4, j++) grey[j] = (px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8
  const sums = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) {
      row += grey[y * w + x]
      sums[(y + 1) * (w + 1) + x + 1] = sums[y * (w + 1) + x + 1] + row
    }
  }
  // Darker than 85 % of the neighbourhood mean: ink
  const half = Math.max(8, Math.round(w / 16))
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half), y1 = Math.min(h, y + half + 1)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half), x1 = Math.min(w, x + half + 1)
      const sum = sums[y1 * (w + 1) + x1] - sums[y0 * (w + 1) + x1] - sums[y1 * (w + 1) + x0] + sums[y0 * (w + 1) + x0]
      const ink = grey[y * w + x] * (x1 - x0) * (y1 - y0) < sum * 0.85
      const i = (y * w + x) * 4
      px[i] = px[i + 1] = px[i + 2] = ink ? 0 : 255
    }
  }
  ctx.putImageData(image, 0, 0)
  return straighten(canvas, px, w, h)
}

/**
 * A phone is rarely held level: finds the angle (±12°) at which the ink falls into the sharpest horizontal rows
 * (projection profile), then rotates the image back by it.
 */
function straighten(canvas, px, w, h) {
  // The ink pixels, relative to the centre: every one (a short line has few), sampled only on busy frames
  let count = 0
  for (let i = 0; i < px.length; i += 4) if (px[i] === 0) count++
  const step = Math.max(1, Math.ceil(Math.sqrt(count / 60_000)))
  const ink = []
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (px[(y * w + x) * 4] === 0) ink.push(x - w / 2, y - h / 2)
  if (ink.length < 40) return canvas
  const score = (deg) => {
    const a = (deg * Math.PI) / 180
    const sin = Math.sin(a), cos = Math.cos(a)
    const rows = new Map()
    for (let i = 0; i < ink.length; i += 2) {
      const r = Math.round(ink[i + 1] * cos - ink[i] * sin)
      rows.set(r, (rows.get(r) || 0) + 1)
    }
    let sum = 0
    for (const n of rows.values()) sum += n * n
    return sum
  }
  let best = 0
  let bestScore = score(0)
  for (let deg = -12; deg <= 12; deg += 1) {
    const sc = score(deg)
    if (sc > bestScore) { best = deg; bestScore = sc }
  }
  for (const deg of [best - 0.5, best + 0.5]) {
    const sc = score(deg)
    if (sc > bestScore) { best = deg; bestScore = sc }
  }
  if (Math.abs(best) < 1) return canvas
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.translate(w / 2, h / 2)
  ctx.rotate((-best * Math.PI) / 180)
  ctx.drawImage(canvas, -w / 2, -h / 2)
  return out
}

/** Reads the ISBNs in a canvas (a crop of the camera frame, see prepareFrame). */
export async function readIsbns(worker, canvas) {
  const { data } = await worker.recognize(canvas)
  return findIsbns(data.text)
}
