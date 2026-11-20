import { createI18n } from 'vue-i18n'
import en from './en.js'
import fr from './fr.js'

export const LOCALES = [
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
]

function initialLocale() {
  try {
    const saved = localStorage.getItem('collector.locale')
    if (saved) return saved
  } catch {}
  return navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: initialLocale(),
  fallbackLocale: 'en',
  messages: { en, fr },
  missingWarn: false,
  fallbackWarn: false,
})

export function setLocale(locale) {
  if (!['en', 'fr'].includes(locale)) return
  i18n.global.locale.value = locale
  document.documentElement.lang = locale
  try { localStorage.setItem('collector.locale', locale) } catch {}
}
