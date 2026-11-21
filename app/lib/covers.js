// "Find the covers": fills items saved without a cover, a few at a time, while the user keeps browsing.
// Progress shows in the app-wide status pill; each cover found is announced so open pages can show it.
import { reactive } from 'vue'
import { api } from './api.js'
import { toast, toastError } from './toast.js'
import { i18n } from '../i18n/index.js'

const BATCH = 4

export const coverJob = reactive({ running: false, stopping: false, total: 0, done: 0, found: 0 })

export async function findCovers(ids) {
  if (coverJob.running || !ids.length) return
  Object.assign(coverJob, { running: true, stopping: false, total: ids.length, done: 0, found: 0 })
  try {
    for (let i = 0; i < ids.length && !coverJob.stopping; i += BATCH) {
      const { results } = await api.post('/covers/fill', { ids: ids.slice(i, i + BATCH) })
      for (const r of results) {
        if (!r.cover) continue
        coverJob.found++
        window.dispatchEvent(new CustomEvent('collector:cover', { detail: r }))
      }
      coverJob.done = Math.min(ids.length, i + BATCH)
    }
    toast(i18n.global.t('covers.done', { found: coverJob.found, total: coverJob.done }), { icon: 'image', timeout: 5000 })
  } catch (e) {
    toastError(e)
  } finally {
    coverJob.running = false
  }
}

export function stopCovers() {
  coverJob.stopping = true
}
