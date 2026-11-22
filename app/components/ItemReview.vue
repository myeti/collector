<template>
  <!-- The single item process: ask the sources, pick a whole result or field by field, then ignore, edit or save -->
  <div class="review">
    <form class="query" @submit.prevent="research">
      <div class="input-wrap grow">
        <span class="lead"><vue-feather :type="mode === 'code' ? 'maximize' : 'search'" size="15" /></span>
        <input v-model="input" class="input" type="search" enterkeyhint="search" :placeholder="$t('review.queryPlaceholder')" :aria-label="$t('review.queryPlaceholder')" />
      </div>
      <button class="btn" :disabled="loading || input.trim().length < 2">{{ $t('search.go') }}</button>
    </form>

    <div v-if="movedTo" class="banner"><vue-feather type="book-open" size="16" /> {{ $t('lookup.detectedBook') }}</div>
    <DuplicateBanner :duplicate="duplicate" />

    <LoadingState v-if="loading" :hint="$t('lookup.searching')" />

    <template v-else>
      <div v-if="result?.sources?.length || result?.errors?.length" class="meta-line faint">
        <span v-if="result.sources?.length">{{ $t('lookup.sources', { sources: result.sources.join(', ') }) }}</span>
        <span v-if="result.errors?.length" class="err" :title="result.errors.map((e) => `${e.source}: ${e.message}`).join('\n')">
          <vue-feather type="alert-triangle" size="12" /> {{ $t('lookup.errors', { list: [...new Set(result.errors.map((e) => e.source))].join(', ') }) }}
        </span>
      </div>

      <CherryPicker
        v-if="candidates.length || preset.cover"
        :type="type" :candidates="candidates" :preset="presetWithFormat" :initial="initial" :saving="saving"
        :apply-mode="apply" :prefer-preset="apply" :preset-label="presetLabel" :preset-cover-label="presetCoverLabel"
        @done="apply ? $emit('apply', $event) : $emit('edit', $event)" @save="(fields, button) => $emit('save', fields, button)"
        @change="checkDuplicate"
      >
        <template v-if="!apply" #before-cta>
          <button class="btn" @click="$emit('ignore')"><vue-feather type="x" size="15" /> {{ $t('review.ignore') }}</button>
        </template>
      </CherryPicker>

      <EmptyState v-else icon="help-circle" :title="$t('lookup.nothing')" :text="apply ? $t('review.nothingApply') : $t('lookup.nothingText')">
        <template v-if="!apply">
          <button class="btn" @click="$emit('ignore')"><vue-feather type="x" size="15" /> {{ $t('review.ignore') }}</button>
          <button class="btn primary" @click="$emit('edit', { ...presetWithFormat })"><vue-feather type="edit-3" size="15" /> {{ $t('lookup.addManually') }}</button>
        </template>
      </EmptyState>
    </template>
  </div>
</template>

<script>
import CherryPicker from './CherryPicker.vue'
import DuplicateBanner from './DuplicateBanner.vue'
import EmptyState from './EmptyState.vue'
import LoadingState from './LoadingState.vue'
import { duplicateWatcher } from '../lib/duplicates.js'
import { lookupFor, parseQuery } from '../lib/lookup.js'
import { defaultFormat } from '../../shared/media.js'
import { toastError } from '../lib/toast.js'

export default {
  name: 'ItemReview',
  components: { CherryPicker, DuplicateBanner, EmptyState, LoadingState },
  props: {
    type: { type: String, required: true },
    /** { code?, text? }: what the sources are asked first */
    query: { type: Object, required: true },
    /** The AI reading of a photo: one more source */
    seed: { type: Object, default: null },
    /** Results already known (picked from a search): shown without asking again */
    known: { type: Array, default: null },
    /** Values the item already has: scanned code, photo cover, or the current values when completing an item */
    preset: { type: Object, default: () => ({}) },
    presetLabel: { type: String, default: '✦' },
    presetCoverLabel: String,
    /** The item being completed ("Search sources" on an existing item): not a duplicate of itself */
    exclude: String,
    initial: { type: Object, default: null },
    /** Completing an existing / manual item: "Apply to form", current values kept by default */
    apply: Boolean,
    saving: Boolean,
  },
  // ignore · edit(fields): open the form · save(fields, button) · apply(fields) · type(newType): an ISBN moved it to books
  emits: ['ignore', 'edit', 'save', 'apply', 'type'],
  data() {
    return { input: this.query.text || this.query.code || '', result: null, loading: false, movedTo: null, duplicate: null }
  },
  computed: {
    mode() { return parseQuery(this.input).code ? 'code' : 'text' },
    candidates() { return [...(this.seed ? [this.seed] : []), ...(this.result?.candidates || [])] },
    /** Format is required: when no source tells it, the type's first one is offered (and picked) */
    presetWithFormat() {
      const first = defaultFormat(this.type)
      if (!first || this.preset.format || this.candidates.some((c) => c.fields.format)) return this.preset
      return { ...this.preset, format: first }
    },
  },
  created() {
    // Strict (same barcode / ISBN) or wide (same title and author), on what would be saved: the picks
    this.watchDuplicate = duplicateWatcher((dup) => { this.duplicate = dup })
  },
  mounted() {
    if (this.known) this.result = { candidates: this.known }
    else this.search(this.query)
    this.checkDuplicate(this.preset) // before any result: the scanned code alone
  },
  methods: {
    async search(query, fresh = false) {
      this.loading = true
      try {
        this.result = await lookupFor(query, this.type, { fresh })
        if (this.result.type && this.result.type !== this.type) {
          this.movedTo = this.result.type
          this.$emit('type', this.result.type)
        }
      } catch (e) {
        toastError(e)
        this.result = { candidates: [], sources: [], errors: [] }
      } finally {
        this.loading = false
      }
    },
    checkDuplicate(fields) {
      this.watchDuplicate(this.type, fields, this.exclude)
    },
    research() {
      if (this.input.trim().length >= 2) this.search(parseQuery(this.input), true)
    },
  },
}
</script>

<style scoped>
.review { display: flex; flex-direction: column; }
.query { display: flex; gap: 8px; margin-bottom: 12px; }
.query .btn { height: var(--h-lg); }
.banner {
  display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: var(--r); margin-bottom: 12px; font-size: 13px;
  background: color-mix(in oklab, var(--accent) 12%, transparent); border: 1px solid color-mix(in oklab, var(--accent) 35%, transparent);
  animation: rise 0.4s var(--spring);
}
.meta-line { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 11.5px; margin-bottom: 14px; }
.err { display: inline-flex; align-items: center; gap: 4px; color: color-mix(in oklab, var(--danger) 70%, var(--faint)); cursor: help; }
@keyframes rise { from { opacity: 0; transform: translateY(8px); } }
</style>
