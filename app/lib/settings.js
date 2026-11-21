// Settings payload (/api/settings), shared by the settings subpages: loaded once by the layout.
import { reactive } from 'vue'
import { api } from './api.js'
import { store } from './store.js'
import { toast, toastError } from './toast.js'
import { i18n } from '../i18n/index.js'

export const settings = reactive({ s: null })

export function applySettings(s) {
  settings.s = s
  store.setUser(s.user)
}

export async function loadSettings() {
  try {
    applySettings(await api.get('/settings'))
  } catch (e) {
    toastError(e)
  }
}

export async function saveProfile(patch) {
  try {
    applySettings(await api.patch('/settings/profile', patch))
    toast(i18n.global.t('settings.saved'))
  } catch (e) {
    toastError(e)
  }
}
