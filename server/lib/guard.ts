// Input validation and rate limiting shared by the public endpoints.
import net from 'node:net'

/**
 * Email check, linear time: the label classes exclude "." so the pattern cannot backtrack
 * (the naive /^[^\s@]+@[^\s@]+\.[^\s@]+$/ is quadratic and freezes the server on long inputs).
 */
export function isEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(value)
}

/** Rate-limit key for a client address: IPv6 clients are grouped by /64 (one subnet = one customer). */
export function clientKey(ip: string | undefined): string {
  const address = String(ip || '').replace(/^::ffff:/, '')
  if (net.isIPv6(address)) {
    const groups = address.split('::')[0].split(':')
    return `${groups.slice(0, 4).join(':')}::/64`
  }
  return address || 'unknown'
}

/** In-memory sliding-window limiter, swept regularly so it cannot grow without bound. */
const hits = new Map<string, number[]>()
const WINDOW = 15 * 60 * 1000

export function throttled(key: string, max: number, windowMs = WINDOW): boolean {
  const k = key.slice(0, 200)
  const now = Date.now()
  const list = (hits.get(k) || []).filter((t) => now - t < windowMs)
  list.push(now)
  hits.set(k, list)
  return list.length > max
}

setInterval(() => {
  const now = Date.now()
  for (const [k, list] of hits) if (!list.some((t) => now - t < WINDOW)) hits.delete(k)
}, 60_000).unref()
