export class HttpError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message?: string) {
    super(message || code)
    this.status = status
    this.code = code
  }
}

export const notFound = (code = 'not_found') => new HttpError(404, code)
export const badRequest = (code = 'bad_request', message?: string) => new HttpError(400, code, message)
export const forbidden = (code = 'forbidden') => new HttpError(403, code)

/** fetch() with timeout + JSON parsing; throws on non-2xx. */
export async function fetchJson(url: string, init: RequestInit & { timeout?: number } = {}): Promise<any> {
  const { timeout = 8000, ...rest } = init
  const res = await fetch(url, {
    ...rest,
    headers: { 'User-Agent': 'Collector/0.1 (personal collection manager)', Accept: 'application/json', ...(rest.headers || {}) },
    signal: AbortSignal.timeout(timeout),
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${new URL(url).host}`)
  return res.json()
}
