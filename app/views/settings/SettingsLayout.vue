<template>
  <!-- Phones: the menu, then each subpage on its own. Desktop: the menu stays on the left. -->
  <div class="page settings" :class="{ sub: isSub }">
    <div class="page-head">
      <button class="icon-btn" :aria-label="$t('common.back')" @click="back"><vue-feather type="arrow-left" size="16" /></button>
      <h1 class="display grow">
        <span class="title-root">{{ $t('settings.title') }}</span>
        <span v-if="current" class="title-sub">{{ $t(`settings.pages.${current.id}.title`) }}</span>
      </h1>
    </div>

    <div class="layout">
      <nav class="menu">
        <router-link v-for="p in PAGES" :key="p.id" :to="`/settings/${p.id}`" class="entry">
          <span class="entry-ico"><vue-feather :type="p.icon" size="16" /></span>
          <span class="grow">
            <strong>{{ $t(`settings.pages.${p.id}.title`) }}</strong>
            <small>{{ $t(`settings.pages.${p.id}.text`) }}</small>
          </span>
          <vue-feather type="chevron-right" size="14" class="chev" />
        </router-link>

        <div class="session">
          <button class="btn ghost danger block" @click="logout">
            <vue-feather type="log-out" size="14" /> {{ $t('nav.logout') }}
          </button>
          <p v-if="store.user" class="who faint truncate">{{ store.user.email }}</p>
          <button class="btn ghost sm block everywhere" @click="logoutEverywhere">
            <vue-feather type="shield-off" size="13" /> {{ $t('settings.logoutEverywhere') }}
          </button>
          <p class="version">Collector v{{ version }}</p>
        </div>
      </nav>

      <main v-if="isSub" class="content">
        <div v-if="!settings.s" class="skeleton" style="height: 260px"></div>
        <router-view v-else v-slot="{ Component }">
          <transition name="fade" mode="out-in"><component :is="Component" /></transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script>
import { store } from '../../lib/store.js'
import { settings, loadSettings } from '../../lib/settings.js'

const PAGES = [
  { id: 'account', icon: 'user' },
  { id: 'sources', icon: 'database' },
  { id: 'import', icon: 'upload' },
]
const desktop = () => window.matchMedia('(min-width: 900px)').matches

export default {
  name: 'SettingsLayout',
  data: () => ({ store, settings, PAGES, version: __APP_VERSION__ }),
  computed: {
    current() { return PAGES.find((p) => this.$route.path === `/settings/${p.id}`) || null },
    isSub() { return !!this.current },
  },
  watch: {
    // Desktop has room for both: open the first page instead of an empty panel.
    '$route.path': { immediate: true, handler() { if (!this.isSub && desktop()) this.$router.replace('/settings/account') } },
  },
  mounted() {
    loadSettings()
  },
  methods: {
    back() {
      if (this.isSub && !desktop()) return this.$router.push('/settings')
      this.$router.push(`/c/${store.type}`)
    },
    async logout() {
      await store.logout()
      this.$router.push('/login')
    },
    async logoutEverywhere() {
      if (!confirm(this.$t('settings.logoutEverywhereConfirm'))) return
      await store.logoutEverywhere()
      this.$router.push('/login')
    },
  },
}
</script>

<style scoped>
.settings { max-width: 1080px; }
.title-sub { display: none; }
.layout { display: grid; gap: 20px; align-items: start; }

.menu { display: flex; flex-direction: column; gap: 6px; }
.entry {
  display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: var(--r-md); border: 1px solid var(--border);
  background: var(--surface); transition: all 0.15s;
}
.entry:hover { border-color: var(--border-strong); }
.entry strong { display: block; font-size: 14px; font-weight: 600; }
.entry small { display: block; font-size: 12px; color: var(--faint); margin-top: 1px; }
.entry-ico {
  width: 34px; height: 34px; border-radius: var(--r); display: grid; place-items: center; flex: none;
  background: var(--accent-soft); color: var(--accent-ink);
}
.chev { color: var(--faint); }
.entry.router-link-active { border-color: var(--accent-line); background: var(--accent-soft); }
.entry.router-link-active .entry-ico { background: var(--accent); color: var(--on-accent); }

.session { margin-top: 18px; display: flex; flex-direction: column; gap: 2px; }
.who { margin: 0 0 6px; text-align: center; font-size: 11.5px; }
.everywhere { color: var(--faint); font-weight: 500; }
.session .btn .vue-feather { flex: none; }
.everywhere:hover { color: var(--danger); }
.version { margin: 10px 0 0; text-align: center; font-size: 11px; color: var(--faint); letter-spacing: 0.04em; font-variant-numeric: tabular-nums; }
.content { min-width: 0; }

/* Phones: a subpage replaces the menu, and names itself in the header */
@media (max-width: 899px) {
  .sub .menu { display: none; }
  .sub .title-root { display: none; }
  .sub .title-sub { display: inline; }
}
/* Desktop: menu on the left, compact entries */
@media (min-width: 900px) {
  .layout { grid-template-columns: 250px minmax(0, 1fr); }
  .menu { position: sticky; top: 16px; }
  .entry { padding: 9px 10px; border-color: transparent; background: none; }
  .entry:hover { background: var(--surface-2); border-color: transparent; }
  .entry small { display: none; }
  .entry-ico { width: 28px; height: 28px; }
  .chev { display: none; }
}
</style>
