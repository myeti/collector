<template>
  <!-- Where a method starts: get a barcode, a photo or a query, pick what to add, then review it (ReviewView) -->
  <div class="page narrow-ish">
    <div class="page-head">
      <button class="icon-btn" :aria-label="$t('common.back')" @click="back"><vue-feather type="arrow-left" size="16" /></button>
      <div class="grow">
        <h1 class="display">{{ $t(`add.${mode}`) }}</h1>
        <p class="muted sub"><vue-feather :type="MEDIA[type].icon" size="14" /> {{ $t(`media.${type}`) }}</p>
      </div>
    </div>

    <!-- 1. Barcode -->
    <BarcodeScanner v-if="mode === 'scan'" @detected="onBarcode" />

    <!-- 2. Photo of a cover or a shelf (AI) -->
    <template v-else-if="mode === 'photo'">
      <EmptyState v-if="!store.llmEnabled" icon="cpu" :title="$t('photo.noAi')" :text="$t('photo.noAiText')">
        <router-link class="btn primary" to="/settings/sources"><vue-feather type="sliders" size="15" /> {{ $t('photo.configure') }}</router-link>
      </EmptyState>

      <FileDrop v-else-if="step === 'acquire'" camera icon="camera" @file="analyze">
        <p class="muted">{{ $t('photo.hint') }}</p>
      </FileDrop>

      <LoadingState
        v-else-if="step === 'loading'" :image="photo"
        :text="$t('photo.analyzing', { media: $t(`media.${type}`).toLowerCase() })" :hint="$t('photo.patience')"
      />

      <EmptyState v-else-if="!rows.length" icon="eye-off" :title="$t('photo.none')" :text="error || $t('photo.noneText')">
        <button class="btn primary" @click="restart"><vue-feather type="camera" size="15" /> {{ $t('photo.another') }}</button>
      </EmptyState>

      <SelectList v-else v-model="selected" :type="type" :rows="rows" :title="$t('photo.found', rows.length)" :text="$t('photo.pickText')" @confirm="start()">
        <template #before><button class="btn" @click="restart"><vue-feather type="camera" size="15" /> {{ $t('photo.another') }}</button></template>
      </SelectList>
    </template>

    <!-- 3. Text search -->
    <template v-else-if="mode === 'search'">
      <form class="search-form" @submit.prevent="onSearch">
        <div class="input-wrap grow">
          <span class="lead"><vue-feather type="globe" size="16" /></span>
          <input ref="q" v-model="query" class="input" type="search" enterkeyhint="search" :placeholder="$t('search.placeholder')" />
        </div>
        <button class="btn primary" style="height: var(--h-lg)" :disabled="query.trim().length < 2 || step === 'loading'">{{ $t('search.go') }}</button>
      </form>

      <LoadingState v-if="step === 'loading'" :text="$t('lookup.searching')" />

      <template v-else-if="step === 'list'">
        <div v-if="sources.length || errors.length" class="meta-line faint">
          <span v-if="sources.length">{{ $t('lookup.sources', { sources: sources.join(', ') }) }}</span>
          <span v-if="errors.length" class="err" :title="errors.map((e) => `${e.source}: ${e.message}`).join('\n')">
            <vue-feather type="alert-triangle" size="12" /> {{ $t('lookup.errors', { list: [...new Set(errors.map((e) => e.source))].join(', ') }) }}
          </span>
        </div>
        <SelectList v-if="rows.length" v-model="selected" :type="type" :rows="rows" :title="$t('search.pickTitle')" :text="$t('search.pickText')" @confirm="start()" />
        <EmptyState v-else icon="help-circle" :title="$t('lookup.nothing')" :text="$t('search.nothingText')">
          <router-link class="btn primary" :to="`/new/${type}?from=manual`"><vue-feather type="edit-3" size="16" /> {{ $t('lookup.addManually') }}</router-link>
        </EmptyState>
      </template>
    </template>
  </div>
</template>

<script>
import BarcodeScanner from '../components/BarcodeScanner.vue'
import SelectList from '../components/SelectList.vue'
import EmptyState from '../components/EmptyState.vue'
import LoadingState from '../components/LoadingState.vue'
import FileDrop from '../components/FileDrop.vue'
import { api, qs } from '../lib/api.js'
import { store } from '../lib/store.js'
import { toastError } from '../lib/toast.js'
import { norm } from '../lib/format.js'
import { queryText } from '../lib/lookup.js'
import { startSession, reviewPath } from '../lib/addSession.js'
import { MEDIA, isIsbn } from '../../shared/media.js'

export default {
  name: 'AddView',
  components: { BarcodeScanner, SelectList, EmptyState, LoadingState, FileDrop },
  data() {
    return {
      store,
      MEDIA,
      type: this.$route.params.type,
      mode: this.$route.params.mode,
      step: 'acquire', // acquire · loading · list
      query: this.$route.query.q || '',
      rows: [], // photo detections or search results (grouped)
      selected: [],
      sources: [],
      errors: [],
      error: '',
      cover: null, // the photo, kept by the server when it shows a single item
      photo: null,
    }
  },
  mounted() {
    if (this.mode === 'search') {
      if (this.query.trim().length >= 2) this.onSearch()
      else this.$nextTick(() => this.$refs.q?.focus())
    }
  },
  beforeUnmount() {
    if (this.photo) URL.revokeObjectURL(this.photo)
  },
  methods: {
    back() {
      if (this.step === 'list' && this.mode === 'photo') return this.restart()
      if (window.history.state?.back) this.$router.back()
      else this.$router.push(`/c/${this.type}`)
    },
    restart() {
      this.step = 'acquire'
      this.rows = []
      this.selected = []
      this.cover = null
    },
    /** Hands the chosen items over to the review, one by one. */
    review(items) {
      startSession(this.mode, this.type, items)
      this.$router.replace(reviewPath(this.type))
    },

    // --- Barcode: a queue of one, identifier mode
    onBarcode(code) {
      const preset = { barcode: code }
      if (isIsbn(code)) preset.isbn = code
      this.review([{ query: { code }, preset }])
    },

    // --- Photo: the AI lists what it reads
    async analyze(file) {
      if (!file.type.startsWith('image/')) return
      if (this.photo) URL.revokeObjectURL(this.photo)
      this.photo = URL.createObjectURL(file)
      this.step = 'loading'
      this.error = ''
      const form = new FormData()
      form.append('type', this.type)
      form.append('file', file)
      try {
        const result = await api.post('/lookup/photo', form)
        this.error = result.errors?.map((e) => `${e.source}: ${e.message}`).join(' · ') || ''
        this.cover = result.cover
        this.rows = result.items.map((d) => ({ key: d.id, fields: d.fields, duplicate: d.owned, sourceName: d.sourceName }))
        // A single cover: nothing to choose, straight to its review (its photo offered as the cover)
        if (this.rows.length === 1) return this.start([this.rows[0].key])
        this.selected = this.rows.filter((r) => !r.duplicate).map((r) => r.key)
        this.step = 'list'
      } catch (e) {
        toastError(e)
        this.step = 'acquire'
      }
    },

    // --- Search: results from every source, the same work merged into one row
    async onSearch() {
      const q = this.query.trim()
      if (q.length < 2) return
      this.$router.replace({ query: { q } })
      this.step = 'loading'
      try {
        const result = await api.get(`/lookup${qs({ q, type: this.type })}`)
        this.sources = result.sources || []
        this.errors = result.errors || []
        const groups = new Map()
        for (const c of result.candidates) {
          if (!c.fields?.title) continue
          const key = `${norm(c.fields.title)}|${norm(c.fields.volume)}`
          if (!groups.has(key)) groups.set(key, { key, fields: c.fields, cover: null, sources: [], known: [], duplicate: null })
          const g = groups.get(key)
          g.known.push(c)
          g.cover ||= c.fields.cover || null
          g.duplicate ||= c.owned || null
          if (!g.sources.includes(c.sourceName)) g.sources.push(c.sourceName)
        }
        this.rows = [...groups.values()]
        this.selected = []
        this.step = 'list'
      } catch (e) {
        toastError(e)
        this.step = 'acquire'
      }
    },

    /** Photo or search: the ticked rows become the queue. */
    start(keys = this.selected) {
      const rows = this.rows.filter((r) => keys.includes(r.key))
      this.review(rows.map((r) => (this.mode === 'photo'
        ? {
            query: { text: queryText(r.fields, this.type) },
            seed: { source: 'llm', sourceName: r.sourceName || 'AI', type: this.type, fields: r.fields },
            preset: this.cover && rows.length === 1 ? { cover: this.cover } : {},
          }
        : { query: { text: queryText(r.fields, this.type) }, known: r.known })))
    },
  },
}
</script>

<style scoped>
.narrow-ish { max-width: 980px; }
.sub { margin: 1px 0 0; display: flex; align-items: center; gap: 5px; font-size: 12px; }
.search-form { display: flex; gap: 8px; margin-bottom: 14px; }
.meta-line { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 11.5px; margin-bottom: 14px; }
.err { display: inline-flex; align-items: center; gap: 4px; color: color-mix(in oklab, var(--danger) 70%, var(--faint)); cursor: help; }
</style>
