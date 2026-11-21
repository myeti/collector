<template>
  <!-- The items of an add session, one by one (a single scan is a queue of one) -->
  <div class="page review-page">
    <div class="page-head">
      <button class="icon-btn" :aria-label="$t('common.back')" @click="back"><vue-feather type="arrow-left" size="16" /></button>
      <div class="grow">
        <h1 class="display">{{ multi ? $t('review.title') : $t(`add.${session.origin}`) }}</h1>
        <p class="muted sub"><vue-feather :type="MEDIA[type].icon" size="13" /> {{ $t(`media.${type}`) }}</p>
      </div>
    </div>

    <!-- One item -->
    <template v-if="item">
      <div v-if="multi" class="progress">
        <div class="bar"><span :style="{ width: `${progress * 100}%` }"></span></div>
        <span class="faint small">{{ $t('review.progress', { i: item.id + 1, n: session.items.length }) }}</span>
        <button class="btn ghost sm" @click="toList"><vue-feather type="list" size="13" /> {{ $t('review.list') }}</button>
      </div>

      <transition name="fade" mode="out-in">
        <ItemReview
          :key="`${item.id}-${type}`" :type="type" :query="item.query" :seed="item.seed" :known="item.known"
          :preset="item.preset" :preset-cover-label="$t('lookup.yourPhoto')" :initial="item.picked" :saving="saving"
          @ignore="ignore" @edit="edit" @save="save" @type="moveTo"
        />
      </transition>
    </template>

    <!-- The list (several items): statuses, then done -->
    <template v-else-if="session.items.length">
      <div v-if="!pendingCount" class="done panel">
        <vue-feather type="check-circle" size="22" class="accent" />
        <div class="grow">
          <strong>{{ $t('review.doneTitle') }}</strong>
          <p class="muted small">{{ $t('review.doneText', { added: count('added'), skipped: count('skipped') }) }}</p>
        </div>
      </div>
      <p v-else class="muted small counts">{{ counts }}</p>

      <ul class="rows panel">
        <li v-for="i in session.items" :key="i.id">
          <ItemRow as="button" :item="fieldsOf(i)" @click="open(i)">
            <template #lead><span class="num">{{ i.id + 1 }}</span></template>
            <template #end>
              <span class="status" :class="i.status">{{ $t(`review.status.${i.status}`) }}</span>
              <vue-feather type="chevron-right" size="14" class="faint" />
            </template>
          </ItemRow>
        </li>
      </ul>

      <div class="action-bar">
        <button class="btn lg" @click="finish"><vue-feather type="check" size="15" /> {{ $t('review.finish') }}</button>
        <button v-if="pendingCount" class="btn primary lg" @click="open(nextPending())">
          <vue-feather type="play" size="15" /> {{ $t('review.resume') }}
        </button>
        <router-link v-else class="btn primary lg" :to="startPath(session.origin, type)" replace @click="clearSession()">
          <vue-feather :type="session.origin === 'photo' ? 'camera' : 'search'" size="15" /> {{ $t(`item.another.${session.origin}`) }}
        </router-link>
      </div>
    </template>

    <!-- Nothing in progress (reloaded after the end, old link…) -->
    <EmptyState v-else icon="inbox" :title="$t('review.empty')">
      <router-link class="btn primary" :to="`/c/${type}`">{{ $t('review.finish') }}</router-link>
    </EmptyState>
  </div>
</template>

<script>
import ItemReview from '../components/ItemReview.vue'
import ItemRow from '../components/ItemRow.vue'
import EmptyState from '../components/EmptyState.vue'
import { api } from '../lib/api.js'
import { store } from '../lib/store.js'
import { toast, toastError } from '../lib/toast.js'
import { sparkle } from '../lib/sparkle.js'
import { lookupFor } from '../lib/lookup.js'
import { session, currentItem, nextPending, finishItem, clearSession, reviewPath, startPath } from '../lib/addSession.js'
import { MEDIA } from '../../shared/media.js'

export default {
  name: 'ReviewView',
  components: { ItemReview, ItemRow, EmptyState },
  data: () => ({ MEDIA, session, saving: false }),
  computed: {
    type() { return session.type || this.$route.params.type },
    item() { return currentItem() },
    multi() { return session.items.length > 1 },
    pendingCount() { return this.count('pending') },
    progress() { return session.items.length ? session.items.filter((i) => i.status !== 'pending').length / session.items.length : 0 },
    counts() {
      return ['pending', 'added', 'skipped'].filter((s) => this.count(s)).map((s) => this.$t(`review.counts.${s}`, this.count(s))).join(' · ')
    },
  },
  watch: {
    item: { immediate: true, handler(item) { if (item) this.prefetch(item) } },
  },
  created() {
    if (session.type) store.setType(session.type)
  },
  methods: {
    nextPending,
    startPath,
    clearSession,
    count(status) { return session.items.filter((i) => i.status === status).length },
    /** What the list shows of a queued item: its reading or first result, else its query */
    fieldsOf(i) {
      const f = i.seed?.fields || i.known?.[0]?.fields || {}
      return { ...f, title: f.title || i.query.text || i.query.code, type: this.type }
    },
    /** The next item's sources are asked in the background: it opens instantly. */
    prefetch(item) {
      const next = nextPending(item.id)
      if (next && next.id !== item.id && !next.known) lookupFor(next.query, this.type).catch(() => {})
    },
    back() {
      if (this.item && this.multi) return this.toList()
      if (this.item) return this.ignore() // alone: leaving is ignoring it
      this.finish()
    },
    toList() {
      session.current = null
      window.scrollTo({ top: 0 })
    },
    open(item) {
      if (!item) return
      session.current = item.id
      window.scrollTo({ top: 0 })
    },
    finish() {
      const type = this.type
      clearSession()
      store.refreshStats()
      this.$router.push(`/c/${type}`)
    },
    ignore() {
      finishItem(this.$router, 'skipped')
      window.scrollTo({ top: 0 })
    },
    /** An ISBN scanned from another tab: the item is a book. */
    moveTo(type) {
      session.type = type
      store.setType(type)
      this.$router.replace(reviewPath(type))
    },
    /** Manual edit: the form, filled with the picks (kept for the way back). */
    edit(fields) {
      this.item.picked = fields
      this.$router.push({ path: `/new/${this.type}`, query: { from: 'review' } })
    },
    async save(fields, button) {
      this.saving = true
      try {
        // The preset (scanned code, photo) is among the picks: what the user unticked stays out
        const { item } = await api.post('/items', { type: this.type, ...fields })
        sparkle(button, { count: 18 })
        toast(this.$t('item.created'), { icon: 'star' })
        store.refreshStats()
        finishItem(this.$router, 'added', item.id)
        window.scrollTo({ top: 0 })
      } catch (e) {
        toastError(e)
      } finally {
        this.saving = false
      }
    },
  },
}
</script>

<style scoped>
.review-page { max-width: 980px; }
.page-head h1 { font-size: clamp(20px, 3vw, 26px); }
.sub { margin: 1px 0 0; display: flex; align-items: center; gap: 5px; font-size: 12px; }
.small { font-size: 12px; margin: 0; }
.counts { margin-bottom: 10px; }
.done { display: flex; align-items: center; gap: 12px; border-color: var(--accent-line); background: var(--accent-soft); margin-bottom: 12px; }

.rows { list-style: none; margin: 0; padding: 4px; }
li + li { border-top: 1px solid var(--border); }
.num { width: 22px; text-align: right; font-size: 11px; color: var(--faint); font-variant-numeric: tabular-nums; flex: none; }
.status { flex: none; font-size: 10.5px; font-weight: 650; padding: 1px 7px; border-radius: var(--r-xs); line-height: 18px; background: var(--surface-2); color: var(--muted); }
.status.added { background: var(--accent-soft); color: var(--accent-ink); }
.status.skipped { color: var(--faint); }
@media (max-width: 600px) { .action-bar .btn { flex: 1; } }

.progress { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.bar { flex: 1; height: 4px; border-radius: 2px; background: var(--surface-2); overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--accent); box-shadow: 0 0 8px var(--accent); transition: width 0.5s var(--ease); }
</style>
