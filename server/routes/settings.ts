import { Router } from 'express'
import { describeConnectors, CONNECTORS } from '../connectors/index.ts'
import { readSecrets, writeSecrets } from '../lib/secrets.ts'
import { mask } from '../lib/crypto.ts'
import { PROVIDERS, providerOf, testConnection, llmEnabled } from '../lib/ai.ts'
import { badRequest } from '../lib/http.ts'
import { MEDIA_TYPES, userPrefs } from '../../shared/media.js'
import { serializeUser } from './serializers.ts'

export const settingsRouter = Router()

const KEY_IDS = new Set(CONNECTORS.flatMap((c) => c.keys.map((k) => k.id)))

async function state(user: any) {
  const { keys, llm } = readSecrets(user)
  return {
    user: await serializeUser(user),
    connectors: describeConnectors(keys),
    keys: Object.fromEntries([...KEY_IDS].map((id) => [id, mask(keys[id])])),
    llm: { provider: providerOf(llm), baseUrl: llm.baseUrl || '', model: llm.model || '', apiKey: mask(llm.apiKey), enabled: llmEnabled(llm) },
    providers: Object.entries(PROVIDERS).map(([id, p]) => ({ id, ...p })),
  }
}

settingsRouter.get('/', async (req: any, res) => res.json(await state(req.user)))

settingsRouter.patch('/profile', async (req: any, res) => {
  const { name, locale, theme, types, startType } = req.body || {}
  const patch: any = {}
  if (name !== undefined) patch.name = String(name).trim().slice(0, 80) || null
  if (locale !== undefined) {
    if (!['en', 'fr'].includes(locale)) throw badRequest('invalid_locale')
    patch.locale = locale
  }
  if (theme !== undefined) {
    if (!['auto', 'light', 'dark'].includes(theme)) throw badRequest('invalid_theme')
    patch.theme = theme
  }
  if (types !== undefined || startType !== undefined) {
    const current = userPrefs(req.user.prefs)
    const next = { ...current }
    if (types !== undefined) {
      if (!Array.isArray(types) || !types.length || types.some((t) => !MEDIA_TYPES.includes(t))) throw badRequest('invalid_types')
      next.types = types
    }
    if (startType !== undefined) {
      if (!MEDIA_TYPES.includes(startType)) throw badRequest('invalid_start_type')
      next.startType = startType
    }
    // Normalises order and keeps the start collection among the enabled ones.
    patch.prefs = userPrefs(next)
  }
  await req.user.update(patch)
  res.json(await state(req.user))
})

/** Body: { keys: { tmdb: 'abc' | null } } — null/'' removes a key, missing keys are untouched. */
settingsRouter.patch('/keys', async (req: any, res) => {
  const secrets = readSecrets(req.user)
  for (const [id, value] of Object.entries(req.body?.keys || {})) {
    if (!KEY_IDS.has(id)) continue
    const v = typeof value === 'string' ? value.trim() : ''
    if (v) secrets.keys[id] = v
    else delete secrets.keys[id]
  }
  await writeSecrets(req.user, secrets)
  res.json(await state(req.user))
})

settingsRouter.patch('/llm', async (req: any, res) => {
  const secrets = readSecrets(req.user)
  const { provider, baseUrl, model, apiKey } = req.body || {}
  if (provider !== undefined) {
    if (!(provider in PROVIDERS)) throw badRequest('invalid_provider')
    secrets.llm.provider = provider
  }
  if (baseUrl !== undefined) {
    const v = String(baseUrl).trim()
    if (v && !/^https?:\/\//.test(v)) throw badRequest('invalid_url')
    secrets.llm.baseUrl = v || undefined
  }
  if (model !== undefined) secrets.llm.model = String(model).trim() || undefined
  if (apiKey !== undefined) secrets.llm.apiKey = String(apiKey || '').trim() || undefined
  await writeSecrets(req.user, secrets)
  res.json(await state(req.user))
})

settingsRouter.post('/llm/test', async (req: any, res) => {
  const { llm } = readSecrets(req.user)
  if (!llmEnabled(llm)) throw badRequest('llm_not_configured')
  const started = Date.now()
  try {
    const reply = await testConnection(llm)
    res.json({ ok: true, reply: reply.trim().slice(0, 80), ms: Date.now() - started })
  } catch (e: any) {
    res.json({ ok: false, error: e.message })
  }
})
