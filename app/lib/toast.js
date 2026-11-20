import { reactive } from 'vue'

export const toasts = reactive([])
let seq = 0

export function toast(message, { type = 'success', icon, timeout = 3200 } = {}) {
  const id = ++seq
  toasts.push({ id, message, type, icon: icon || (type === 'error' ? 'alert-circle' : type === 'info' ? 'info' : 'check') })
  setTimeout(() => dismiss(id), timeout)
}

export function dismiss(id) {
  const i = toasts.findIndex((t) => t.id === id)
  if (i >= 0) toasts.splice(i, 1)
}

/** Shows an ApiError (or any error) as a toast. */
export function toastError(e) {
  toast(e?.human || e?.message || String(e), { type: 'error', timeout: 5000 })
}
