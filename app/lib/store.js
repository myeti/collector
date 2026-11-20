import { reactive } from 'vue'
import { api } from './api.js'
import { setLocale } from '../i18n/index.js'
import { clearPrivateCaches } from './pwa.js'
import { MEDIA, MEDIA_TYPES, DEFAULT_TYPES, DEFAULT_START_TYPE } from '../../shared/media.js'

// One color per media: the whole UI takes the accent of the selected shelf.
export const ACCENTS = {
  book: { color: '#b26ee0', glow: '#7c3aad', on: '#ffffff', hue: 280 }, // warm purple
  music: { color: '#e8701e', glow: '#b4470c', on: '#ffffff', hue: 24 }, // dark orange
  movie: { color: '#2e9e5e', glow: '#1b6b3c', on: '#ffffff', hue: 145 }, // forest green
  videogame: { color: '#22c8e0', glow: '#0e8fa8', on: '#06232a', hue: 189 }, // cyan
  custom: { color: '#c9a227', glow: '#8f6f12', on: '#1d1604', hue: 46 }, // antique gold
}

function load(key, fallback) {
  try { return localStorage.getItem(key) || fallback } catch { return fallback }
}
function persist(key, value) {
  try { localStorage.setItem(key, value) } catch {}
}

export const store = reactive({
  user: null,
  ready: false,
  stats: Object.fromEntries(MEDIA_TYPES.map((t) => [t, { count: 0, consumed: 0 }])),
  // Current collection: starts on the user's startup collection (see openStartType).
  type: DEFAULT_START_TYPE,
  view: load('collector.view', 'grid'),
  llmEnabled: false,
  /** Fields chosen in the cherry-picker, consumed by the item form. */
  draft: null,
  addOpen: false,

  async init() {
    try {
      const { user } = await api.get('/auth/me')
      this.setUser(user)
      this.openStartType()
      this.refreshStats()
      this.refreshLlm()
    } catch {
      this.user = null
    }
    this.ready = true
  },

  setUser(user) {
    // Another account on this device: never show the previous one's cached collection.
    if (user && this.user && user.id !== this.user.id) clearPrivateCaches()
    this.user = user
    if (user) {
      setLocale(user.locale)
      this.applyTheme(user.theme)
    }
  },

  async refreshStats() {
    if (!this.user) return
    const { stats } = await api.get('/items/stats').catch(() => ({ stats: null }))
    if (stats) this.stats = stats
  },

  async refreshLlm() {
    const s = await api.get('/settings').catch(() => null)
    this.llmEnabled = !!s?.llm?.enabled
  },

  /** Collections shown in the interface (UI preference, items of hidden ones are kept). */
  get enabledTypes() {
    return this.user?.prefs?.types || DEFAULT_TYPES
  },

  get startType() {
    return this.user?.prefs?.startType || DEFAULT_START_TYPE
  },

  openStartType() {
    this.setType(this.startType)
  },

  setType(type) {
    if (!MEDIA[type]) return
    this.type = type
    this.applyAccent()
  },

  setView(view) {
    this.view = view
    persist('collector.view', view)
  },

  applyAccent(type = this.type) {
    const a = ACCENTS[type] || ACCENTS.custom
    const root = document.documentElement.style
    root.setProperty('--accent', a.color)
    root.setProperty('--accent-glow', a.glow)
    root.setProperty('--on-accent', a.on)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', a.glow)
  },

  applyTheme(theme = 'auto') {
    document.documentElement.dataset.theme = theme
  },

  /** Signs out every device of this account (all sessions are revoked server-side). */
  async logoutEverywhere() {
    await api.post('/auth/logout-all').catch(() => {})
    await clearPrivateCaches()
    this.user = null
  },

  async logout() {
    await api.post('/auth/logout').catch(() => {})
    await clearPrivateCaches()
    this.user = null
  },
})
