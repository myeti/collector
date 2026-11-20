<template>
  <div class="page form-page">
    <div class="page-head">
      <button class="icon-btn" :aria-label="$t('common.back')" @click="back"><vue-feather type="arrow-left" size="16" /></button>
      <h1 class="display grow truncate">{{ editing ? $t('item.edit') : $t('item.new', { media: $t(`media.one.${form.type}`) }) }}</h1>
    </div>

    <div v-if="loading" class="skeleton" style="height: 400px"></div>

    <form v-else class="layout" novalidate @submit.prevent="save">
      <!-- Cover column -->
      <aside class="cover-col">
        <label class="cover-drop" :class="{ sq: form.type === 'music', busy: coverBusy, has: !!form.cover }">
          <CoverImage :src="form.cover" :title="form.title || '?'" :type="form.type" />
          <span class="cover-overlay">
            <vue-feather :type="coverBusy ? 'loader' : 'camera'" size="18" :class="{ spin: coverBusy }" />
            <span>{{ coverBusy ? (store.llmEnabled && !editing ? $t('photo.reading') : $t('photo.uploading')) : $t('item.coverHint') }}</span>
          </span>
          <input type="file" accept="image/*" hidden :disabled="coverBusy" @change="onCover" />
        </label>
        <div class="cover-actions">
          <button type="button" class="btn ghost sm" @click="askUrl"><vue-feather type="link" size="14" /> URL</button>
          <button v-if="form.cover" type="button" class="btn ghost sm danger" @click="form.cover = null"><vue-feather type="x" size="14" /> {{ $t('common.remove') }}</button>
        </div>
        <p v-if="store.llmEnabled && !editing" class="hint center"><vue-feather type="cpu" size="12" /> {{ $t('item.readCover') }}</p>
      </aside>

      <!-- Fields -->
      <div class="fields-col">
        <MediaSwitcher v-if="!editing && !from" v-model="form.type" :types="store.enabledTypes" :counts="false" class="type-switch" />

        <div class="panel">
          <div class="form-grid">
            <div class="field full">
              <label for="f-title">{{ $t('fields.title') }} *</label>
              <input id="f-title" ref="title" v-model="form.title" class="input title-input" :class="{ invalid: triedSave && !form.title.trim() }" required autocomplete="off" />
            </div>
            <div class="field">
              <label for="f-author">{{ $t(`fields.authorBy.${form.type}`) }}</label>
              <input id="f-author" v-model="form.author" class="input" list="dl-author" autocomplete="off" @focus="suggest('author')" />
            </div>
            <div class="field">
              <label for="f-original">{{ $t('fields.original_title') }}</label>
              <input id="f-original" v-model="form.original_title" class="input" autocomplete="off" />
            </div>

            <!-- Media-specific -->
            <template v-for="f in specific" :key="f">
              <div v-if="f === 'format'" class="field full">
                <span class="label">{{ $t('fields.format') }}</span>
                <div class="segmented accent">
                  <button v-for="opt in formats" :key="opt" type="button" :class="{ on: form.format === opt }" @click="form.format = form.format === opt ? null : opt">
                    {{ $t(`format.${opt}`) }}
                  </button>
                </div>
              </div>
              <div v-else class="field" :class="{ narrow: f === 'volume' }">
                <label :for="`f-${f}`">{{ fieldLabel(f) }}</label>
                <input
                  :id="`f-${f}`" v-model="form[f]" class="input" autocomplete="off"
                  :class="{ mono: f === 'isbn' }" :inputmode="f === 'isbn' || f === 'volume' ? 'numeric' : undefined"
                  :list="SUGGESTABLE.includes(f) ? `dl-${f}` : undefined" @focus="suggest(f)"
                />
              </div>
            </template>

            <div v-if="categories.length" class="field">
              <label for="f-category">{{ categoryLabel }}</label>
              <select id="f-category" v-model="form.category" class="select">
                <option :value="null">—</option>
                <template v-if="form.type === 'videogame'">
                  <optgroup v-for="g in PLATFORM_GROUPS" :key="g.brand" :label="$t(`platformBrand.${g.brand}`)">
                    <option v-for="c in g.platforms" :key="c" :value="c">{{ $t(`category.videogame.${c}`) }}</option>
                  </optgroup>
                </template>
                <option v-for="c in categories" v-else :key="c" :value="c">{{ $t(`category.${form.type}.${c}`) }}</option>
                <option v-if="form.category && !categories.includes(form.category)" :value="form.category">{{ form.category }}</option>
              </select>
            </div>
            <div v-else class="field">
              <label for="f-category-free">{{ categoryLabel }}</label>
              <input id="f-category-free" v-model="form.category" class="input" list="dl-category" @focus="suggest('category')" />
            </div>

            <div class="field">
              <label for="f-genre">{{ $t('fields.genre') }}</label>
              <select v-if="genres.length && !customGenre" id="f-genre" v-model="genreSelect" class="select">
                <option :value="null">—</option>
                <option v-for="g in genres" :key="g" :value="g">{{ $t(`genre.${form.type}.${g}`) }}</option>
                <option value="__custom">{{ $t('fields.customGenre') }}</option>
              </select>
              <div v-else class="input-wrap">
                <input id="f-genre" ref="genre" v-model="form.genre" class="input no-lead" list="dl-genre" @focus="suggest('genre')" />
                <span v-if="genres.length" class="trail">
                  <button type="button" class="icon-btn sm plain" @click="customGenre = false; form.genre = null"><vue-feather type="list" size="14" /></button>
                </span>
              </div>
            </div>

            <div class="field">
              <label for="f-release">{{ $t('fields.release_date') }}</label>
              <input id="f-release" v-model="form.release_date" class="input" :class="{ invalid: !dateValid }" :placeholder="$t('fields.releasePlaceholder')" inputmode="numeric" />
            </div>
            <div class="field">
              <label for="f-barcode">{{ $t('fields.barcode') }}</label>
              <div class="input-wrap">
                <input id="f-barcode" v-model="form.barcode" class="input mono no-lead" inputmode="numeric" />
                <span class="trail">
                  <button type="button" class="btn sm ghost" @click="scanning = true"><vue-feather type="maximize" size="14" /> {{ $t('item.scanBarcode') }}</button>
                </span>
              </div>
            </div>

            <div class="field full">
              <span class="label">{{ $t('fields.condition') }}</span>
              <div class="conditions">
                <button
                  v-for="(c, i) in CONDITIONS" :key="c" type="button" class="cond" :class="{ on: form.condition === c, lit: conditionIndex >= i }"
                  @click="form.condition = form.condition === c ? null : c"
                >
                  <span class="bar"></span>{{ $t(`condition.${c}`) }}
                </button>
              </div>
            </div>

            <label class="field full consumed-row">
              <span class="grow">
                <strong>{{ $t(`consumed.${form.type}`) }}</strong>
                <span class="hint">{{ form.consumed ? $t(`consumed.${form.type}`) : $t(`consumed.not.${form.type}`) }}</span>
              </span>
              <span class="switch"><input v-model="form.consumed" type="checkbox" /><span></span></span>
            </label>

            <div class="field full">
              <label for="f-comment">{{ $t('fields.comment') }}</label>
              <textarea id="f-comment" v-model="form.comment" class="textarea" rows="3"></textarea>
            </div>
          </div>
        </div>

        <div class="actions">
          <button type="button" class="btn ghost lg" @click="back">{{ $t('common.cancel') }}</button>
          <button ref="saveBtn" class="btn primary lg" :disabled="saving">
            <vue-feather :type="saving ? 'loader' : 'check'" size="16" :class="{ spin: saving }" /> {{ $t('common.save') }}
          </button>
        </div>
      </div>
    </form>

    <datalist v-for="(values, f) in suggestions" :id="`dl-${f}`" :key="f">
      <option v-for="v in values" :key="v" :value="v" />
    </datalist>

    <Sheet v-if="scanning" :title="$t('scan.title')" @close="scanning = false">
      <BarcodeScanner @detected="onScanned" />
    </Sheet>

    <Sheet v-if="coverResult" wide :title="$t('lookup.pickTitle')" @close="coverResult = null">
      <p class="muted pick-text">{{ $t('lookup.pickText') }}</p>
      <CherryPicker
        apply-mode :type="form.type" :candidates="coverResult.candidates" :preset="{ cover: coverResult.cover }"
        :preset-cover-label="$t('lookup.yourPhoto')" @done="applyPicked"
      />
    </Sheet>
  </div>
</template>

<script>
import CoverImage from '../components/CoverImage.vue'
import MediaSwitcher from '../components/MediaSwitcher.vue'
import Sheet from '../components/Sheet.vue'
import BarcodeScanner from '../components/BarcodeScanner.vue'
import CherryPicker from '../components/CherryPicker.vue'
import { api, qs } from '../lib/api.js'
import { store } from '../lib/store.js'
import { toast, toastError } from '../lib/toast.js'
import { sparkle } from '../lib/sparkle.js'
import { MEDIA, CONDITIONS, ALL_FIELDS, PLATFORM_GROUPS } from '../../shared/media.js'
import { markBulk } from '../lib/bulk.js'

const SUGGESTABLE = ['author', 'saga', 'editor', 'label', 'director', 'genre', 'category']

function blank(type) {
  const f = Object.fromEntries(ALL_FIELDS.map((k) => [k, null]))
  return { ...f, type, title: '', consumed: false }
}

export default {
  name: 'ItemFormView',
  components: { CoverImage, MediaSwitcher, Sheet, BarcodeScanner, CherryPicker },
  data() {
    return {
      store,
      CONDITIONS,
      PLATFORM_GROUPS,
      SUGGESTABLE,
      form: blank(this.$route.params.type || store.type),
      editing: this.$route.name === 'edit',
      loading: this.$route.name === 'edit',
      saving: false,
      triedSave: false,
      coverBusy: false,
      coverResult: null,
      scanning: false,
      customGenre: false,
      suggestions: {},
      // Add flow this form was reached from (scan, search, photo): the type is already decided.
      from: null,
      // Shelf review (from: 'bulk'): which detected item this form completes.
      bulkId: null,
    }
  },
  computed: {
    specific() { return MEDIA[this.form.type].fields },
    categoryLabel() {
      const key = `fields.categoryBy.${this.form.type}`
      return this.$te(key) ? this.$t(key) : this.$t('fields.category')
    },
    categories() { return MEDIA[this.form.type].categories },
    genres() { return MEDIA[this.form.type].genres },
    formats() { return MEDIA[this.form.type].formats },
    conditionIndex() { return CONDITIONS.indexOf(this.form.condition) },
    dateValid() { return !this.form.release_date || /^\d{4}(-\d{2}(-\d{2})?)?$/.test(this.form.release_date.trim()) },
    genreSelect: {
      get() { return this.form.genre },
      set(v) {
        if (v === '__custom') {
          this.customGenre = true
          this.form.genre = null
          this.$nextTick(() => this.$refs.genre?.focus())
        } else this.form.genre = v
      },
    },
  },
  watch: {
    'form.type'(t) {
      store.applyAccent(t)
      this.suggestions = {}
      this.syncGenreMode()
      if (this.form.category && !MEDIA[t].categories.includes(this.form.category)) this.form.category = null
      if (this.form.format && !MEDIA[t].formats.includes(this.form.format)) this.form.format = null
    },
  },
  async mounted() {
    if (this.editing) {
      try {
        const { item } = await api.get(`/items/${this.$route.params.id}`)
        if (!item.mine) {
          toast(this.$t('item.notMine', { name: item.owner?.name }), { type: 'info' })
          return this.$router.replace(`/item/${item.id}`)
        }
        this.form = { ...blank(item.type), ...item }
        store.setType(item.type)
      } catch (e) {
        toastError(e)
        return this.$router.replace('/')
      } finally {
        this.loading = false
      }
    } else if (store.draft?.type === this.form.type) {
      Object.assign(this.form, store.draft.fields)
      this.from = store.draft.from || null
      this.bulkId = store.draft.bulkId ?? null
      store.draft = null
    }
    this.syncGenreMode()
    this.$nextTick(() => { if (!this.editing && !this.form.title) this.$refs.title?.focus() })
  },
  beforeUnmount() { store.applyAccent() },
  methods: {
    back() {
      if (window.history.state?.back) this.$router.back()
      else this.$router.push(this.editing ? `/item/${this.$route.params.id}` : `/c/${this.form.type}`)
    },
    fieldLabel(f) {
      if (f === 'editor' && this.$te(`fields.editorBy.${this.form.type}`)) return this.$t(`fields.editorBy.${this.form.type}`)
      return this.$t(`fields.${f}`)
    },
    syncGenreMode() {
      this.customGenre = !!this.form.genre && !this.genres.includes(this.form.genre)
    },
    async suggest(field) {
      if (!SUGGESTABLE.includes(field) || this.suggestions[field]) return
      this.suggestions[field] = []
      const { values } = await api.get(`/items/suggestions${qs({ field, type: this.form.type })}`).catch(() => ({ values: [] }))
      this.suggestions[field] = values
    },
    onScanned(code) {
      this.form.barcode = code
      if (this.form.type === 'book' && /^97[89]\d{10}$/.test(code) && !this.form.isbn) this.form.isbn = code
      this.scanning = false
    },
    askUrl() {
      const url = prompt(this.$t('item.useUrl'), /^https?:/.test(this.form.cover || '') ? this.form.cover : 'https://')
      if (url && /^https?:\/\/.+/.test(url.trim())) this.form.cover = url.trim()
    },
    async onCover(e) {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      this.coverBusy = true
      const form = new FormData()
      try {
        // New item + AI configured: the cover is also read to suggest metadata.
        if (store.llmEnabled && !this.editing) {
          form.append('type', this.form.type)
          form.append('file', file)
          const result = await api.post('/lookup/cover', form)
          this.form.cover = result.cover
          if (result.candidates.length) this.coverResult = result
          else if (result.errors.length) toastError({ message: result.errors.map((x) => `${x.source}: ${x.message}`).join(' · ') })
        } else {
          form.append('file', file)
          this.form.cover = (await api.post('/uploads', form)).cover
        }
      } catch (err) {
        toastError(err)
      } finally {
        this.coverBusy = false
      }
    },
    applyPicked(fields) {
      for (const [k, v] of Object.entries(fields)) {
        if (k in this.form) this.form[k] = v
      }
      this.syncGenreMode()
      this.coverResult = null
      sparkle(this.$refs.title, { count: 12 })
    },
    async save() {
      this.triedSave = true
      if (!this.form.title.trim()) {
        toast(this.$t('item.titleRequired'), { type: 'error' })
        return this.$refs.title.focus()
      }
      if (!this.dateValid) return toast(this.$t('errors.invalid_release_date'), { type: 'error' })
      this.saving = true
      try {
        const body = { ...this.form, release_date: this.form.release_date?.trim() || null }
        const { item } = this.editing
          ? await api.put(`/items/${this.$route.params.id}`, body)
          : await api.post('/items', body)
        sparkle(this.$refs.saveBtn, { count: 24 })
        toast(this.editing ? this.$t('item.updated') : this.$t('item.created'), { icon: this.editing ? 'check' : 'star' })
        store.refreshStats()
        if (this.from === 'bulk') {
          // Back to the shelf review, which continues with the next item.
          markBulk(this.bulkId, 'added', item.id)
          this.$router.replace(`/bulk/${item.type}`)
        } else {
          this.$router.replace({ path: `/item/${item.id}`, query: this.from ? { from: this.from } : {} })
        }
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
.form-page { max-width: 1000px; }
.layout { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 24px; align-items: start; }
.cover-col { position: sticky; top: 20px; display: flex; flex-direction: column; gap: 8px; }
.cover-drop {
  position: relative; display: block; aspect-ratio: 2 / 3; border-radius: var(--r-xs) var(--r-md) var(--r-md) var(--r-xs); overflow: hidden; cursor: pointer;
  box-shadow: 0 24px 48px -24px var(--accent-glow), 0 0 0 1px var(--border); transition: transform 0.35s var(--spring);
}
.cover-drop.sq { aspect-ratio: 1; border-radius: var(--r); }
.cover-drop:hover { transform: translateY(-2px); }
.cover-overlay {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  padding: 12px; text-align: center; color: #fff; font-size: 12px; font-weight: 600;
  background: rgb(10 10 12 / 0.6); backdrop-filter: blur(3px); opacity: 0; transition: opacity 0.2s;
}
.cover-drop:not(.has) .cover-overlay, .cover-drop:hover .cover-overlay, .cover-drop.busy .cover-overlay { opacity: 1; }
.cover-drop:not(.has):not(:hover) .cover-overlay { background: rgb(10 10 12 / 0.25); backdrop-filter: none; }
.cover-actions { display: flex; justify-content: center; gap: 2px; }
.center { text-align: center; display: flex; align-items: center; justify-content: center; gap: 4px; margin: 0; }
.fields-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.type-switch { align-self: flex-start; }
.title-input { font-family: var(--font-display); font-size: 17px; font-weight: 400; }
.invalid { border-color: var(--danger) !important; box-shadow: 0 0 0 3px color-mix(in oklab, var(--danger) 16%, transparent) !important; }
.input-wrap > .input.no-lead { padding-left: 12px; padding-right: 96px; }
.conditions { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.cond {
  display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 7px 10px; border-radius: var(--r);
  border: 1px solid var(--border); background: var(--surface); font-size: 12px; font-weight: 550; color: var(--muted); transition: all 0.2s;
}
.cond .bar { width: 100%; height: 3px; border-radius: 2px; background: var(--surface-2); transition: background 0.3s; }
.cond.lit .bar { background: var(--accent); }
.cond.on { border-color: var(--accent-line); color: var(--text); background: var(--accent-soft); }
.consumed-row { flex-direction: row; align-items: center; gap: 12px; padding: 10px 12px; border-radius: var(--r); background: var(--surface); border: 1px solid var(--border); cursor: pointer; }
.consumed-row strong { font-size: 13.5px; font-weight: 600; }
.consumed-row .grow { display: flex; flex-direction: column; }
.actions { display: flex; justify-content: flex-end; gap: 8px; position: sticky; bottom: calc(var(--bottom-nav) + 12px + var(--safe-bottom)); z-index: 5; }
.actions .btn.primary { box-shadow: 0 12px 30px -10px var(--accent-glow); }
.actions .btn.ghost { background: var(--surface-solid); border-color: var(--border); box-shadow: var(--shadow); }
.pick-text { margin: 0 0 14px; font-size: 13px; }
@media (min-width: 900px) { .actions { bottom: 16px; } }
@media (max-width: 760px) {
  .layout { grid-template-columns: 1fr; gap: 16px; }
  .cover-col { position: static; width: min(36vw, 140px); margin: 0 auto; }
  .type-switch { align-self: stretch; }
  .cond { padding: 6px 8px; font-size: 11.5px; }
  .actions .btn.primary { flex: 1; }
}
</style>
