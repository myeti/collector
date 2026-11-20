import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { Op } from 'sequelize'
import { User, MagicToken, sequelize } from '../db.ts'
import { config } from '../config.ts'
import { randomToken, randomCode, sha256, hmac, safeEqual } from '../lib/crypto.ts'
import crypto from 'node:crypto'
import { signJwt, verifyJwt } from '../lib/jwt.ts'
import { sendMagicLink } from '../lib/mailer.ts'
import { HttpError, badRequest } from '../lib/http.ts'
import { isEmail, clientKey, throttled } from '../lib/guard.ts'
import { isPublicAddress } from '../lib/safe-fetch.ts'
import net from 'node:net'
import { serializeUser } from './serializers.ts'

const COOKIE = 'collector_session'

/** Attaches req.user when a valid session JWT is present (httpOnly cookie) and not revoked. */
export async function loadSession(req: Request, _res: Response, next: NextFunction) {
  const payload = req.cookies?.[COOKIE] ? verifyJwt(req.cookies[COOKIE]) : null
  if (payload?.sub) {
    const user: any = await User.findByPk(payload.sub)
    // "Sign out of all devices" bumps session_version: older tokens stop working.
    if (user && (payload.v ?? 0) === user.session_version) (req as any).user = user
  }
  next()
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!(req as any).user) return next(new HttpError(401, 'unauthenticated'))
  next()
}

/**
 * Where the magic link points. Production: always PUBLIC_URL. Dev: the page's own address only when it is
 * local or on the LAN (phone testing); any other Origin is ignored so an email can never link elsewhere.
 */
function linkBase(req: Request): string {
  if (config.production) return config.publicUrl
  try {
    const origin = new URL(req.get('origin') || '')
    const host = origin.hostname.replace(/^\[|\]$/g, '')
    const local = host === 'localhost' || host.endsWith('.localhost') || (net.isIP(host) > 0 && !isPublicAddress(host))
    if (local && ['http:', 'https:'].includes(origin.protocol)) return origin.origin
  } catch {}
  return config.publicUrl
}

// Attempt ids handed out for unknown emails behave like real ones (locking after the same number
// of tries), so the code endpoint does not reveal which emails have an account.
const fakeAttempts = new Map<string, { tries: number; expires: number }>()
setInterval(() => {
  const now = Date.now()
  for (const [id, a] of fakeAttempts) if (a.expires < now) fakeAttempts.delete(id)
}, 60_000).unref()

export const authRouter = Router()

authRouter.post('/magic-link', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  // Throttle first, validate after (the cheap checks must never run on unbounded input before the limiter).
  if (throttled(`ip:${clientKey(req.ip)}`, 10) || throttled(`email:${email.slice(0, 254)}`, 5)) {
    throw new HttpError(429, 'too_many_requests')
  }
  if (!isEmail(email)) throw badRequest('invalid_email')

  const user: any = await User.findOne({ where: { email } })
  // Same answer whether the user exists or not (a random attempt id): no account enumeration.
  let attempt: string = crypto.randomUUID()
  if (user) {
    const token = randomToken()
    const code = randomCode()
    const magic: any = await MagicToken.create({
      token_hash: sha256(token),
      user_id: user.id,
      expires_at: new Date(Date.now() + config.magicLinkMinutes * 60_000),
    })
    await magic.update({ code_hash: hmac(`${magic.id}:${code}`) })
    attempt = magic.id
    // The email speaks the language of the login screen the request came from.
    const locale = ['en', 'fr'].includes(req.body?.locale) ? req.body.locale : user.locale
    // Not awaited: the response time must not reveal whether an email was sent.
    sendMagicLink(user, `${linkBase(req)}/auth/verify?token=${encodeURIComponent(token)}`, code, locale)
      .catch((e) => console.error(`✉️  Sign-in email to ${user.email} failed: ${e.message}`))
  } else {
    fakeAttempts.set(attempt, { tries: 0, expires: Date.now() + config.magicLinkMinutes * 60_000 })
  }
  res.json({ ok: true, attempt })
})

/**
 * Opens the session once a link or a code has been validated. The token is consumed with a single
 * conditional UPDATE, so two parallel requests can never both get a session from it.
 */
async function signIn(req: Request, res: Response, magicId: string) {
  const [rows]: any = await sequelize.query(
    `UPDATE magic_tokens SET used_at = now() WHERE id = :id AND used_at IS NULL AND expires_at > now() RETURNING user_id`,
    { replacements: { id: magicId } },
  )
  if (!rows.length) throw badRequest('invalid_token')
  const user: any = await User.findByPk(rows[0].user_id)
  if (!user) throw badRequest('invalid_token')
  const days = req.body?.installed === true ? config.installedSessionDays : config.sessionDays
  res.cookie(COOKIE, signJwt({ sub: user.id, v: user.session_version }, days * 86_400), {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.publicUrl.startsWith('https://'),
    expires: new Date(Date.now() + days * 86_400_000),
    path: '/',
  })
  // Housekeeping
  MagicToken.destroy({ where: { expires_at: { [Op.lt]: new Date(Date.now() - 86_400_000) } } }).catch(() => {})
  res.json({ user: await serializeUser(user) })
}

/** Body: { attempt, code } — attempt is the id returned by /magic-link on this device. */
authRouter.post('/verify-code', async (req, res) => {
  if (throttled(`code-ip:${clientKey(req.ip)}`, 20)) throw new HttpError(429, 'too_many_requests')
  const attempt = String(req.body?.attempt || '')
  const code = String(req.body?.code || '').replace(/\D/g, '')
  if (!/^[0-9a-f-]{36}$/i.test(attempt) || code.length !== 6) throw badRequest('invalid_code')

  const fake = fakeAttempts.get(attempt)
  if (fake) {
    fake.tries++
    throw badRequest(fake.tries >= config.codeMaxAttempts ? 'code_locked' : 'invalid_code')
  }

  // Consume one try atomically *before* comparing: parallel guesses cannot share the same budget.
  const [rows]: any = await sequelize.query(
    `UPDATE magic_tokens SET code_attempts = code_attempts + 1
     WHERE id = :id AND code_attempts < :max AND used_at IS NULL AND expires_at > now() AND code_hash IS NOT NULL
     RETURNING code_hash, code_attempts, user_id`,
    { replacements: { id: attempt, max: config.codeMaxAttempts } },
  )
  if (!rows.length) {
    const magic: any = await MagicToken.findByPk(attempt)
    throw badRequest(magic && !magic.used_at && magic.expires_at > new Date() ? 'code_locked' : 'invalid_code')
  }
  const row = rows[0]
  // Also cap guesses per account, across all its pending codes.
  if (throttled(`code-user:${row.user_id}`, 10)) throw new HttpError(429, 'too_many_requests')
  if (!safeEqual(hmac(`${attempt}:${code}`), row.code_hash)) {
    throw badRequest(row.code_attempts >= config.codeMaxAttempts ? 'code_locked' : 'invalid_code')
  }
  await signIn(req, res, attempt)
})

authRouter.post('/verify', async (req, res) => {
  if (throttled(`verify-ip:${clientKey(req.ip)}`, 30)) throw new HttpError(429, 'too_many_requests')
  const token = String(req.body?.token || '')
  if (!token || token.length > 100) throw badRequest('invalid_token')
  const magic: any = await MagicToken.findOne({ where: { token_hash: sha256(token) } })
  if (!magic) throw badRequest('invalid_token')
  await signIn(req, res, magic.id)
})

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ user: await serializeUser((req as any).user) })
})

/** This device only. */
authRouter.post('/logout', async (_req, res) => {
  res.clearCookie(COOKIE, { path: '/' })
  res.json({ ok: true })
})

/** Every device: invalidates all the user's sessions, including this one. */
authRouter.post('/logout-all', requireAuth, async (req: any, res) => {
  await req.user.increment('session_version')
  res.clearCookie(COOKIE, { path: '/' })
  res.json({ ok: true })
})
