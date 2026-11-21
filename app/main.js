import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import VueFeather from 'vue-feather'
import '@fontsource-variable/inter'
import '@fontsource/tilt-neon'
import './styles/main.css'

import App from './App.vue'
import { i18n } from './i18n/index.js'
import { store } from './lib/store.js'
import { setUnauthorizedHandler } from './lib/api.js'
import { initPwa, clearPrivateCaches } from './lib/pwa.js'
import { MEDIA } from '../shared/media.js'

const routes = [
  // beforeEnter (not redirect): it runs after the global guard has loaded the user and their startup collection.
  { path: '/', component: { render: () => null }, beforeEnter: () => `/c/${store.type}` },
  { path: '/login', component: () => import('./views/LoginView.vue'), meta: { public: true } },
  { path: '/auth/verify', component: () => import('./views/VerifyView.vue'), meta: { public: true } },
  { path: '/c/:type', name: 'library', component: () => import('./views/LibraryView.vue') },
  { path: '/item/:id', name: 'item', component: () => import('./views/ItemView.vue') },
  { path: '/item/:id/edit', name: 'edit', component: () => import('./views/ItemFormView.vue') },
  { path: '/new/:type', name: 'new', component: () => import('./views/ItemFormView.vue') },
  { path: '/add/:type/review', name: 'review', component: () => import('./views/ReviewView.vue') },
  { path: '/add/:type/:mode(scan|search|photo)', name: 'add', component: () => import('./views/AddView.vue') },
  { path: '/bulk/:type', redirect: (to) => `/add/${to.params.type}/photo` },
  { path: '/family', redirect: '/settings/account' },
  // Home-screen shortcut (manifest): straight to the scanner of the current collection.
  { path: '/scan', component: { render: () => null }, beforeEnter: () => `/add/${store.type}/scan` },
  {
    path: '/settings',
    component: () => import('./views/settings/SettingsLayout.vue'),
    children: [
      { path: '', component: { render: () => null } }, // the menu (phones); desktop opens Account
      { path: 'account', component: () => import('./views/settings/AccountSettings.vue') },
      { path: 'sources', component: () => import('./views/settings/SourcesSettings.vue') },
      { path: 'import', component: () => import('./views/settings/ImportSettings.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, from, saved) => saved || (to.path === from.path ? undefined : { top: 0 }),
})

router.beforeEach(async (to) => {
  if (!store.ready) await store.init()
  if (!to.meta.public && !store.user) return { path: '/login', query: to.fullPath !== '/' ? { next: to.fullPath } : {} }
  if (to.path === '/login' && store.user) return '/'
  const type = to.params.type
  if (type) {
    if (!MEDIA[type]) return '/'
    // Hidden collections have no shelf page (their items stay reachable by link).
    if (to.name === 'library' && !store.enabledTypes.includes(type)) return `/c/${store.startType}`
    store.setType(type)
  }
})

setUnauthorizedHandler(() => {
  // Session expired or revoked: the cached data belonged to that session.
  clearPrivateCaches()
  store.user = null
  if (!router.currentRoute.value.meta.public) router.push('/login')
})

store.applyAccent()
initPwa()

createApp(App)
  .use(router)
  .use(i18n)
  .component('VueFeather', VueFeather)
  .mount('#app')
