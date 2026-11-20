import path from 'node:path'

const env = process.env
const production = env.NODE_ENV === 'production'

const REQUIRED = [
  'PORT', 'JWT_SECRET', 'PUBLIC_URL',
  'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM',
]

const missing = REQUIRED.filter((k) => env[k] === undefined)
if (missing.length) {
  const msg = `Missing environment variables: ${missing.join(', ')}`
  if (production) {
    console.error(`❌ ${msg}`)
    process.exit(1)
  }
  console.warn(`⚠️  ${msg} (dev defaults used)`)
}

// A short secret makes session tokens forgeable and stored API keys decryptable.
const weakSecrets = ['dev-secret-change-me', 'change-me-to-a-long-random-string', 'change-me-to-a-long-random-string-of-32-chars-at-least']
if (production && ((env.JWT_SECRET || '').length < 32 || weakSecrets.includes(env.JWT_SECRET!))) {
  console.error('❌ JWT_SECRET must be a random value of at least 32 characters, not the example (openssl rand -base64 48)')
  process.exit(1)
}

export const config = {
  production,
  port: Number(env.PORT || 3000),
  publicUrl: (env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, ''),
  jwtSecret: env.JWT_SECRET || 'dev-secret-change-me',
  // Not mandatory: where cover images are stored.
  uploadDir: path.resolve(env.UPLOAD_DIR || './uploads'),
  sessionDays: 60,
  // Installed (PWA) sessions: signing in again on a phone app is tedious
  installedSessionDays: 365,
  codeMaxAttempts: 5,
  magicLinkMinutes: 15,
  db: {
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 5432),
    name: env.DB_NAME || 'collector',
    user: env.DB_USER || 'collector',
    password: env.DB_PASSWORD || '',
  },
  smtp: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT || 587),
    user: env.SMTP_USER || '',
    password: env.SMTP_PASSWORD || '',
    from: env.SMTP_FROM || 'Collector <no-reply@localhost>',
  },
}
