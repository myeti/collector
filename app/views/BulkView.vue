<template>
  <div class="page bulk">
    <div class="page-head">
      <button class="icon-btn" :aria-label="$t('common.back')" @click="back"><vue-feather type="arrow-left" size="16" /></button>
      <div class="grow">
        <h1 class="display">{{ $t('bulk.title') }}</h1>
        <p class="muted sub"><vue-feather :type="MEDIA[type].icon" size="13" /> {{ $t(`media.${type}`) }}</p>
      </div>
    </div>

    <!-- 1. Photo -->
    <div v-if="step === 'acquire'" class="drop" :class="{ over: dragOver }" @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop.prevent="onDrop">
      <div class="orb"><vue-feather type="layers" size="24" /></div>
      <p class="muted">{{ $t('bulk.hint') }}</p>
      <label class="btn primary lg">
        <vue-feather type="aperture" size="16" /> {{ $t('photo.take') }}
        <input type="file" accept="image/*" capture="environment" hidden @change="onFile" />
      </label>
      <label class="btn ghost sm">
        {{ $t('photo.choose') }}
        <input type="file" accept="image/*" hidden @change="onFile" />
      </label>
    </div>

    <!-- 2. AI at work -->
    <div v-else-if="step === 'analyzing'" class="analyzing">
      <div class="shot"><img v-if="photo" :src="photo" alt="" /><span class="beam"></span></div>
      <p class="display">{{ $t('bulk.analyzing', { media: $t(`media.${type}`).toLowerCase() }) }}</p>
      <p class="faint small">{{ $t('bulk.patience') }}</p>
    </div>

    <!-- 3. Detected items -->
    <template v-else-if="step === 'list'">
      <div v-if="!bulk.items.length" class="empty">
        <div class="orb"><vue-feather type="eye-off" size="26" /></div>
        <h2 class="display">{{ $t('bulk.none') }}</h2>
        <p>{{ error || $t('bulk.noneText') }}</p>
        <button class="btn primary" @click="restart"><vue-feather type="camera" size="15" /> {{ $t('bulk.another') }}</button>
      </div>

      <template v-else>
        <div class="summary panel">
          <img v-if="photo" :src="photo" alt="" class="thumb" />
          <div class="grow">
            <strong class="display found">{{ $t('bulk.found', bulk.items.length) }}</strong>
            <p class="muted small">{{ counts }}</p>
          </div>
        </div>

        <div v-if="!pendingCount" class="done panel">
          <vue-feather type="check-circle" size="22" class="accent" />
          <div class="grow">
            <strong>{{ $t('bulk.doneTitle') }}</strong>
            <p class="muted small">{{ $t('bulk.doneText', { added: count('added'), skipped: count('skipped') }) }}</p>
          </div>
        </div>

        <ul class="rows panel">
          <li v-for="item in bulk.items" :key="item.id">
            <button class="row-btn" @click="review(item)">
              <span class="num">{{ item.id + 1 }}</span>
              <span class="grow">
                <span class="truncate strong">{{ item.fields.title }}<template v-if="item.fields.volume"> · #{{ item.fields.volume }}</template></span>
                <span class="truncate muted small">{{ item.fields.author || item.fields.saga || ' ' }}</span>
              </span>
              <span class="status" :class="item.status">{{ $t(`bulk.status.${item.status}`) }}</span>
              <vue-feather type="chevron-right" size="14" class="faint" />
            </button>
          </li>
        </ul>

        <div class="actions">
          <button class="btn lg" @click="finish"><vue-feather type="check" size="15" /> {{ $t('bulk.backToCollection') }}</button>
          <button v-if="pendingCount" class="btn primary lg" @click="reviewNext()">
            <vue-feather type="play" size="15" /> {{ count('added') || count('skipped') ? $t('bulk.resume') : $t('bulk.start') }}
          </button>
          <button v-else class="btn primary lg" @click="restart"><vue-feather type="camera" size="15" /> {{ $t('bulk.another') }}</button>
        </div>
      </template>
    </template>

    <!-- 4. One by one -->
    <template v-else-if="step === 'review' && current">
      <div class="progress">
        <div class="bar"><span :style="{ width: `${progress * 100}%` }"></span></div>
        <span class="faint small">{{ $t('bulk.progress', { i: current.id + 1, n: bulk.items.length }) }}</span>
        <button class="btn ghost sm" @click="toList"><vue-feather type="list" size="13" /> {{ $t('bulk.list') }}</button>
      </div>

      <div class="read">
        <span class="faint small">{{ $t('bulk.read') }}</span>
        <strong>{{ [current.fields.title, current.fields.author].filter(Boolean).join(' · ') }}</strong>
      </div>

      <div v-if="current.owned" class="banner">
        <vue-feather type="copy" size="16" />
        <span class="grow">{{ $t('bulk.ownedText', { title: current.owned.title }) }}</span>
        <router-link class="btn sm" :to="`/item/${current.owned.id}`">{{ $t('lookup.seeIt') }}</router-link>
      </div>

      <div v-if="loadingLookup" class="loading">
        <div class="oracle" aria-hidden="true"><span>✦</span><span>✧</span><span>✦</span></div>
        <p class="faint small">{{ $t('lookup.searching') }}</p>
      </div>

      <transition v-else name="fade" mode="out-in">
        <CherryPicker
          :key="current.id" :type="type" :candidates="candidates" :saving="saving"
          @save="saveCurrent" @done="verifyCurrent"
        >
          <template #before-cta>
            <button class="btn" @click="skipCurrent"><vue-feather type="skip-forward" size="15" /> {{ $t('bulk.skip') }}</button>
          </template>
        </CherryPicker>
      </transition>
    </template>
  </div>
</template>

<script>
import CherryPicker from '../components/CherryPicker.vue'
import { api, qs } from '../lib/api.js'
import { store } from '../lib/store.js'
import { toast, toastError } from '../lib/toast.js'
import { sparkle } from '../lib/sparkle.js'
import { bulk, startBulk, clearBulk, nextPending, markBulk } from '../lib/bulk.js'
import { MEDIA } from '../../shared/media.js'

export default {
  name: 'BulkView',
  components: { CherryPicker },
  data() {
    const type = this.$route.params.type
    const resumable = bulk.type === type && bulk.items.length
    return {
      MEDIA,
      bulk,
      type,
      step: resumable ? 'list' : 'acquire',
      photo: null,
      dragOver: false,
      error: '',
      lookups: {}, // id -> candidates (memory only)
      loadingLookup: false,
      saving: false,
    }
  },
  computed: {
    current() { return bulk.items.find((i) => i.id === bulk.current) || null },
    pendingCount() { return this.count('pending') },
    progress() {
      const done = bulk.items.filter((i) => i.status !== 'pending').length
      return bulk.items.length ? done / bulk.items.length : 0
    },
    counts() {
      return ['pending', 'owned', 'added', 'skipped']
        .filter((s) => this.count(s))
        .map((s) => this.$t(`bulk.counts.${s}`, this.count(s)))
        .join(' · ')
    },
    candidates() {
      const item = this.current
      if (!item) return []
      // The AI reading is always a candidate: something to save even when no source knows the item.
      const ai = { source: 'llm', sourceName: item.sourceName || 'AI', type: this.type, fields: item.fields }
      return [ai, ...(this.lookups[item.id] || [])]
    },
  },
  mounted() {
    // Coming back from the form (Verify): continue with the next item.
    if (this.step === 'list' && bulk.reviewing) this.reviewNext(bulk.current ?? -1)
  },
  beforeUnmount() {
    if (this.photo) URL.revokeObjectURL(this.photo)
  },
  methods: {
    count(status) { return bulk.items.filter((i) => i.status === status).length },
    back() {
      if (this.step === 'review') return this.toList()
      if (window.history.state?.back) this.$router.back()
      else this.$router.push(`/c/${this.type}`)
    },
    onDrop(e) {
      this.dragOver = false
      const file = e.dataTransfer.files?.[0]
      if (file?.type.startsWith('image/')) this.analyze(file)
    },
    onFile(e) {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (file) this.analyze(file)
    },
    async analyze(file) {
      if (this.photo) URL.revokeObjectURL(this.photo)
      this.photo = URL.createObjectURL(file)
      this.step = 'analyzing'
      this.error = ''
      const form = new FormData()
      form.append('type', this.type)
      form.append('file', file)
      try {
        const result = await api.post('/lookup/bulk', form)
        startBulk(this.type, result.items)
        this.lookups = {}
        if (result.errors?.length) this.error = result.errors.map((e) => `${e.source}: ${e.message}`).join(' · ')
        this.step = 'list'
      } catch (e) {
        toastError(e)
        this.step = 'acquire'
      }
    },
    restart() {
      clearBulk()
      this.step = 'acquire'
    },
    finish() {
      clearBulk()
      store.refreshStats()
      this.$router.push(`/c/${this.type}`)
    },
    toList() {
      bulk.reviewing = false
      this.step = 'list'
    },
    review(item) {
      bulk.current = item.id
      bulk.reviewing = true
      this.step = 'review'
      window.scrollTo({ top: 0 })
      this.ensureLookup(item)
      // Prefetch the following one so the next review appears instantly.
      const next = nextPending(item.id)
      if (next && next.id !== item.id) this.ensureLookup(next, true)
    },
    reviewNext(afterId = -1) {
      const next = nextPending(afterId)
      if (next) this.review(next)
      else this.toList()
    },
    async ensureLookup(item, background = false) {
      if (this.lookups[item.id]) return
      const f = item.fields
      const q = [f.title, this.type === 'book' || this.type === 'music' ? f.author : '', f.volume].filter(Boolean).join(' ')
      if (!background) this.loadingLookup = true
      try {
        const result = await api.get(`/lookup/search${qs({ q, type: this.type })}`)
        this.lookups = { ...this.lookups, [item.id]: result.candidates.slice(0, 8) }
      } catch {
        this.lookups = { ...this.lookups, [item.id]: [] }
      } finally {
        if (!background && bulk.current === item.id) this.loadingLookup = false
      }
    },
    skipCurrent() {
      const id = this.current.id
      markBulk(id, 'skipped')
      this.reviewNext(id)
    },
    async saveCurrent(fields, button) {
      const id = this.current.id
      this.saving = true
      try {
        const { item } = await api.post('/items', { type: this.type, ...fields })
        markBulk(id, 'added', item.id)
        sparkle(button, { count: 18 })
        toast(this.$t('item.created'), { icon: 'star' })
        store.refreshStats()
        this.reviewNext(id)
      } catch (e) {
        toastError(e)
      } finally {
        this.saving = false
      }
    },
    verifyCurrent(fields) {
      store.draft = { type: this.type, fields, from: 'bulk', bulkId: this.current.id }
      this.$router.push(`/new/${this.type}`)
    },
  },
}
</script>

<style scoped>
.bulk { max-width: 980px; }
.page-head h1 { font-size: clamp(20px, 3vw, 26px); }
.sub { margin: 1px 0 0; display: flex; align-items: center; gap: 5px; font-size: 12px; }
.small { font-size: 12px; margin: 0; }
.strong { font-weight: 600; display: block; }

.drop {
  display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 32px 18px; border-radius: var(--r-lg);
  border: 1.5px dashed var(--border-strong); background: var(--surface); transition: all 0.3s var(--ease);
}
.drop.over { border-color: var(--accent); background: var(--accent-soft); }
.drop p { max-width: 360px; margin: 0; font-size: 13px; }
.orb {
  width: 56px; height: 56px; border-radius: var(--r-lg); display: grid; place-items: center; color: var(--accent-ink);
  background: var(--accent-soft); border: 1px solid var(--accent-line); animation: float 4s ease-in-out infinite;
}

.analyzing { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 24px 16px; text-align: center; }
.analyzing .display { font-size: 16px; margin: 6px 0 0; }
.shot { position: relative; width: min(100%, 420px); aspect-ratio: 4 / 3; border-radius: var(--r-lg); overflow: hidden; box-shadow: 0 24px 50px -20px var(--accent-glow); background: var(--surface); }
.shot img { width: 100%; height: 100%; object-fit: cover; }
.beam {
  position: absolute; left: 0; right: 0; height: 30%; top: -30%;
  background: linear-gradient(to bottom, transparent, color-mix(in oklab, var(--accent) 40%, transparent), transparent);
  border-bottom: 2px solid var(--accent); box-shadow: 0 6px 18px var(--accent-glow); animation: beam 2.2s ease-in-out infinite;
}
@keyframes beam { to { top: 100%; } }

.summary { display: flex; align-items: center; gap: 14px; padding: 12px; }
.thumb { width: 72px; height: 54px; object-fit: cover; border-radius: var(--r); flex: none; }
.found { font-size: 18px; display: block; }
.done { display: flex; align-items: center; gap: 12px; border-color: var(--accent-line); background: var(--accent-soft); }

.rows { list-style: none; margin: 12px 0 0; padding: 4px; }
.row-btn {
  width: 100%; display: flex; align-items: center; gap: 10px; padding: 8px; border: 0; background: none; border-radius: var(--r);
  text-align: left; transition: background 0.15s;
}
.row-btn:hover { background: var(--surface-2); }
li + li { border-top: 1px solid var(--border); }
.num { width: 22px; text-align: right; font-size: 11px; color: var(--faint); font-variant-numeric: tabular-nums; flex: none; }
.status { flex: none; font-size: 10.5px; font-weight: 650; padding: 1px 7px; border-radius: var(--r-xs); line-height: 18px; background: var(--surface-2); color: var(--muted); }
.status.added { background: var(--accent-soft); color: var(--accent-ink); }
.status.owned { background: color-mix(in oklab, var(--success) 14%, transparent); color: var(--success); }
.status.skipped { color: var(--faint); }

.actions {
  display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; margin-top: 14px; position: sticky;
  bottom: calc(var(--bottom-nav) + 12px + var(--safe-bottom)); z-index: 5;
}
.actions .btn:not(.primary) { background: var(--surface-solid); }
.actions .btn.primary { box-shadow: 0 12px 30px -10px var(--accent-glow); }
@media (min-width: 900px) { .actions { bottom: 16px; } }
@media (max-width: 600px) { .actions .btn { flex: 1; } }

.progress { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.bar { flex: 1; height: 4px; border-radius: 2px; background: var(--surface-2); overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--accent); box-shadow: 0 0 8px var(--accent); transition: width 0.5s var(--ease); }
.read { display: flex; flex-direction: column; gap: 1px; margin-bottom: 14px; }
.read strong { font-size: 15px; }
.banner {
  display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: var(--r); margin-bottom: 12px; font-size: 13px;
  background: var(--accent-soft); border: 1px solid var(--accent);
}
.loading { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 0; }
.oracle { position: relative; width: 60px; height: 60px; }
.oracle span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 18px; color: var(--accent); text-shadow: 0 0 14px var(--accent-glow); animation: orbit 1.6s linear infinite; }
.oracle span:nth-child(2) { animation-delay: -0.53s; color: #fff6c9; font-size: 14px; }
.oracle span:nth-child(3) { animation-delay: -1.06s; color: var(--accent-glow); }
@keyframes orbit { from { transform: rotate(0) translateX(22px) rotate(0); } to { transform: rotate(360deg) translateX(22px) rotate(-360deg); } }
</style>
