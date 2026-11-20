<template>
  <div class="page library" @touchstart.passive="touchStart" @touchend.passive="touchEnd">
    <div class="top">
      <InstallHint dismissible />
      <div class="title-row">
        <h1 class="display">
          <transition name="fade" mode="out-in"><span :key="type">{{ $t(`media.${type}`) }}</span></transition>
        </h1>
        <p class="muted count">
          {{ $t(`library.countBy.${type}`, total) }}<template v-if="stats.consumed && !isFiltered"> · {{ $t(`library.done.${type}`, stats.consumed) }}</template>
        </p>
      </div>

      <div class="searchbar">
        <AppLogo class="logo" neon tight :size="32" :stroke-width="1" />
        <div class="input-wrap grow">
          <span class="lead"><vue-feather type="search" size="16" /></span>
          <input
            ref="search" v-model="q" class="input" type="search" enterkeyhint="search"
            :placeholder="$t('library.search', { media: $t(`media.${type}`).toLowerCase() })"
            @keydown.esc="q = ''; $refs.search.blur()"
          />
          <span class="trail">
            <!-- Mobile: item count lives in the field (desktop shows it next to the title) -->
            <span v-if="!loading || items.length" class="count-badge" :title="countText" :aria-label="countText">{{ total }}</span>
            <button v-if="q" class="icon-btn sm plain" :aria-label="$t('common.close')" @click="q = ''"><vue-feather type="x" size="14" /></button>
            <kbd v-else class="kbd-hint">/</kbd>
          </span>
        </div>
        <button class="icon-btn filter-btn" :class="{ active: showFilters || activeFilters }" :aria-label="$t('library.filters')" @click="showFilters = !showFilters">
          <vue-feather type="sliders" size="15" />
          <span v-if="activeFilters" class="dot">{{ activeFilters }}</span>
        </button>
        <div class="segmented view-toggle">
          <button :class="{ on: store.view === 'grid' }" :aria-label="$t('library.grid')" @click="store.setView('grid')"><vue-feather type="grid" size="14" /></button>
          <button :class="{ on: store.view === 'list' }" :aria-label="$t('library.list')" @click="store.setView('list')"><vue-feather type="list" size="14" /></button>
        </div>
      </div>

      <!--
        Quick filter: category (books, games) or format (music, movies). On mobile it is fixed above the bottom bar
        and teleported to <body>: the page transitions use transforms, which would otherwise re-anchor a fixed element.
      -->
      <teleport to="body" :disabled="!mobile">
        <transition :name="mobile ? 'quick' : ''" appear>
          <div v-if="quickValues.length && !leaving" class="quickbar">
            <div ref="quick" class="chips">
              <button class="chip" :class="{ on: !filters[quickField] }" @click="filters[quickField] = ''">
                {{ $t('common.all') }} <span class="n">{{ stats.count }}</span>
              </button>
              <button
                v-for="f in quickValues" :key="f.value" class="chip" :class="{ on: filters[quickField] === f.value }"
                @click="filters[quickField] = filters[quickField] === f.value ? '' : f.value"
              >
                {{ quickLabel(f.value) }} <span class="n">{{ f.count }}</span>
              </button>
            </div>
          </div>
        </transition>
      </teleport>

      <transition name="fade">
        <div v-if="showFilters" class="filters panel">
          <div v-if="categories.length && quickField !== 'category'" class="field full">
            <span class="label">{{ $t('fields.category') }}</span>
            <div class="chips wrap">
              <button class="chip" :class="{ on: !filters.category }" @click="filters.category = ''">{{ $t('common.all') }}</button>
              <button v-for="c in categories" :key="c" class="chip" :class="{ on: filters.category === c }" @click="filters.category = filters.category === c ? '' : c">
                {{ $t(`category.${type}.${c}`) }}
              </button>
            </div>
          </div>
          <div class="field">
            <span class="label">{{ $t('fields.consumed') }}</span>
            <div class="segmented accent">
              <button v-for="s in ['', 'true', 'false']" :key="s" :class="{ on: filters.consumed === s }" @click="filters.consumed = s">
                {{ s === '' ? $t('library.status.all') : s === 'true' ? $t(`consumed.${type}`) : $t(`consumed.not.${type}`) }}
              </button>
            </div>
          </div>
          <div v-if="formats.length && quickField !== 'format'" class="field">
            <span class="label">{{ $t('fields.format') }}</span>
            <div class="segmented accent">
              <button :class="{ on: !filters.format }" @click="filters.format = ''">{{ $t('common.all') }}</button>
              <button v-for="f in formats" :key="f" :class="{ on: filters.format === f }" @click="filters.format = f">{{ $t(`format.${f}`) }}</button>
            </div>
          </div>
          <div v-if="genres.length" class="field">
            <label for="f-genre">{{ $t('fields.genre') }}</label>
            <select id="f-genre" v-model="filters.genre" class="select">
              <option value="">{{ $t('common.all') }}</option>
              <option v-for="g in genres" :key="g" :value="g">{{ genreLabel(g) }}</option>
            </select>
          </div>
          <div v-if="members.length > 1" class="field">
            <label for="f-owner">{{ $t('library.owner') }}</label>
            <select id="f-owner" v-model="filters.owner" class="select">
              <option value="">{{ $t('library.everyone') }}</option>
              <option v-for="m in members" :key="m.id" :value="m.id">{{ m.id === store.user.id ? $t('library.me') : m.name }}</option>
            </select>
          </div>
          <div class="field">
            <label for="f-sort">{{ $t('library.sort') }}</label>
            <select id="f-sort" v-model="filters.sort" class="select">
              <option v-for="s in sorts" :key="s" :value="s">{{ $t(`library.sorts.${s}`) }}</option>
            </select>
          </div>
          <button v-if="activeFilters || filters[quickField]" class="btn ghost sm reset" @click="resetFilters"><vue-feather type="rotate-ccw" size="14" /> {{ $t('library.clearFilters') }}</button>
        </div>
      </transition>
    </div>

    <!-- Keyed by collection: slides towards the next one when switching -->
    <transition :name="`shelf-${direction}`" mode="out-in">
      <div :key="type" class="shelf">
      <!-- Loading skeleton -->
      <div v-if="loading && !items.length" class="grid">
        <div v-for="n in 12" :key="n" class="sk">
          <div class="skeleton" :class="type === 'music' ? 'sq' : 'tall'"></div>
          <div class="skeleton line"></div>
          <div class="skeleton line short"></div>
        </div>
      </div>

      <!-- Empty states -->
      <div v-else-if="!items.length" class="empty">
        <div class="orb"><vue-feather :type="isFiltered ? 'search' : MEDIA[type].icon" size="26" /></div>
        <template v-if="isFiltered">
          <h2 class="display">{{ q ? $t('library.noResults', { q }) : $t('library.noResultsText') }}</h2>
          <p v-if="q">{{ $t('library.noResultsText') }}</p>
          <div class="row">
            <button class="btn" @click="q = ''; resetFilters()">{{ $t('library.clearFilters') }}</button>
            <router-link v-if="q" class="btn primary" :to="{ path: `/add/${type}/search`, query: { q } }"><vue-feather type="globe" size="16" /> {{ $t('add.search') }}</router-link>
          </div>
        </template>
        <template v-else>
          <h2 class="display">{{ $t('library.empty', { media: $t(`media.${type}`).toLowerCase() }) }}</h2>
          <p>{{ $t('library.emptyText') }}</p>
          <div class="row wrap center">
            <router-link class="btn primary" :to="`/add/${type}/scan`"><vue-feather type="maximize" size="16" /> {{ $t('add.scan') }}</router-link>
            <button class="btn" @click="store.addOpen = true"><vue-feather type="plus" size="16" /> {{ $t('nav.add') }}</button>
          </div>
        </template>
      </div>

      <!-- Grid -->
      <transition-group v-else-if="store.view === 'grid'" tag="div" name="list" class="grid" :class="{ dim: loading }">
        <ItemCard v-for="(item, i) in items" :key="item.id" :item="item" :style="{ transitionDelay: `${Math.min(i, 20) * 18}ms` }" />
      </transition-group>

      <!-- List -->
      <div v-else class="rows panel" :class="{ dim: loading }">
        <router-link v-for="item in items" :key="item.id" :to="`/item/${item.id}`" class="list-row">
          <div class="thumb" :class="{ sq: item.type === 'music' }">
            <CoverImage :src="item.cover" :title="item.title" :type="item.type" small />
            <span v-if="item.consumed" class="done" :title="$t(`consumed.${item.type}`)"></span>
          </div>
          <div class="grow">
            <div class="clamp-2 strong" :title="item.title">{{ item.title }}</div>
            <!-- {author} · {saga} #{volume} · {year} -->
            <MetaLine class="muted small" :groups="metaGroups(item)" />
          </div>
          <span v-if="item.category" class="chip static hide-sm">{{ $te(`category.${item.type}.${item.category}`) ? $t(`category.${item.type}.${item.category}`) : item.category }}</span>
          <span v-if="item.format" class="chip static hide-sm">{{ $t(`format.${item.format}`) }}</span>
          <!-- Family: whose item it is -->
          <span
            v-if="!item.mine && item.owner" class="owner-mark" :style="{ background: personColor(item.owner.id) }"
            :title="$t('item.ownedBy', { name: item.owner.name })" :aria-label="$t('item.ownedBy', { name: item.owner.name })"
          >{{ initial(item.owner) }}</span>
        </router-link>
      </div>
      </div>
    </transition>

    <div ref="sentinel" class="sentinel">
      <vue-feather v-if="loading && items.length" type="loader" size="20" class="spin faint" />
    </div>

    <p v-if="items.length" class="shortcuts faint hide-sm">
      <i18n-t keypath="library.shortcuts" tag="span">
        <template #slash><kbd>/</kbd></template>
        <template #keys><kbd>1</kbd>–<kbd>{{ store.enabledTypes.length }}</kbd></template>
      </i18n-t>
    </p>
  </div>
</template>

<script>
import ItemCard from '../components/ItemCard.vue'
import CoverImage from '../components/CoverImage.vue'
import AppLogo from '../components/AppLogo.vue'
import InstallHint from '../components/InstallHint.vue'
import { api, qs } from '../lib/api.js'
import { store } from '../lib/store.js'
import { toastError } from '../lib/toast.js'
import { MEDIA } from '../../shared/media.js'
import { metaGroups } from '../lib/format.js'
import MetaLine from '../components/MetaLine.vue'
import { personColor, initial } from '../lib/people.js'

const PAGE = 48
const emptyFilters = () => ({ category: '', consumed: '', format: '', genre: '', owner: '', sort: 'recent' })

export default {
  name: 'LibraryView',
  components: { ItemCard, CoverImage, AppLogo, InstallHint, MetaLine },
  data() {
    return {
      store,
      MEDIA,
      q: this.$route.query.q || '',
      filters: emptyFilters(),
      showFilters: false,
      items: [],
      total: 0,
      loading: true,
      done: false,
      members: [],
      seq: 0,
      direction: 'next',
      facets: { category: [], format: [] },
      mobile: window.matchMedia('(max-width: 899px)').matches,
      leaving: false,
    }
  },
  computed: {
    type() { return this.$route.params.type },
    stats() { return store.stats[this.type] || { count: 0, consumed: 0 } },
    categories() { return MEDIA[this.type].categories },
    formats() { return MEDIA[this.type].formats },
    genres() { return MEDIA[this.type].genres },
    sorts() {
      const base = ['recent', 'title', 'author', 'release']
      return MEDIA[this.type].fields.includes('saga') ? [...base, 'saga'] : base
    },
    quickField() { return MEDIA[this.type].quickFilter },
    /** Values present in the collection for the quick bar, in their natural order. */
    quickValues() {
      const field = this.quickField
      const known = field === 'format' ? this.formats : this.categories
      const list = [...(this.facets[field] || [])]
      const selected = this.filters[field]
      if (selected && !list.some((f) => f.value === selected)) list.push({ value: selected, count: 0 })
      const rank = (v) => (known.includes(v) ? known.indexOf(v) : known.length)
      return list.sort((a, b) => rank(a.value) - rank(b.value) || b.count - a.count)
    },
    /** Filters of the panel (the quick bar's own value is visible, so not counted in the badge). */
    activeFilters() {
      const f = this.filters
      const fields = ['category', 'consumed', 'format', 'genre', 'owner'].filter((k) => k !== this.quickField)
      return [...fields.map((k) => f[k]), f.sort !== 'recent' ? 1 : ''].filter(Boolean).length
    },
    quickVisible() { return this.quickValues.length > 0 && !this.leaving },
    countText() {
      const done = this.stats.consumed && !this.isFiltered ? ` · ${this.$t(`library.done.${this.type}`, this.stats.consumed)}` : ''
      return this.$t(`library.countBy.${this.type}`, this.total) + done
    },
    isFiltered() {
      return !!(this.q.trim() || this.activeFilters || this.filters[this.quickField])
    },
  },
  watch: {
    quickVisible: {
      immediate: true,
      // Lets the floating add button and the page padding make room for the quick bar.
      handler(v) { document.documentElement.style.setProperty('--quickbar', v ? '44px' : '0px') },
    },
    'filters.category'() { this.$nextTick(this.revealQuick) },
    'filters.format'() { this.$nextTick(this.revealQuick) },
    type(next, prev) {
      // Runs before render: sets the slide direction for the keyed transition.
      const order = store.enabledTypes.includes(prev) && store.enabledTypes.includes(next) ? store.enabledTypes : Object.keys(MEDIA)
      this.direction = order.indexOf(next) >= order.indexOf(prev) ? 'next' : 'prev'
      window.scrollTo({ top: 0 })
      // The filters watcher refetches.
      this.filters = emptyFilters()
      this.items = []
      this.facets = { category: [], format: [] }
      this.fetchFacets()
    },
    q(v) {
      clearTimeout(this.debounce)
      this.debounce = setTimeout(() => {
        this.$router.replace({ query: { ...this.$route.query, q: v || undefined } })
        this.fetch(true)
      }, 220)
    },
    filters: { deep: true, handler() { this.fetch(true) } },
  },
  beforeRouteLeave() {
    // Lets the teleported quick bar slide out together with the page.
    this.leaving = true
  },
  async mounted() {
    this.mq = window.matchMedia('(max-width: 899px)')
    this.onMq = (e) => { this.mobile = e.matches }
    this.mq.addEventListener('change', this.onMq)
    this.fetch(true)
    this.fetchFacets()
    this.onKey = (e) => this.shortcut(e)
    window.addEventListener('keydown', this.onKey)
    this.io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !this.loading && !this.done) this.fetch(false)
    }, { rootMargin: '600px' })
    this.io.observe(this.$refs.sentinel)
    if (store.user.family) {
      const { family } = await api.get('/family').catch(() => ({}))
      this.members = family?.members || []
    }
  },
  beforeUnmount() {
    this.mq?.removeEventListener('change', this.onMq)
    document.documentElement.style.setProperty('--quickbar', '0px')
    window.removeEventListener('keydown', this.onKey)
    this.io?.disconnect()
    clearTimeout(this.debounce)
  },
  methods: {
    async fetch(reset) {
      const seq = ++this.seq
      this.loading = true
      const offset = reset ? 0 : this.items.length
      try {
        const data = await api.get(`/items${qs({ type: this.type, q: this.q.trim(), ...this.filters, limit: PAGE, offset })}`)
        if (seq !== this.seq) return
        this.items = reset ? data.items : [...this.items, ...data.items]
        this.total = data.total
        this.done = this.items.length >= data.total
        if (reset && !this.isFiltered) {
          store.stats[this.type] = { ...this.stats, count: data.total }
        }
      } catch (e) {
        if (seq === this.seq) toastError(e)
      } finally {
        if (seq === this.seq) this.loading = false
      }
    },
    async fetchFacets() {
      const type = this.type
      const { facets } = await api.get(`/items/facets${qs({ type })}`).catch(() => ({ facets: null }))
      if (facets && type === this.type) this.facets = facets
    },
    quickLabel(value) {
      const key = this.quickField === 'format' ? `format.${value}` : `category.${this.type}.${value}`
      return this.$te(key) ? this.$t(key) : value
    },
    revealQuick() {
      this.$refs.quick?.querySelector('.chip.on')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
    },
    switchType(type) {
      this.$router.push({ path: `/c/${type}`, query: this.q ? { q: this.q } : {} })
    },
    metaGroups,
    personColor,
    initial,
    resetFilters() { this.filters = emptyFilters() },
    genreLabel(g) { return this.$te(`genre.${this.type}.${g}`) ? this.$t(`genre.${this.type}.${g}`) : g },
    shortcut(e) {
      const tag = document.activeElement?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.metaKey || e.ctrlKey || e.altKey || store.addOpen) return
      if (e.key === '/') {
        e.preventDefault()
        this.$refs.search.focus()
      } else if (/^[1-5]$/.test(e.key)) {
        const next = store.enabledTypes[Number(e.key) - 1]
        if (next) this.switchType(next)
      } else if (e.key === 'n') {
        store.addOpen = true
      }
    },
    touchStart(e) {
      const t = e.touches[0]
      this.touch = { x: t.clientX, y: t.clientY, at: Date.now(), ignore: !!e.target.closest('.chips, .switcher, .segmented, input, select') }
    },
    touchEnd(e) {
      const s = this.touch
      if (!s || s.ignore) return
      const t = e.changedTouches[0]
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2 || Date.now() - s.at > 600) return
      const types = store.enabledTypes
      const i = types.indexOf(this.type) + (dx < 0 ? 1 : -1)
      if (i >= 0 && i < types.length) this.switchType(types[i])
    },
  },
}
</script>

<style scoped>
.library { overflow-x: clip; }
.quickbar .chip { height: 28px; gap: 6px; }
.quickbar .n { font-size: 10.5px; color: var(--faint); font-variant-numeric: tabular-nums; }
.quickbar .chip.on .n { color: inherit; opacity: 0.75; }
.quick-enter-active { transition: transform 0.28s var(--ease), opacity 0.2s var(--ease); }
.quick-leave-active { transition: transform 0.16s ease-in, opacity 0.16s ease-in; }
.quick-enter-from, .quick-leave-to { transform: translateY(100%); opacity: 0; }
/* Keeps the page height while one collection leaves and the next enters */
.shelf { min-height: 60vh; }
.top { display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px; }
.title-row { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.title-row h1 { font-size: clamp(22px, 3vw, 30px); }
.count { margin: 0; font-size: 12.5px; }
.count-badge {
  display: none; min-width: 22px; height: 22px; padding: 0 7px; border-radius: var(--r-sm); align-items: center; justify-content: center;
  font-size: 11.5px; font-weight: 650; font-variant-numeric: tabular-nums; color: var(--accent-ink); background: var(--accent-soft);
  margin-right: 5px; animation: badge-in 0.3s var(--spring);
}
@keyframes badge-in { from { transform: scale(0.6); opacity: 0; } }
.searchbar { display: flex; gap: 6px; align-items: center; position: sticky; top: 8px; z-index: 10; }
.searchbar .input { background: color-mix(in oklab, var(--surface-solid) 88%, transparent); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
.kbd-hint { margin-right: 6px; }
/* App mark, mobile only (the desktop sidebar already shows it) */
.logo { display: none; flex: none; width: 26px; height: 32px; margin: 0 4px 0 2px; }
.filter-btn { width: var(--h-lg); height: var(--h-lg); position: relative; background: color-mix(in oklab, var(--surface-solid) 88%, transparent); }
.view-toggle { flex: none; background: color-mix(in oklab, var(--surface-solid) 88%, transparent); }
.view-toggle button { height: 32px; width: 32px; padding: 0; justify-content: center; }
.dot {
  position: absolute; top: -5px; right: -5px; min-width: 16px; height: 16px; border-radius: var(--r-xs); font-size: 10px; font-weight: 800;
  display: grid; place-items: center; background: var(--accent); color: var(--on-accent); padding: 0 3px;
}
.filters { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; align-items: end; padding: 14px; }
.filters .full { grid-column: 1 / -1; }
.filters .reset { justify-self: start; }

.grid {
  display: grid; gap: 20px 14px; position: relative;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
}
.dim { opacity: 0.55; transition: opacity 0.2s; }

/* Collection switch: quick fade + slide towards the next collection */
.shelf-next-enter-active, .shelf-prev-enter-active { transition: opacity 0.22s var(--ease), transform 0.28s var(--ease); }
.shelf-next-leave-active, .shelf-prev-leave-active { transition: opacity 0.12s ease-in, transform 0.12s ease-in; }
.shelf-next-enter-from { opacity: 0; transform: translateX(32px); }
.shelf-next-leave-to { opacity: 0; transform: translateX(-20px); }
.shelf-prev-enter-from { opacity: 0; transform: translateX(-32px); }
.shelf-prev-leave-to { opacity: 0; transform: translateX(20px); }
@media (min-width: 900px) {
  /* Vertical sidebar on desktop: a subtle vertical shift matches the menu better */
  .shelf-next-enter-from, .shelf-prev-enter-from { transform: translateY(8px); }
  .shelf-next-leave-to, .shelf-prev-leave-to { transform: translateY(-4px); }
}
.sk { display: flex; flex-direction: column; gap: 6px; }
.sk .tall { aspect-ratio: 2 / 3; }
.sk .sq { aspect-ratio: 1; }
.sk .line { height: 10px; border-radius: var(--r-xs); }
.sk .short { width: 60%; }

.rows { padding: 4px; }
.list-row { display: flex; align-items: center; gap: 12px; padding: 6px 8px; border-radius: var(--r); transition: background 0.15s; }
.list-row:hover { background: var(--surface-2); }
.list-row + .list-row { box-shadow: 0 -1px 0 var(--border); }
.thumb { position: relative; width: 34px; aspect-ratio: 2 / 3; border-radius: var(--r-xs); overflow: hidden; flex: none; }
/* Same "completed" bar as the grid cards */
.thumb .done { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: var(--accent); box-shadow: 0 0 6px var(--accent); }
.thumb.sq { aspect-ratio: 1; }
.strong { font-weight: 600; font-size: 13.5px; }
.owner-mark {
  flex: none; width: 22px; height: 22px; border-radius: var(--r-xs); display: grid; place-items: center;
  font-size: 11px; font-weight: 700; color: #fff;
}
.small { font-size: 12px; }
.sentinel { height: 48px; display: grid; place-items: center; }
.shortcuts { text-align: center; font-size: 11.5px; }
.center { justify-content: center; }

@media (max-width: 899px) {
  .logo { display: block; }
  /* No magnifier on mobile: the logo already anchors the field, the text gets the room */
  .searchbar .lead { display: none; }
  .searchbar .input-wrap > .input { padding-left: 12px; }
  .library { padding-bottom: calc(var(--bottom-nav) + var(--quickbar, 0px) + 32px + var(--safe-bottom)); }
  .quickbar {
    position: fixed; left: 0; right: 0; bottom: calc(var(--bottom-nav) + var(--safe-bottom)); height: 44px; z-index: 29;
    display: flex; align-items: center; padding: 0 12px; border-top: 1px solid var(--border);
    background: color-mix(in oklab, var(--bg-2) 92%, transparent); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  }
  .quickbar .chips { padding: 2px 0; }
  .title-row { display: none; }
  /* Starts where the search text starts: logo (2 + 26 + 4) + gap (6) + input padding (12) */
  .count-badge { display: inline-flex; }
  /* Room for the count badge (and the clear button while typing) */
  .searchbar .input-wrap > .input { padding-right: 72px; }
  .kbd-hint { display: none; }
}
@media (max-width: 600px) {
  .hide-sm { display: none !important; }
  .page { padding-top: 12px; }
  .top { gap: 8px; margin-bottom: 14px; }
  .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px 10px; }
  .view-toggle button { width: 30px; }
}
</style>
