// Minimal HS256 JWT (no dependency): sign / verify with JWT_SECRET.
import crypto from 'node:crypto'
import { config } from '../config.ts'

const b64 = (v: Buffer | string) => Buffer.from(v).toString('base64url')
const HEADER = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))

function hmac(data: string) {
  return crypto.createHmac('sha256', config.jwtSecret).update(data).digest('base64url')
}

export function signJwt(payload: Record<string, any>, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000)
  const body = b64(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }))
  return `${HEADER}.${body}.${hmac(`${HEADER}.${body}`)}`
}

export function verifyJwt(token: string): Record<string, any> | null {
  const [header, body, sig] = String(token).split('.')
  if (!header || !body || !sig || header !== HEADER) return null
  const expected = Buffer.from(hmac(`${header}.${body}`))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000) return null
    return payload
  } catch {
    return null
  }
}
