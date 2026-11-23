<template>
  <div>
    <!-- 1. Which service, and its file -->
    <template v-if="step === 'pick'">
      <section class="panel">
        <div class="panel-title"><vue-feather type="upload" size="12" /> {{ $t('import.title') }}</div>
        <p class="muted intro">{{ $t('import.intro') }}</p>

        <div class="sources">
          <button
            v-for="src in sources" :key="src.id" class="source" :class="{ on: source?.id === src.id }"
            :style="{ '--c': src.type ? ACCENTS[src.type].color : 'var(--accent)' }" :aria-pressed="source?.id === src.id" @click="source = src"
          >
            <span class="source-ico"><vue-feather :type="src.type ? MEDIA[src.type].icon : 'archive'" size="15" /></span>
            <span class="grow">
              <strong>{{ src.name }}</strong>
              <small>{{ src.type ? $t(`media.${src.type}`) : $t('import.allShort') }}</small>
            </span>
          </button>
        </div>

        <transition name="fade" mode="out-in">
          <FileDrop
            v-if="source" :key="source.id" class="how" :accept="isCollector ? '.zip,application/zip' : '.csv,text/csv'"
            :choose-label="$t(isCollector ? 'import.chooseZip' : 'import.chooseFile')" @file="read"
          >
            <p class="how-text">{{ $t(`import.sources.${source.id}`) }}</p>
            <a v-if="source.url" :href="source.url" target="_blank" rel="noopener" class="btn ghost sm"><vue-feather type="external-link" size="12" /> {{ $t('import.openService', { name: source.name }) }}</a>
          </FileDrop>
        </transition>
      </section>
      <p class="faint rules"><vue-feather type="info" size="12" /> {{ $t('import.rules') }}</p>

      <!-- Export: a Collector archive, to keep or to import on another server -->
      <section class="panel export">
        <div class="panel-title"><vue-feather type="archive" size="12" /> {{ $t('export.title') }}</div>
        <p class="muted intro">{{ $t('export.intro') }}</p>
        <div class="export-row">
          <label class="check-line"><input v-model="exportCovers" type="checkbox" /> {{ $t('export.covers') }}</label>
          <a class="btn" :href="`/api/export?covers=${exportCovers ? 1 : 0}`" download><vue-feather type="download" size="14" /> {{ $t('export.download') }}</a>
        </div>
      </section>

      <!-- Items saved without a cover (imports, manual entries) -->
      <section v-if="missingTypes.length" class="panel missing">
        <div class="panel-title"><vue-feather type="image" size="12" /> {{ $t('covers.title') }}</div>
        <p class="muted intro">{{ $t('covers.intro') }}</p>
        <div v-for="t in missingTypes" :key="t" class="miss-row" :style="{ '--c': ACCENTS[t].color }">
          <span class="source-ico"><vue-feather :type="MEDIA[t].icon" size="15" /></span>
          <span class="grow">
            <strong>{{ $t(`media.${t}`) }}</strong>
            <small>{{ $t('covers.count', missing[t].length) }}</small>
          </span>
          <button class="btn sm" :disabled="coverJob.running" @click="findCovers(missing[t])">
            <vue-feather type="image" size="13" /> {{ $t('covers.find') }}
          </button>
        </div>
      </section>
    </template>

    <!-- 2. Reading the file -->
    <LoadingState v-else-if="step === 'loading'" class="panel" :hint="$t('import.reading', { file: fileName })" />

    <!-- 3. What would be imported -->
    <template v-else-if="step === 'preview'">
      <section class="panel summary">
        <div class="sum-head">
          <span class="source-ico" :style="{ '--c': preview.type ? ACCENTS[preview.type].color : 'var(--accent)' }"><vue-feather :type="preview.type ? MEDIA[preview.type].icon : 'archive'" size="16" /></span>
          <div class="grow">
            <strong>{{ preview.name }} · {{ preview.type ? $t(`media.${preview.type}`) : $t('import.allCollections') }}</strong>
            <p class="faint small truncate">{{ fileName }}</p>
          </div>
        </div>
        <div class="stats">
          <div><strong>{{ newCount }}</strong><span>{{ $t('import.new') }}</span></div>
          <div><strong>{{ dupCount }}</strong><span>{{ $t('import.alreadyOwned') }}</span></div>
          <div><strong>{{ preview.excluded.length }}</strong><span>{{ $t('import.leftOut') }}</span></div>
        </div>
        <details v-if="preview.excluded.length" class="excluded">
          <summary>{{ excludedSummary }}</summary>
          <ul>
            <li v-for="(x, i) in preview.excluded" :key="i"><span class="truncate">{{ x.title || '—' }}</span><span class="faint">{{ $t(`import.reasons.${x.reason}`) }}</span></li>
          </ul>
        </details>
      </section>

      <SelectList
        v-model="selected" class="list" :type="preview.type || 'book'" :rows="rows" select-all
        :action-label="$t('import.go', selected.length)" action-icon="download" :busy="importing" @confirm="commit"
      >
        <template #toolbar>
          <div class="segmented">
            <button v-for="f in ['all', 'new', 'owned']" :key="f" :class="{ on: show === f }" @click="show = f">{{ $t(`import.show.${f}`) }}</button>
          </div>
        </template>
        <template #badges="{ row }">
          <span v-if="!row.duplicate && row.repeated" class="badge repeated"><vue-feather type="copy" size="10" /> {{ $t('import.repeated') }}</span>
          <span v-if="!preview.type" class="badge"><vue-feather :type="MEDIA[row.type].icon" size="10" /> {{ $t(`media.${row.type}`) }}</span>
          <span v-if="row.fields.consumed" class="badge">{{ $t(`consumed.${row.type || preview.type}`) }}</span>
          <span v-if="row.fields.digitalized" class="badge"><vue-feather type="cloud" size="10" /> {{ $t('library.copies.digital') }}</span>
          <span v-if="row.fields.format && (row.type || preview.type) !== 'videogame' && (row.type || preview.type) !== 'custom'" class="badge">{{ $t(`format.${row.fields.format}`) }}</span>
          <span v-if="row.hasCover" class="badge"><vue-feather type="image" size="10" /> {{ $t('import.withCover') }}</span>
        </template>
        <!-- Games listed on several platforms: which one is on the shelf -->
        <template #end="{ row }">
          <select v-if="row.choices" v-model="row.fields.format" class="select platform" :class="{ missing: !row.fields.format }" :aria-label="$t('fields.formatBy.videogame')">
            <option :value="undefined">{{ $t('import.whichPlatform') }}</option>
            <option v-for="c in row.choices" :key="c" :value="c">{{ $t(`format.${c}`) }}</option>
          </select>
        </template>
        <template #before><button class="btn" @click="reset">{{ $t('common.cancel') }}</button></template>
      </SelectList>
    </template>

    <!-- 4. Done -->
    <EmptyState
      v-else-if="step === 'done'" class="panel" icon="check" :title="$t('import.doneTitle', result.created)"
      :text="doneText"
    >
      <button class="btn ghost" @click="reset"><vue-feather type="upload" size="14" /> {{ $t('import.another') }}</button>
      <router-link class="btn" :to="`/c/${doneType}`"><vue-feather :type="MEDIA[doneType].icon" size="14" /> {{ $t('import.open') }}</router-link>
      <button v-if="result.ids?.length" class="btn primary" :disabled="coverJob.running" @click="findCovers(result.ids)">
        <vue-feather type="image" size="14" /> {{ $t('covers.findN', result.ids.length) }}
      </button>
      <template v-if="result.ids?.length" #after><p class="faint covers-hint">{{ $t('covers.hint') }}</p></template>
    </EmptyState>
  </div>
</template>

<script>
import SelectList from '../../components/SelectList.vue'
import FileDrop from '../../components/FileDrop.vue'
import LoadingState from '../../components/LoadingState.vue'
import EmptyState from '../../components/EmptyState.vue'
import { api } from '../../lib/api.js'
import { store, ACCENTS } from '../../lib/store.js'
import { sparkle } from '../../lib/sparkle.js'
import { toastError } from '../../lib/toast.js'
import { coverJob, findCovers, copyCovers } from '../../lib/covers.js'
import { MEDIA } from '../../../shared/media.js'

export default {
  name: 'ImportSettings',
  components: { SelectList, FileDrop, LoadingState, EmptyState },
  data: () => ({
    MEDIA,
    ACCENTS,
    sources: [],
    source: null,
    step: 'pick',
    fileName: '',
    preview: null,
    selected: [], // ids of the ticked rows
    show: 'all',
    importing: false,
    result: null,
    missing: {}, // media type -> ids of the user's items without a cover
    coverJob,
    exportCovers: true,
  }),
  computed: {
    isCollector() { return this.source?.id === 'collector' },
    /** The collection the done screen opens: the import's, or the first one an archive filled */
    doneType() { return this.preview?.type || this.result?.types?.find((t) => store.enabledTypes.includes(t)) || store.type },
    doneText() {
      const text = this.preview.type ? this.$t('import.doneText', { media: this.$t(`media.${this.preview.type}`) }) : this.$t('import.doneTextAll')
      return text + (this.result.covers?.length ? ` ${this.$t('import.coversCopying')}` : '') + (this.result.skipped ? ` ${this.$t('import.skipped', this.result.skipped)}` : '')
    },
    missingTypes() { return store.enabledTypes.filter((t) => this.missing[t]?.length) },
    visible() {
      const items = this.preview?.items || []
      if (this.show === 'new') return items.filter((i) => !this.known(i))
      if (this.show === 'owned') return items.filter((i) => this.known(i))
      return items
    },
    rows() { return this.visible.map((i) => ({ ...i, key: i.id, cover: undefined, hasCover: i.cover })) },
    newCount() { return this.preview.items.filter((i) => !this.known(i)).length },
    dupCount() { return this.preview.items.length - this.newCount },
    excludedSummary() {
      const counts = {}
      for (const x of this.preview.excluded) counts[x.reason] = (counts[x.reason] || 0) + 1
      return Object.entries(counts).map(([r, n]) => this.$t('import.reasonCount', { reason: this.$t(`import.reasons.${r}`), n })).join(' · ')
    },
  },
  watch: {
    'coverJob.running'(running) { if (!running) this.loadMissing() },
  },
  async mounted() {
    this.loadMissing()
    try {
      ({ sources: this.sources } = await api.get('/import/sources'))
    } catch (e) {
      toastError(e)
    }
  },
  methods: {
    findCovers,
    async loadMissing() {
      ({ types: this.missing } = await api.get('/covers/missing').catch(() => ({ types: {} })))
    },
    known(item) { return !!(item.duplicate || item.repeated) },
    async read(file) {
      this.fileName = file.name
      this.step = 'loading'
      const form = new FormData()
      form.append('source', this.source.id)
      form.append('file', file)
      try {
        this.preview = await api.post(this.isCollector ? '/import/collector/preview' : '/import/preview', form)
        // Already in the collection, or a repeated row: shown, but left unticked
        this.selected = this.preview.items.filter((i) => !this.known(i)).map((i) => i.id)
        this.show = 'all'
        this.step = 'preview'
      } catch (e) {
        toastError(e)
        this.step = 'pick'
      }
    },
    async commit(e) {
      const button = e.currentTarget
      this.importing = true
      try {
        const picked = new Set(this.selected)
        const rows = this.preview.items.filter((i) => picked.has(i.id))
        if (this.preview.source === 'collector') {
          // Its covers are copied next, in the background (the progress shows in the app's status pill)
          this.result = await api.post('/import/collector/commit', { token: this.preview.token, items: rows.map((i) => ({ id: i.id, fields: i.fields })) })
          if (this.result.covers.length) copyCovers(this.preview.token, this.result.covers)
        } else {
          this.result = await api.post('/import/commit', { type: this.preview.type, items: rows.map((i) => i.fields) })
        }
        this.step = 'done'
        store.refreshStats()
        this.$nextTick(() => sparkle(button, { count: 30 }))
      } catch (err) {
        toastError(err)
      } finally {
        this.importing = false
      }
    },
    reset() {
      // A previewed archive not imported: deleted on the server now rather than when it expires
      if (this.step === 'preview' && this.preview?.token) api.post('/import/collector/discard', { token: this.preview.token }).catch(() => {})
      this.loadMissing()
      this.step = 'pick'
      this.preview = null
      this.result = null
      this.selected = []
    },
  },
}
</script>

<style scoped>
.intro { margin: 0 0 14px; font-size: 12.5px; line-height: 1.5; }
.small { font-size: 12px; margin: 0; }
.center { text-align: center; justify-content: center; }

.sources { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 6px; }
.source {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--r); border: 1px solid var(--border);
  background: transparent; text-align: left; transition: all 0.2s var(--ease);
}
.source:hover { border-color: var(--border-strong); }
.source .grow { min-width: 0; }
.source strong { display: block; font-size: 13px; font-weight: 600; }
.source small { display: block; font-size: 11.5px; color: var(--faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.source.on { border-color: color-mix(in oklab, var(--c) 50%, transparent); background: color-mix(in oklab, var(--c) 10%, transparent); }
.source-ico {
  width: 30px; height: 30px; border-radius: var(--r-sm); display: grid; place-items: center; flex: none;
  color: var(--c); background: color-mix(in oklab, var(--c) 14%, transparent);
}
.how { margin-top: 14px; padding: 16px 14px; background: var(--surface-2); }
.how-text { line-height: 1.5; }
.rules { display: flex; gap: 6px; align-items: flex-start; margin: 10px 4px 0; font-size: 12px; line-height: 1.5; }
.rules .vue-feather { flex: none; margin-top: 2px; }

.sum-head { display: flex; align-items: center; gap: 10px; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 14px; }
.stats div { display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: var(--r); background: var(--surface-2); }
.stats strong { font-size: 20px; font-variant-numeric: tabular-nums; }
.stats span { font-size: 11.5px; color: var(--faint); text-align: center; }
.excluded { margin-top: 10px; font-size: 12.5px; }
.excluded summary { cursor: pointer; color: var(--muted); }
.excluded ul { list-style: none; margin: 8px 0 0; padding: 0; max-height: 220px; overflow: auto; }
.excluded li { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; border-top: 1px solid var(--border); }

.list { margin-top: 14px; display: block; }
.badge { display: inline-flex; align-items: center; gap: 3px; }
.badge.repeated { background: color-mix(in oklab, var(--success) 14%, transparent); color: var(--success); }
.platform { width: auto; max-width: 46%; height: 32px; font-size: 12.5px; flex: none; }
.platform.missing { border-color: var(--accent-line); }

.missing, .export { margin-top: 12px; }
.export-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.check-line { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
.miss-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
.miss-row + .miss-row { border-top: 1px solid var(--border); }
.miss-row strong { display: block; font-size: 13px; font-weight: 600; }
.miss-row small { display: block; font-size: 11.5px; color: var(--faint); }
.covers-hint { font-size: 12px; margin: 4px 0 0 !important; max-width: 420px; }
</style>
