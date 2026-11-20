// Progressive Web App helpers: install state, install prompt, service worker updates, offline status.
import { reactive } from 'vue'

// Must match app/sw.js
export const API_CACHE = 'collector-api'
export const COVERS_CACHE = 'collector-covers'

export const pwa = reactive({
  /** Running as an installed app (home screen / app window). */
  installed: isStandalone(),
  /** Android / desktop Chrome: deferred native install prompt. */
  promptEvent: null,
  /** A new version is installed and waiting: reload to use it. */
  updateReady: false,
  online: navigator.onLine,
})

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

/** iPhone / iPad Safari: no install prompt, the user must use Share → Add to Home Screen. */
export function isIosSafari() {
  const ua = navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
}

/** Can we offer installation from inside the app? */
export function canInstall() {
  return !pwa.installed && (!!pwa.promptEvent || isIosSafari())
}

export async function promptInstall() {
  const event = pwa.promptEvent
  if (!event) return false
  pwa.promptEvent = null
  event.prompt()
  const { outcome } = await event.userChoice
  return outcome === 'accepted'
}

let waitingWorker = null

/** Activates the waiting service worker; the page reloads once it controls it. */
export function applyUpdate() {
  waitingWorker?.postMessage('skip-waiting')
}

/** Cached API responses and covers belong to the signed-in user: dropped on logout. */
export async function clearPrivateCaches() {
  try {
    await caches.delete(API_CACHE)
    await caches.delete(COVERS_CACHE)
  } catch {}
}

export function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    pwa.promptEvent = e
  })
  window.addEventListener('appinstalled', () => {
    pwa.installed = true
    pwa.promptEvent = null
  })
  window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => { pwa.installed = e.matches })
  window.addEventListener('online', () => { pwa.online = true })
  window.addEventListener('offline', () => { pwa.online = false })

  // Service worker: production builds only (in dev it would cache modules and fight HMR).
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    const track = (worker) => {
      worker?.addEventListener('statechange', () => {
        // Installed while another version controls the page: a real update, not the first install.
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          waitingWorker = worker
          pwa.updateReady = true
        }
      })
    }
    if (reg.waiting && navigator.serviceWorker.controller) {
      waitingWorker = reg.waiting
      pwa.updateReady = true
    }
    reg.addEventListener('updatefound', () => track(reg.installing))
    // Installed apps can stay open for days: check for new versions now and then.
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
  }).catch(() => {})

  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })
}
