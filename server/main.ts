import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import express from 'express'
import crypto from 'node:crypto'
import type { Response, NextFunction } from 'express'
import cookieParser from 'cookie-parser'
import { config } from './config.ts'
import { syncDb } from './db.ts'
import { HttpError } from './lib/http.ts'
import { authRouter, loadSession, requireAuth } from './routes/auth.ts'
import { itemsRouter } from './routes/items.ts'
import { lookupRouter } from './routes/lookup.ts'
import { uploadsRouter } from './routes/uploads.ts'
import { familyRouter } from './routes/family.ts'
import { settingsRouter } from './routes/settings.ts'
import { importRouter } from './routes/import.ts'
import { coversRouter } from './routes/covers.ts'

const app = express()
// Client IPs (rate limits) come from X-Forwarded-For only when the request arrives through a proxy on this
// machine or a private network (nginx, Docker): a client connecting directly cannot spoof its address.
app.set('trust proxy', 'loopback, linklocal, uniquelocal')
app.disable('x-powered-by')
// Security headers. The CSP only in production: the Vite dev server injects inline scripts and websockets.
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
  // Covers proposed by metadata sources are shown straight from their https URLs until saved.
  "img-src 'self' data: blob: https:", "font-src 'self' data:", "connect-src 'self'", "worker-src 'self'",
  "manifest-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
].join('; ')
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=()')
  if (config.production) {
    res.setHeader('Content-Security-Policy', CSP)
    if (config.publicUrl.startsWith('https://')) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  next()
})

// CSRF defense in depth (the session cookie is already SameSite=Lax): a state-changing API call
// coming from another site's page carries its Origin, which must be ours.
const publicOrigin = new URL(config.publicUrl).origin
app.use('/api', (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const origin = req.get('origin')
  if (!origin) return next() // not a browser cross-site request (curl, server-to-server)
  const sameHost = (() => { try { return new URL(origin).host === req.get('host') } catch { return false } })()
  if (origin === publicOrigin || sameHost) return next()
  next(new HttpError(403, 'forbidden_origin'))
})

// Imports send a whole library at once; everything else stays small.
app.use('/api/import', express.json({ limit: '10mb' }))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
app.use(loadSession)

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRouter)
app.use('/api/items', requireAuth, itemsRouter)
app.use('/api/lookup', requireAuth, lookupRouter)
app.use('/api/uploads', requireAuth, uploadsRouter)
app.use('/api/family', requireAuth, familyRouter)
app.use('/api/settings', requireAuth, settingsRouter)
app.use('/api/import', requireAuth, importRouter)
app.use('/api/covers', requireAuth, coversRouter)
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'not_found')))

// Covers are private to signed-in users.
app.use('/uploads', requireAuth, express.static(config.uploadDir, {
  // private: a CDN or shared proxy must never serve a cover to someone else
  setHeaders: (res) => res.setHeader('Cache-Control', 'private, max-age=2592000, immutable'),
}))

// Built frontend (npm run build) + SPA fallback.
const dist = path.resolve('dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist, {
    index: false,
    setHeaders(res, file) {
      // Hashed build files never change; the service worker, manifest and page must always be revalidated.
      if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      else if (/(sw\.js|manifest\.webmanifest|index\.html)$/.test(file)) res.setHeader('Cache-Control', 'no-cache')
      else res.setHeader('Cache-Control', 'public, max-age=3600')
    },
  }))
  app.use((req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) || req.path.startsWith('/uploads/')) return next()
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(path.join(dist, 'index.html'))
  })
}

app.use((err: any, req: any, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, message: err.message })
  if (err?.name === 'MulterError') return res.status(400).json({ error: 'upload_error', message: err.message })
  if (err?.name === 'SequelizeValidationError') return res.status(400).json({ error: 'validation_error', message: err.message })
  if (err?.status && err.status < 500) return res.status(err.status).json({ error: 'bad_request', message: err.message })
  // A reference ties what the user sees (browser console) to the server log line
  const ref = crypto.randomBytes(4).toString('hex')
  console.error(`💥 [${ref}] ${req.method} ${req.originalUrl}${req.user ? ` (user ${req.user.id})` : ''}`, err)
  // Signed-in users also get the cause: enough to report a problem without access to the server logs
  res.status(500).json({ error: 'server_error', ref, detail: req.user ? String(err?.message || err).slice(0, 500) : undefined })
})

try {
  await syncDb({ alter: process.env.DB_SYNC === 'alter' })
} catch (e: any) {
  if (e.name === 'SequelizeConnectionRefusedError' || e.name === 'SequelizeConnectionError') {
    console.error(`❌ Cannot reach Postgres at ${config.db.host}:${config.db.port} — ${e.message || e.original?.code || e.name}`)
    console.error('   Start it with: docker compose up -d')
  } else {
    console.error('❌ Database setup failed:', e)
  }
  process.exit(1)
}

app.listen(config.port, () => {
  console.log(`✨ Collector API on http://localhost:${config.port} (public: ${config.publicUrl})`)
  if (!config.production) {
    // Dev: addresses to open from another device of the LAN (the app proxies /api to this server).
    const lan = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal)
    const scheme = process.env.DEV_HTTPS === '1' ? 'https' : 'http'
    for (const i of lan) console.log(`   LAN: app ${scheme}://${i!.address}:5173 · api http://${i!.address}:${config.port}`)
  }
})
