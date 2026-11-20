import crypto from 'node:crypto'
import { config } from '../config.ts'

const key = crypto.createHash('sha256').update(`collector:${config.jwtSecret}`).digest()

/** AES-256-GCM, output: base64(iv|tag|ciphertext). */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')
}

export function decrypt(payload: string): string | null {
  try {
    const buf = Buffer.from(payload, 'base64')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12))
    decipher.setAuthTag(buf.subarray(12, 28))
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

/** Keyed hash for short secrets (6-digit codes): useless without JWT_SECRET even if the DB leaks. */
export function hmac(value: string): string {
  return crypto.createHmac('sha256', config.jwtSecret).update(value).digest('hex')
}

/** Uniform 6-digit code. */
export function randomCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

export function mask(secret: string | null | undefined): string | null {
  if (!secret) return null
  return secret.length <= 6 ? '••••' : `••••${secret.slice(-4)}`
}
