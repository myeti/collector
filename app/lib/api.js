import { i18n } from '../i18n/index.js'

export class ApiError extends Error {
  constructor(status, code, message, { ref, detail } = {}) {
    super(message || code)
    this.status = status
    this.code = code
    this.ref = ref // server errors: the reference in the server log
    this.detail = detail // server errors: what went wrong (signed-in users)
  }

  /** Human, translated message. */
  get human() {
    const t = i18n.global.t
    const key = `errors.${this.code}`
    const text = i18n.global.te(key) ? t(key) : this.message && this.message !== this.code ? this.message : t('errors.generic')
    // Server errors: the reference to quote when reporting it (details in the console and the server log)
    return this.ref ? `${text} (ref ${this.ref})` : text
  }
}

let onUnauthorized = () => {}
export function setUnauthorizedHandler(fn) { onUnauthorized = fn }

async function request(method, url, body) {
  const init = { method, headers: {}, credentials: 'same-origin' }
  if (body instanceof FormData) init.body = body
  else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  let res
  try {
    res = await fetch(`/api${url}`, init)
  } catch (e) {
    console.error(`[api] ${method} /api${url} → network error`, e)
    throw new ApiError(0, 'network')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/auth/')) onUnauthorized()
    // Every failure in the console, with what the server said (a 401 is just "signed out": not an error)
    if (res.status !== 401) {
      const log = res.status >= 500 ? console.error : console.warn
      log(`[api] ${method} /api${url} → ${res.status} ${data.error || res.statusText}${data.ref ? ` (ref ${data.ref})` : ''}`, data.detail || data.message || '')
    }
    throw new ApiError(res.status, data.error || 'generic', data.message, { ref: data.ref, detail: data.detail })
  }
  return data
}

export function qs(params) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, v)
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
  put: (url, body) => request('PUT', url, body),
  patch: (url, body) => request('PATCH', url, body),
  delete: (url) => request('DELETE', url),
}
