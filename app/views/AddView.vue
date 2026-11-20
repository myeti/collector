<template>
  <div class="page narrow-ish">
    <div class="page-head">
      <button class="icon-btn" :aria-label="$t('common.back')" @click="back"><vue-feather type="arrow-left" size="16" /></button>
      <div class="grow">
        <h1 class="display">{{ heading }}</h1>
        <p class="muted sub"><vue-feather :type="MEDIA[type].icon" size="14" /> {{ $t(`media.${type}`) }}</p>
      </div>
    </div>

    <!-- 1. Acquire -->
    <template v-if="step === 'acquire'">
      <BarcodeScanner v-if="mode === 'scan'" @detected="onBarcode" />

      <form v-else-if="mode === 'search'" class="search-form" @submit.prevent="onSearch">
        <div class="input-wrap grow">
          <span class="lead"><vue-feather type="globe" size="16" /></span>
          <input ref="q" v-model="query" class="input" type="search" enterkeyhint="search" :placeholder="$t('search.placeholder')" />
        </div>
        <button class="btn primary" style="height: var(--h-lg)" :disabled="query.trim().length < 2">{{ $t('search.go') }}</button>
      </form>

      <div v-else-if="mode === 'photo'" class="photo-drop" :class="{ over: dragOver }" @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop.prevent="onDrop">
        <div class="orb"><vue-feather type="camera" size="24" /></div>
        <p class="muted">{{ store.llmEnabled ? $t('add.photoText') : $t('add.photoNoAi') }}</p>
        <label class="btn primary lg">
          <vue-feather type="aperture" size="18" /> {{ $t('photo.take') }}
          <input type="file" accept="image/*" capture="environment" hidden @change="onFile" />
        </label>
        <label class="btn ghost sm">
          {{ $t('photo.choose') }}
          <input type="file" accept="image/*" hidden @change="onFile" />
        </label>
      </div>
    </template>

    <!-- 2. Loading -->
    <div v-else-if="step === 'loading'" class="loading">
      <div v-if="photoPreview" class="photo-scan"><img :src="photoPreview" alt="" /><span class="beam"></span></div>
      <div v-else class="oracle" aria-hidden="true"><span>✦</span><span>✧</span><span>✦</span></div>
      <p class="display">{{ loadingText }}</p>
      <p v-if="barcode" class="mono faint">{{ barcode }}</p>
    </div>

    <!-- 3. Results -->
    <template v-else>
      <div v-if="duplicates.length" class="banner warn">
        <vue-feather type="copy" size="18" />
        <div class="grow">
          <strong>{{ $t('lookup.duplicate') }}</strong>
          <div class="muted">{{ $t('lookup.duplicateText', { title: duplicates[0].title, owner: duplicates[0].owner?.name }) }}</div>
        </div>
        <router-link class="btn sm" :to="`/item/${duplicates[0].id}`">{{ $t('lookup.seeIt') }}</router-link>
      </div>

      <div v-if="typeChanged" class="banner"><vue-feather type="book-open" size="18" /> {{ $t('lookup.detectedBook') }}</div>

      <div class="meta-line faint">
        <span v-if="result?.sources?.length">{{ $t('lookup.sources', { sources: result.sources.join(', ') }) }}</span>
        <span v-if="result?.errors?.length" class="err" :title="result.errors.map((e) => `${e.source}: ${e.message}`).join('\n')">
          <vue-feather type="alert-triangle" size="12" /> {{ $t('lookup.errors', { list: result.errors.map((e) => e.source).join(', ') }) }}
        </span>
      </div>

      <template v-if="candidates.length">
        <div class="pick-head">
          <h2 class="display">{{ $t('lookup.pickTitle') }}</h2>
          <p class="muted">{{ $t('lookup.pickText') }}</p>
        </div>
        <CherryPicker :type="type" :candidates="candidates" :preset="preset" :preset-cover-label="$t('lookup.yourPhoto')" :saving="saving" @done="review" @save="saveNow">
          <template #before-cta>
            <button class="btn" @click="restart"><vue-feather type="rotate-ccw" size="16" /> {{ mode === 'scan' ? $t('scan.again') : $t('common.retry') }}</button>
          </template>
        </CherryPicker>
      </template>

      <div v-else class="empty">
        <div class="orb"><vue-feather type="help-circle" size="26" /></div>
        <h2 class="display">{{ $t('lookup.nothing') }}</h2>
        <p>{{ $t('lookup.nothingText') }}</p>
        <div class="row wrap center">
          <button class="btn" @click="restart"><vue-feather type="rotate-ccw" size="16" /> {{ $t('common.retry') }}</button>
          <button class="btn primary" @click="review({})"><vue-feather type="edit-3" size="16" /> {{ $t('lookup.addManually') }}</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import BarcodeScanner from '../components/BarcodeScanner.vue'
import CherryPicker from '../components/CherryPicker.vue'
import { api, qs } from '../lib/api.js'
import { store } from '../lib/store.js'
import { toast, toastError } from '../lib/toast.js'
import { sparkle } from '../lib/sparkle.js'
import { MEDIA } from '../../shared/media.js'

export default {
  name: 'AddView',
  components: { BarcodeScanner, CherryPicker },
  data() {
    return {
      store,
      MEDIA,
      type: this.$route.params.type,
      mode: this.$route.params.mode,
      step: 'acquire',
      query: this.$route.query.q || '',
      barcode: null,
      result: null,
      duplicates: [],
      preset: {},
      photoPreview: null,
      dragOver: false,
      typeChanged: false,
      saving: false,
    }
  },
  computed: {
    heading() {
      return { scan: this.$t('scan.title'), search: this.$t('search.title'), photo: this.$t('photo.title') }[this.mode]
    },
    candidates() { return this.result?.candidates || [] },
    loadingText() {
      if (this.mode === 'photo') return store.llmEnabled ? this.$t('photo.reading') : this.$t('photo.uploading')
      return this.$t('lookup.searching')
    },
  },
  mounted() {
    if (this.mode === 'search') {
      if (this.query.trim().length >= 2) this.onSearch()
      else this.$nextTick(() => this.$refs.q?.focus())
    }
  },
  beforeUnmount() {
    if (this.photoPreview) URL.revokeObjectURL(this.photoPreview)
  },
  methods: {
    back() {
      if (this.step !== 'acquire') return this.restart()
      if (window.history.state?.back) this.$router.back()
      else this.$router.push(`/c/${this.type}`)
    },
    restart() {
      this.step = 'acquire'
      this.result = null
      this.duplicates = []
      this.preset = {}
      this.barcode = null
      this.typeChanged = false
      if (this.mode === 'search') this.$nextTick(() => this.$refs.q?.focus())
    },
    setResult(result) {
      if (result.type && result.type !== this.type) {
        this.typeChanged = true
        this.type = result.type
        store.setType(result.type)
      }
      this.result = result
      this.step = 'results'
    },
    async onBarcode(code) {
      this.barcode = code
      this.preset = { barcode: code }
      this.step = 'loading'
      try {
        const [result, dup] = await Promise.all([
          api.get(`/lookup/barcode/${code}${qs({ type: this.type })}`),
          api.get(`/items/by-barcode/${code}`).catch(() => ({ items: [] })),
        ])
        this.duplicates = dup.items
        if (result.type === 'book' && /^97[89]/.test(code)) this.preset.isbn = code
        this.setResult(result)
      } catch (e) {
        toastError(e)
        this.restart()
      }
    },
    async onSearch() {
      const q = this.query.trim()
      if (q.length < 2) return
      this.$router.replace({ query: { q } })
      this.step = 'loading'
      try {
        this.setResult(await api.get(`/lookup/search${qs({ q, type: this.type })}`))
      } catch (e) {
        toastError(e)
        this.restart()
      }
    },
    onDrop(e) {
      this.dragOver = false
      const file = e.dataTransfer.files?.[0]
      if (file?.type.startsWith('image/')) this.uploadPhoto(file)
    },
    onFile(e) {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (file) this.uploadPhoto(file)
    },
    async uploadPhoto(file) {
      if (this.photoPreview) URL.revokeObjectURL(this.photoPreview)
      this.photoPreview = URL.createObjectURL(file)
      this.step = 'loading'
      const form = new FormData()
      form.append('type', this.type)
      form.append('file', file)
      try {
        const result = await api.post('/lookup/cover', form)
        this.preset = { cover: result.cover }
        // Nothing to pick from: the photo goes straight to the form.
        if (!result.candidates.length) {
          if (result.errors.length) toastError({ message: result.errors.map((e) => `${e.source}: ${e.message}`).join(' · ') })
          return this.review({ cover: result.cover })
        }
        this.setResult(result)
      } catch (e) {
        toastError(e)
        this.restart()
      }
    },
    /** Saves the picked fields without going through the form. */
    async saveNow(fields, button) {
      this.saving = true
      try {
        const { item } = await api.post('/items', { type: this.type, ...this.preset, ...fields })
        sparkle(button, { count: 24 })
        toast(this.$t('item.created'), { icon: 'star' })
        store.refreshStats()
        this.$router.push({ path: `/item/${item.id}`, query: { from: this.mode } })
      } catch (e) {
        toastError(e)
      } finally {
        this.saving = false
      }
    },
    review(fields) {
      store.draft = { type: this.type, fields: { ...this.preset, ...fields }, from: this.mode }
      this.$router.push(`/new/${this.type}`)
    },
  },
}
</script>

<style scoped>
.narrow-ish { max-width: 980px; }
.sub { margin: 1px 0 0; display: flex; align-items: center; gap: 5px; font-size: 12px; }
.search-form { display: flex; gap: 8px; }

.photo-drop {
  display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 32px 18px; border-radius: var(--r-lg);
  border: 1.5px dashed var(--border-strong); background: var(--surface); transition: all 0.3s var(--ease);
}
.photo-drop.over { border-color: var(--accent); background: color-mix(in oklab, var(--accent) 10%, transparent); transform: scale(1.01); }
.photo-drop p { max-width: 340px; margin: 0; font-size: 13px; }
.photo-drop .orb {
  width: 56px; height: 56px; border-radius: var(--r-lg); display: grid; place-items: center; color: var(--accent-ink);
  background: var(--accent-soft); border: 1px solid var(--accent-line); animation: float 4s ease-in-out infinite;
}

.loading { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 44px 16px; text-align: center; }
.loading .display { font-size: 16px; margin: 0; }
.oracle { position: relative; width: 70px; height: 70px; }
.oracle span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 20px; color: var(--accent); text-shadow: 0 0 16px var(--accent-glow); animation: orbit 1.6s linear infinite; }
.oracle span:nth-child(2) { animation-delay: -0.53s; color: #fff6c9; font-size: 18px; }
.oracle span:nth-child(3) { animation-delay: -1.06s; color: var(--accent-glow); font-size: 22px; }
@keyframes orbit { from { transform: rotate(0) translateX(26px) rotate(0); } to { transform: rotate(360deg) translateX(26px) rotate(-360deg); } }
.photo-scan { position: relative; width: 150px; aspect-ratio: 2 / 3; border-radius: var(--r-md); overflow: hidden; box-shadow: 0 30px 60px -20px var(--accent-glow); }
.photo-scan img { width: 100%; height: 100%; object-fit: cover; }
.beam {
  position: absolute; left: 0; right: 0; height: 30%; top: -30%;
  background: linear-gradient(to bottom, transparent, color-mix(in oklab, var(--accent) 45%, transparent), transparent);
  border-bottom: 2px solid var(--accent); animation: beam 1.8s ease-in-out infinite;
}
@keyframes beam { to { top: 100%; } }

.banner {
  display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: var(--r); margin-bottom: 10px;
  background: color-mix(in oklab, var(--accent) 12%, transparent); border: 1px solid color-mix(in oklab, var(--accent) 35%, transparent);
  font-size: 13px; animation: rise 0.4s var(--spring);
}
.banner.warn { background: var(--accent-soft); border-color: var(--accent); }
.banner.warn > :first-child { color: var(--accent-ink); }
.meta-line { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 11.5px; margin-bottom: 14px; }
.err { display: inline-flex; align-items: center; gap: 4px; color: color-mix(in oklab, var(--danger) 70%, var(--faint)); cursor: help; }
.pick-head { margin-bottom: 16px; }
.pick-head h2 { font-size: 18px; }
.pick-head p { margin: 2px 0 0; font-size: 13px; }
.center { justify-content: center; }
@keyframes rise { from { opacity: 0; transform: translateY(8px); } }
</style>
