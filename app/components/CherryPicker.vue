<template>
  <div class="picker">
    <!-- Whole matches -->
    <section v-if="candidates.length">
      <div class="section-title">
        <span>{{ $t('lookup.matches') }}</span>
        <span class="badge">{{ $t('lookup.found', candidates.length) }}</span>
      </div>
      <div class="matches">
        <button
          v-for="(c, i) in candidates" :key="i" class="match" :class="{ on: takenFrom === i }"
          :style="{ animationDelay: `${i * 50}ms` }" @click="takeAll(i)"
        >
          <div class="m-cover" :class="{ sq: type === 'music' }">
            <CoverImage :src="c.fields.cover" :title="c.fields.title" :type="type" small />
          </div>
          <div class="m-info">
            <strong class="clamp2">{{ c.fields.title }}</strong>
            <span class="muted truncate">{{ [c.fields.author, c.fields.release_date?.slice(0, 4)].filter(Boolean).join(' · ') }}</span>
            <span class="src" :class="{ ai: c.source === 'llm' }">
              <vue-feather :type="c.source === 'llm' ? 'cpu' : 'database'" size="11" /> {{ c.sourceName }}
            </span>
          </div>
          <span class="take"><vue-feather :type="takenFrom === i ? 'check' : 'arrow-down'" size="14" /></span>
        </button>
      </div>
    </section>

    <!-- Covers -->
    <section v-if="covers.length">
      <div class="section-title"><span>{{ $t('fields.cover') }}</span></div>
      <div class="covers">
        <button
          v-for="c in covers" :key="c.url" class="cover-opt" :class="{ on: pick.cover === c.url, sq: type === 'music' }"
          :title="c.sources.join(', ')" @click="pick.cover = pick.cover === c.url ? null : c.url"
        >
          <img :src="c.url" alt="" loading="lazy" @error="dropCover(c.url)" />
          <span class="cover-src">{{ c.label || c.sources[0] }}</span>
          <span class="check"><vue-feather type="check" size="14" stroke-width="3" /></span>
        </button>
      </div>
    </section>

    <!-- Field by field -->
    <section v-if="fieldOptions.length">
      <div class="section-title"><span>{{ $t('lookup.fields') }}</span></div>
      <div class="fields">
        <div v-for="f in fieldOptions" :key="f.field" class="frow">
          <div class="flabel">{{ fieldLabel(f.field) }}</div>
          <div class="fvals">
            <button
              v-for="(o, i) in f.options" :key="i" class="val" :class="{ on: pick[f.field] === o.value, long: f.field === 'description' }"
              :title="o.sources.join(', ')" @click="pick[f.field] = pick[f.field] === o.value ? null : o.value"
            >
              <span class="v-text">{{ display(f.field, o.value) }}</span>
              <span class="v-src">
                <template v-if="o.sources.length > 1"><vue-feather type="users" size="10" /> {{ o.sources.length }}</template>
                <template v-else>{{ o.sources[0] }}</template>
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <div class="action-bar cta" :class="{ inline: applyMode }">
      <slot name="before-cta" />
      <button v-if="applyMode" class="btn primary" :disabled="!pick.title" @click="emit('done')">
        <vue-feather type="check" size="15" /> {{ $t('lookup.apply') }}
      </button>
      <template v-else>
        <button class="btn verify" :disabled="!pick.title || saving" @click="emit('done')">
          <vue-feather type="edit-3" size="14" /> {{ $t('lookup.review') }}
        </button>
        <button ref="save" class="btn primary" :disabled="!pick.title || saving" @click="emit('save')">
          <vue-feather :type="saving ? 'loader' : 'check'" size="15" :class="{ spin: saving }" /> {{ $t('lookup.saveNow') }}
        </button>
      </template>
    </div>
  </div>
</template>

<script>
import CoverImage from './CoverImage.vue'
import { fieldsFor } from '../../shared/media.js'
import { norm } from '../../shared/text.js'

const SKIP = new Set(['cover', 'consumed', 'digitalized', 'condition'])

export default {
  name: 'CherryPicker',
  components: { CoverImage },
  props: {
    type: { type: String, required: true },
    candidates: { type: Array, default: () => [] },
    /** Values that exist before picking (scanned barcode, photo cover…). */
    preset: { type: Object, default: () => ({}) },
    presetCoverLabel: String,
    /** How preset values are tagged ("Current" when completing an existing item). */
    presetLabel: { type: String, default: '✦' },
    /** Keep preset values selected by default (completing an item: fill gaps, don't overwrite). */
    preferPreset: Boolean,
    applyMode: Boolean,
    saving: Boolean,
    /** Picks to restore (back from the form), instead of the automatic ones. */
    initial: { type: Object, default: null },
  },
  // done: continue to the form · save: store the picked fields right away · change: the picks changed (duplicate check)
  emits: ['done', 'save', 'change'],
  data: () => ({ pick: {}, takenFrom: null, broken: [] }),
  computed: {
    fieldOptions() {
      const out = []
      for (const field of fieldsFor(this.type)) {
        if (SKIP.has(field)) continue
        const map = new Map()
        const add = (value, source) => {
          if (value === undefined || value === null || value === '') return
          const key = field === 'release_date' ? String(value) : norm(value)
          if (!key) return
          if (!map.has(key)) map.set(key, { value: String(value), sources: [] })
          const o = map.get(key)
          if (!o.sources.includes(source)) o.sources.push(source)
          // Prefer the most precise date among equivalent ones
          if (field === 'release_date' && String(value).length > o.value.length) o.value = String(value)
        }
        add(this.preset[field], this.presetLabel)
        this.candidates.forEach((c) => add(c.fields[field], c.sourceName))
        // Merge partial dates into the full date that contains them ("2013" ⊂ "2013-05-17")
        if (field === 'release_date') {
          for (const [k, o] of map) {
            const longer = [...map.values()].find((x) => x !== o && x.value.startsWith(o.value))
            if (longer) { longer.sources.push(...o.sources.filter((s) => !longer.sources.includes(s))); map.delete(k) }
          }
        }
        const options = [...map.values()].sort((a, b) => b.sources.length - a.sources.length)
        if (options.length) out.push({ field, options })
      }
      return out
    },
    covers() {
      const list = []
      const add = (url, source, label) => {
        if (!url || this.broken.includes(url)) return
        const existing = list.find((c) => c.url === url)
        if (existing) existing.sources.push(source)
        else list.push({ url, sources: [source], label })
      }
      add(this.preset.cover, this.presetLabel, this.presetCoverLabel)
      this.candidates.forEach((c) => add(c.fields.cover, c.sourceName))
      return list
    },
  },
  watch: {
    candidates: { immediate: true, handler() { this.autoPick() } },
    pick: { deep: true, immediate: true, handler() { this.$emit('change', this.picked()) } },
  },
  methods: {
    /** Default: the value most sources agree on (presets first on ties). */
    autoPick() {
      const pick = {}
      for (const f of this.fieldOptions) {
        const current = this.preferPreset && f.options.find((o) => o.sources.includes(this.presetLabel))
        pick[f.field] = (current || f.options[0]).value
      }
      pick.cover = this.covers[0]?.url || null
      this.pick = this.initial && !this.restored ? { ...pick, cover: null, ...this.initial } : pick
      this.restored = true
      this.takenFrom = null
    },
    takeAll(i) {
      const c = this.candidates[i]
      for (const f of this.fieldOptions) {
        const v = c.fields[f.field]
        if (v === undefined) continue
        const match = f.options.find((o) => (f.field === 'release_date' ? o.value.startsWith(String(v)) : norm(o.value) === norm(v)))
        if (match) this.pick[f.field] = match.value
      }
      if (c.fields.cover && !this.broken.includes(c.fields.cover)) this.pick.cover = c.fields.cover
      this.takenFrom = i
    },
    dropCover(url) {
      this.broken.push(url)
      if (this.pick.cover === url) this.pick.cover = this.covers[0]?.url || null
    },
    fieldLabel(f) {
      if (f === 'author') return this.$t(`fields.authorBy.${this.type}`)
      if (f === 'volume' && this.$te(`fields.volumeBy.${this.type}`)) return this.$t(`fields.volumeBy.${this.type}`)
      if (f === 'format' && this.$te(`fields.formatBy.${this.type}`)) return this.$t(`fields.formatBy.${this.type}`)
      if (f === 'editor' && this.$te(`fields.editorBy.${this.type}`)) return this.$t(`fields.editorBy.${this.type}`)
      return this.$t(`fields.${f}`)
    },
    display(field, value) {
      const key = field === 'format' ? `format.${value}` : ['category', 'genre'].includes(field) ? `${field}.${this.type}.${value}` : null
      return key && this.$te(key) ? this.$t(key) : value
    },
    picked() {
      const out = {}
      for (const [k, v] of Object.entries(this.pick)) if (v !== null && v !== undefined) out[k] = v
      return out
    },
    emit(event) {
      this.$emit(event, this.picked(), this.$refs.save)
    },
  },
}
</script>

<style scoped>
.picker { display: flex; flex-direction: column; gap: 20px; }
.section-title { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 650; text-transform: uppercase; letter-spacing: 0.08em; color: var(--faint); margin-bottom: 8px; }

.matches { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 6px; }
.match {
  position: relative; display: flex; gap: 10px; text-align: left; padding: 7px; border-radius: var(--r); border: 1px solid var(--border);
  background: var(--surface); transition: all 0.25s var(--ease); animation: rise 0.45s var(--spring) both; min-width: 0;
}
.match:hover { border-color: var(--border-strong); background: var(--surface-2); }
.match.on { border-color: var(--accent-line); background: var(--accent-soft); }
.m-cover { width: 40px; aspect-ratio: 2 / 3; border-radius: var(--r-xs); overflow: hidden; flex: none; box-shadow: var(--shadow); }
.m-cover.sq { aspect-ratio: 1; align-self: start; }
.m-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; padding-right: 20px; font-size: 12px; }
.m-info strong { font-size: 13px; font-weight: 600; line-height: 1.3; }
.clamp2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.src { margin-top: auto; display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 650; color: var(--faint); }
.src.ai { color: var(--accent-ink); }
.take { position: absolute; top: 7px; right: 7px; width: 20px; height: 20px; border-radius: var(--r-xs); display: grid; place-items: center; background: var(--surface-2); color: var(--muted); transition: all 0.3s var(--spring); }
.match.on .take { background: var(--accent); color: var(--on-accent); transform: scale(1.1); }

.covers { display: flex; gap: 8px; overflow-x: auto; padding: 6px 4px 10px; margin: -6px -4px -10px; scrollbar-width: thin; }
.cover-opt {
  position: relative; flex: none; width: 84px; aspect-ratio: 2 / 3; border-radius: var(--r); overflow: hidden; padding: 0;
  border: 2px solid transparent; background: var(--surface); transition: all 0.3s var(--spring); box-shadow: var(--shadow);
}
.cover-opt.sq { aspect-ratio: 1; width: 96px; }
.cover-opt img { width: 100%; height: 100%; object-fit: cover; }
.cover-opt:hover { transform: translateY(-3px); }
.cover-opt.on { border-color: var(--accent); box-shadow: 0 14px 30px -10px var(--accent-glow); transform: translateY(-3px) scale(1.02); }
.cover-src { position: absolute; left: 4px; bottom: 4px; right: 4px; font-size: 9.5px; font-weight: 700; color: #fff; padding: 2px 6px; border-radius: var(--r-xs); background: rgb(0 0 0 / 0.55); text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.check { position: absolute; top: 4px; right: 4px; width: 18px; height: 18px; border-radius: var(--r-xs); display: grid; place-items: center; background: var(--accent); color: var(--on-accent); transform: scale(0); transition: transform 0.3s var(--spring); }
.cover-opt.on .check { transform: scale(1); }

.fields { display: flex; flex-direction: column; border-radius: var(--r-lg); border: 1px solid var(--border); background: var(--surface); padding: 2px 4px; }
.frow { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 10px; align-items: start; padding: 8px; }
.frow + .frow { border-top: 1px solid var(--border); }
.flabel { font-size: 12px; font-weight: 550; color: var(--muted); padding-top: 5px; }
.fvals { display: flex; flex-wrap: wrap; gap: 4px; min-width: 0; }
.val {
  display: inline-flex; align-items: center; gap: 6px; max-width: 100%; min-height: 28px; padding: 3px 4px 3px 9px; border-radius: var(--r-sm);
  border: 1px solid var(--border); background: transparent; text-align: left; font-size: 13px; transition: all 0.2s var(--ease);
  color: var(--muted); text-decoration: line-through; text-decoration-color: transparent;
}
.val:hover { border-color: var(--border-strong); color: var(--text); }
.val.on { color: var(--text); border-color: var(--accent-line); background: var(--accent-soft); font-weight: 550; }
.v-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.val.long .v-text { white-space: normal; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; font-size: 12px; }
.v-src { flex: none; font-size: 9.5px; font-weight: 650; padding: 1px 5px; border-radius: var(--r-xs); background: var(--surface-2); color: var(--faint); display: inline-flex; align-items: center; gap: 3px; }
.val.on .v-src { background: color-mix(in oklab, var(--accent) 25%, transparent); color: var(--accent-ink); }

.cta { margin-top: 0; }
/* In a sheet: the sheet scrolls, no bottom bar to clear */
.cta.inline { bottom: 0; }
@media (max-width: 600px) {
  .frow { grid-template-columns: 1fr; gap: 6px; }
  .flabel { padding-top: 0; }
}
@keyframes rise { from { opacity: 0; transform: translateY(10px); } }
</style>
