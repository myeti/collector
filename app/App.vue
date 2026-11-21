<template>
  <div class="aurora" aria-hidden="true"><span></span><i></i></div>

  <!-- Until then, the splash of index.html covers the page -->
  <template v-if="store.ready">
    <aside v-if="chrome" class="sidebar">
      <router-link :to="`/c/${store.type}`" class="brand">
        <AppLogo class="mark" neon tight :size="26" :stroke-width="1.4" />
        <span class="neon-title">{{ $t('app.name') }}</span>
      </router-link>

      <MediaSwitcher vertical :types="store.enabledTypes" :model-value="store.type" @update:model-value="goType" />

      <button class="btn primary block" @click="store.addOpen = true">
        <vue-feather type="plus" size="16" /> {{ $t('nav.add') }}
      </button>

      <!-- Bottom of the sidebar: settings, then the user card -->
      <nav class="side-links">
        <router-link to="/settings"><vue-feather type="sliders" size="16" /> {{ $t('nav.settings') }}</router-link>
      </nav>

      <div class="me">
        <div class="avatar">{{ initials }}</div>
        <div class="grow">
          <div class="truncate name">{{ store.user.name || store.user.email }}</div>
          <div class="truncate faint small">{{ store.user.family?.name || store.user.email }}</div>
        </div>
        <button class="icon-btn sm plain" :title="$t('nav.logout')" @click="logout">
          <vue-feather type="log-out" size="16" />
        </button>
      </div>
    </aside>

    <main :class="{ 'has-sidebar': chrome }">
      <router-view v-slot="{ Component, route }">
        <transition name="fade" mode="out-in">
          <component :is="Component" :key="route.name === 'library' ? 'library' : route.path" />
        </transition>
      </router-view>
    </main>

    <nav v-if="chrome" class="bottom-nav glass" :style="{ gridTemplateColumns: `repeat(${store.enabledTypes.length + 1}, 1fr)` }">
      <button
        v-for="t in store.enabledTypes" :key="t" :class="{ on: $route.name === 'library' && store.type === t }"
        :style="{ '--c': ACCENTS[t].color }" @click="goType(t)"
      >
        <vue-feather :type="MEDIA[t].icon" size="19" /><span>{{ $t(`media.${t}`) }}</span>
      </button>
      <router-link to="/settings">
        <vue-feather type="sliders" size="19" /><span>{{ $t('nav.settings') }}</span>
      </router-link>
    </nav>

    <transition name="pop">
      <button v-if="chrome && $route.name === 'library'" class="fab" :aria-label="$t('nav.add')" @click="store.addOpen = true">
        <vue-feather type="plus" size="22" />
      </button>
    </transition>

    <transition name="pop">
      <AddSheet v-if="store.addOpen" @close="store.addOpen = false" />
    </transition>
  </template>

  <PwaStatus />
  <Toasts />
</template>

<script>
import { store, ACCENTS } from './lib/store.js'
import { MEDIA } from '../shared/media.js'
import MediaSwitcher from './components/MediaSwitcher.vue'
import AddSheet from './components/AddSheet.vue'
import AppLogo from './components/AppLogo.vue'
import PwaStatus from './components/PwaStatus.vue'
import Toasts from './components/Toasts.vue'
import { hideSplash } from './lib/splash.js'

export default {
  name: 'App',
  components: { MediaSwitcher, AddSheet, Toasts, AppLogo, PwaStatus },
  data: () => ({ store, MEDIA, ACCENTS }),
  computed: {
    chrome() {
      return !!store.user && !this.$route.meta.public
    },
    initials() {
      const n = store.user?.name || store.user?.email || '?'
      return n.split(/[\s@.]+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
    },
  },
  mounted() {
    // The first navigation waits for the session check: the first page is ready to show.
    this.$router.isReady().catch(() => {}).finally(() => this.$nextTick(hideSplash))
  },
  methods: {
    goType(type) {
      this.$router.push({ path: `/c/${type}`, query: this.$route.name === 'library' ? { q: this.$route.query.q } : {} })
    },
    async logout() {
      await store.logout()
      this.$router.push('/login')
    },
  },
}
</script>

<style scoped>

.sidebar {
  position: fixed; inset: 0 auto 0 0; width: var(--sidebar); padding: 18px 12px 12px; display: none;
  flex-direction: column; gap: 14px; border-right: 1px solid var(--border); background: var(--bg-2);
  z-index: 20; overflow-y: auto;
}
/* Short windows: the sidebar scrolls instead of squashing its items */
.sidebar > * { flex-shrink: 0; }
.brand { display: flex; align-items: center; gap: 10px; font-size: 19px; padding: 2px 8px 4px; }
.brand .mark { flex: none; transition: transform 0.4s var(--spring); }
.brand:hover .mark { transform: rotate(-8deg) scale(1.06); }
.side-links { display: flex; flex-direction: column; gap: 1px; }
.side-links a {
  display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 10px; border-radius: var(--r); color: var(--muted);
  font-weight: 550; font-size: 13.5px; transition: background 0.15s, color 0.15s;
}
.side-links a:hover { background: var(--surface-2); color: var(--text); }
.side-links a.router-link-active { background: var(--surface-2); color: var(--text); }
.side-links { margin-top: auto; }
.me { display: flex; align-items: center; gap: 9px; padding: 8px; border-radius: var(--r-md); border: 1px solid var(--border); }
.avatar {
  width: 28px; height: 28px; border-radius: var(--r-sm); display: grid; place-items: center; font-size: 11.5px; font-weight: 700; flex: none;
  background: var(--accent); color: var(--on-accent);
}
.name { font-weight: 600; font-size: 13px; }
.small { font-size: 11.5px; }

main { min-height: 100vh; min-height: 100dvh; }

.bottom-nav {
  position: fixed; left: 0; right: 0; bottom: 0; height: calc(var(--bottom-nav) + var(--safe-bottom)); padding-bottom: var(--safe-bottom);
  display: grid; grid-template-columns: repeat(5, 1fr); align-items: center; z-index: 30;
  border-radius: 0; border-width: 1px 0 0; background: color-mix(in oklab, var(--bg-2) 90%, transparent);
}
.bottom-nav a, .bottom-nav button {
  position: relative; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  font-size: 10px; font-weight: 600; color: var(--faint); background: none; border: 0; padding: 0;
  transition: color 0.2s, transform 0.15s var(--ease);
}
.bottom-nav a:active, .bottom-nav button:active { transform: scale(0.92); }
.bottom-nav button.on { color: var(--c); }
.bottom-nav button.on::before {
  content: ''; position: absolute; top: -1px; left: 28%; right: 28%; height: 2px; border-radius: 0 0 2px 2px;
  background: var(--c); box-shadow: 0 0 12px var(--c);
}
.bottom-nav a.router-link-active { color: var(--text); }
:root[data-theme='light'] .bottom-nav button.on { color: color-mix(in oklab, var(--c) 70%, #18181b); }
.fab {
  position: fixed; right: 16px; bottom: calc(var(--bottom-nav) + var(--quickbar, 0px) + 14px + var(--safe-bottom)); z-index: 31;
  width: 50px; height: 50px; border-radius: var(--r-lg); border: 0; display: grid; place-items: center;
  color: var(--on-accent); background: var(--accent);
  box-shadow: 0 12px 28px -8px var(--accent-glow), 0 2px 6px rgb(0 0 0 / 0.3), inset 0 1px 0 rgb(255 255 255 / 0.25);
  transition: transform 0.3s var(--spring), bottom 0.3s var(--ease);
}
.fab:hover { transform: rotate(90deg); }
.fab:active { transform: scale(0.9) rotate(90deg); }

@media (min-width: 900px) {
  .sidebar { display: flex; }
  main.has-sidebar { margin-left: var(--sidebar); }
  .bottom-nav, .fab { display: none; }
}
</style>
