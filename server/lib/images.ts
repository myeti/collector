import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'
import { config } from '../config.ts'
import { safeFetch } from './safe-fetch.ts'
import { hmac } from './crypto.ts'

const MAX = 1400
// Decoding cap: a small file can declare a huge canvas (decompression bomb).
const LIMIT_PIXELS = 50_000_000

/**
 * Upload names carry a signature of their owner: `<uuid>-<tag>.webp`. It cannot be forged without the
 * server secret, so an item can only reference (and get deleted) its owner's own files.
 */
const tag = (ownerId: string, id: string) => hmac(`upload:${ownerId}:${id}`).slice(0, 16)

export function ownsUpload(publicPath: string | null | undefined, ownerId: string): boolean {
  const m = String(publicPath || '').match(/^\/uploads\/([0-9a-f-]{36})-([0-9a-f]{16})\.webp$/)
  return !!m && m[2] === tag(ownerId, m[1])
}

/** Normalises any image buffer to a webp in DATA_DIR. Returns its public path. */
export async function storeImage(buffer: Buffer, ownerId: string): Promise<string> {
  await fs.mkdir(config.uploadDir, { recursive: true })
  const id = crypto.randomUUID()
  const name = `${id}-${tag(ownerId, id)}.webp`
  await sharp(buffer, { failOn: 'none', limitInputPixels: LIMIT_PIXELS })
    .rotate() // honour EXIF orientation from phone cameras
    .resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 84 })
    .toFile(path.join(config.uploadDir, name))
  return `/uploads/${name}`
}

/**
 * Downloads a remote cover (from a metadata API) so the collection never depends on hotlinks.
 * The URL comes from the client: fetched through safeFetch (public addresses only, size-capped).
 */
export async function importRemoteImage(url: string, ownerId: string): Promise<string | null> {
  try {
    const { body } = await safeFetch(url, { maxBytes: 15 * 1024 * 1024, accept: /^image\//i })
    return await storeImage(body, ownerId)
  } catch {
    return null
  }
}

/** Deletes an upload only when it belongs to `ownerId` (callers also check no other item uses it). */
export async function deleteImage(publicPath: string | null | undefined, ownerId: string) {
  if (!ownsUpload(publicPath, ownerId)) return
  const file = path.join(config.uploadDir, path.basename(publicPath))
  await fs.unlink(file).catch(() => {})
}

/** JPEG for vision models. Small by default (tokens, latency); shelf photos need more pixels for spines. */
export async function toVisionJpeg(buffer: Buffer, max = 1024): Promise<Buffer> {
  return sharp(buffer, { failOn: 'none', limitInputPixels: LIMIT_PIXELS }).rotate().resize({ width: max, height: max, fit: 'inside' }).jpeg({ quality: 82 }).toBuffer()
}
