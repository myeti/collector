/* Collector service worker. Built by vite.config.js (BUILD and PRECACHE are injected at build time). */
const BUILD = '__BUILD_ID__'
const PRECACHE = __PRECACHE__

const SHELL = `collector-shell-${BUILD}` // app shell of this build (index, scripts, styles, icons, fonts)
const COVERS = 'collector-covers' // cover images, cached as viewed
const API = 'collector-api' // last known API reads, for offline browsing (cleared on logout)
const OCR = 'collector-ocr' // the ISBN text reader's engine and model (versioned paths), kept across builds
const MAX_COVERS = 800

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(['/', '/manifest.webmanifest', '/favicon.svg', ...PRECACHE])),
  )
  // No skipWaiting here: an update waits until the user accepts it (see app/lib/pwa.js).
})

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('collector-shell-') && key !== SHELL) await caches.delete(key)
    }
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Pages: network first (fresh deploys), cached app shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL, '/'))
    return
  }
  // Hashed build files never change.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, SHELL))
    return
  }
  // OCR engine and model: large, versioned paths, so cache first (only the current version is kept).
  if (url.pathname.startsWith('/ocr/')) {
    const version = url.pathname.split('/')[2]
    event.respondWith(cacheFirst(request, OCR, async (cache) => {
      for (const key of await cache.keys()) if (new URL(key.url).pathname.split('/')[2] !== version) await cache.delete(key)
    }))
    return
  }
  // Covers have unique names: cache first.
  if (url.pathname.startsWith('/uploads/')) {
    event.respondWith(cacheFirst(request, COVERS, trimCovers))
    return
  }
  if (url.pathname.startsWith('/api/')) {
    // Online-only endpoints: lookups (external APIs), exports (a download) and auth flows. /auth/me is kept so the app boots offline.
    const online = url.pathname.startsWith('/api/lookup') || url.pathname.startsWith('/api/export') || (url.pathname.startsWith('/api/auth/') && url.pathname !== '/api/auth/me')
    if (!online) event.respondWith(networkFirst(request, API))
    return
  }
  // Other static files (icons, manifest, fonts): serve cached, refresh in the background.
  event.respondWith(staleWhileRevalidate(request, SHELL))
})

async function networkFirst(request, cacheName, cacheKey = request) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(cacheKey, response.clone())
    return response
  } catch (error) {
    const cached = await cache.match(cacheKey)
    if (cached) return cached
    throw error
  }
}

async function cacheFirst(request, cacheName, afterPut) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    await cache.put(request, response.clone())
    afterPut?.(cache)
  }
  return response
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const refresh = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone())
    return response
  }).catch(() => cached)
  return cached || refresh
}

async function trimCovers(cache) {
  const keys = await cache.keys()
  // Oldest entries first (insertion order).
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_COVERS))) await cache.delete(key)
}
