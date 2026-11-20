// Fetching URLs that users control (cover images) without letting them reach internal services (SSRF):
// every resolved address is checked at connection time (no DNS-rebinding window), redirects are
// re-validated, and the body is capped while streaming.
import http from 'node:http'
import https from 'node:https'
import dns from 'node:dns'
import net from 'node:net'
import { Agent, fetch as undiciFetch } from 'undici'

const blocked = new net.BlockList()
for (const [subnet, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(subnet, prefix, 'ipv4')
for (const [subnet, prefix] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96], ['2001:db8::', 32]] as const) {
  blocked.addSubnet(subnet, prefix, 'ipv6')
}

export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address)
  if (family === 4) return !blocked.check(address, 'ipv4')
  if (family === 6) {
    const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i) // IPv4-mapped IPv6
    if (mapped) return isPublicAddress(mapped[1])
    return !blocked.check(address, 'ipv6')
  }
  return false
}

/** dns.lookup replacement used by the socket itself: refuses non-public addresses. */
const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses: any) => {
    if (err) return callback(err, '', 4)
    const list = (addresses as dns.LookupAddress[]).filter((a) => isPublicAddress(a.address))
    if (!list.length) return callback(Object.assign(new Error(`Blocked address for ${hostname}`), { code: 'EBLOCKED' }), '', 4)
    if ((options as any).all) return (callback as any)(null, list)
    callback(null, list[0].address, list[0].family)
  })
}

/**
 * fetch() that only reaches public addresses and never follows redirects: for third-party SDKs that accept
 * a custom fetch (AI providers) when the base URL is user-provided.
 */
const publicAgent = new Agent({ connect: { lookup: guardedLookup } })
export const publicFetch = (async (input: any, init?: any) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url)
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (!['http:', 'https:'].includes(url.protocol) || (net.isIP(host) && !isPublicAddress(host))) {
    throw new Error('Blocked address')
  }
  return undiciFetch(input, { ...init, dispatcher: publicAgent, redirect: 'manual' })
}) as unknown as typeof fetch

export interface SafeFetchOptions {
  maxBytes: number
  timeoutMs?: number
  maxRedirects?: number
  /** Response content types to accept, e.g. /^image\// */
  accept?: RegExp
}

export async function safeFetch(rawUrl: string, opts: SafeFetchOptions): Promise<{ body: Buffer; contentType: string }> {
  let url = new URL(rawUrl)
  for (let hop = 0; hop <= (opts.maxRedirects ?? 3); hop++) {
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Unsupported URL')
    // Literal IPs never go through lookup(): check them here.
    const host = url.hostname.replace(/^\[|\]$/g, '')
    if (net.isIP(host) && !isPublicAddress(host)) throw new Error('Blocked address')

    const res = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const req = (url.protocol === 'https:' ? https : http).get(url, {
        lookup: guardedLookup,
        headers: { 'User-Agent': 'Collector/0.1', Accept: 'image/*' },
        timeout: opts.timeoutMs ?? 15_000,
      }, resolve)
      req.on('timeout', () => req.destroy(new Error('Timeout')))
      req.on('error', reject)
    })

    const status = res.statusCode || 0
    if (status >= 300 && status < 400 && res.headers.location) {
      res.resume()
      url = new URL(res.headers.location, url)
      continue
    }
    if (status !== 200) {
      res.resume()
      throw new Error(`HTTP ${status}`)
    }
    const contentType = String(res.headers['content-type'] || '')
    if (opts.accept && !opts.accept.test(contentType)) {
      res.resume()
      throw new Error(`Unexpected content type ${contentType}`)
    }
    if (Number(res.headers['content-length'] || 0) > opts.maxBytes) {
      res.destroy()
      throw new Error('Too large')
    }
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of res) {
      size += chunk.length
      if (size > opts.maxBytes) {
        res.destroy()
        throw new Error('Too large')
      }
      chunks.push(chunk)
    }
    return { body: Buffer.concat(chunks), contentType }
  }
  throw new Error('Too many redirects')
}
