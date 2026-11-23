<template>
  <!-- Pick what to add before it happens: photo detections, search results, import preview -->
  <div>
    <div v-if="title" class="head">
      <h2 class="display">{{ title }}</h2>
      <p v-if="text" class="muted">{{ text }}</p>
    </div>

    <div v-if="selectAll || $slots.toolbar" class="toolbar">
      <label v-if="selectAll" class="check-all">
        <input type="checkbox" :checked="allOn" :indeterminate.prop="someOn && !allOn" @change="setAll($event.target.checked)" />
        {{ $t('import.selectAll') }}
      </label>
      <span class="grow"></span>
      <slot name="toolbar" />
    </div>

    <ul v-if="rows.length" class="rows panel">
      <li v-for="row in rows.slice(0, limit)" :key="row.key" :class="{ off: !on(row) }">
        <ItemRow as="label" :item="{ ...row.fields, type: row.type || type, cover: row.cover }" :thumb="thumbs" class="row">
          <template #lead><input type="checkbox" class="check" :checked="on(row)" @change="toggle(row.key, $event.target.checked)" /></template>
          <template #badges>
            <span v-for="s in row.sources || []" :key="s" class="badge">{{ s }}</span>
            <DuplicateBadge :duplicate="row.duplicate" />
            <slot name="badges" :row="row" />
          </template>
        </ItemRow>
        <slot name="end" :row="row" />
      </li>
      <li v-if="rows.length > limit" class="more"><button class="btn ghost sm" @click="limit += pageSize">{{ $t('import.showMore', { n: rows.length - limit }) }}</button></li>
    </ul>
    <p v-else class="muted center nothing">{{ $t('import.nothing') }}</p>

    <div class="action-bar">
      <slot name="before" />
      <button v-if="!selectAll && modelValue.length" class="btn" @click="$emit('update:modelValue', [])">{{ $t('search.clear') }}</button>
      <button class="btn primary" :disabled="!modelValue.length || busy" @click="$emit('confirm', $event)">
        <vue-feather :type="busy ? 'loader' : actionIcon" size="15" :class="{ spin: busy }" /> {{ actionLabel || $t('search.review', { n: modelValue.length }) }}
      </button>
    </div>
  </div>
</template>

<script>
import ItemRow from './ItemRow.vue'
import DuplicateBadge from './DuplicateBadge.vue'

export default {
  name: 'SelectList',
  components: { ItemRow, DuplicateBadge },
  props: {
    type: { type: String, required: true },
    /** [{ key, fields, type?, cover?, sources?, duplicate? }] (the rows shown: filters are the parent's; type: a row of another type) */
    rows: { type: Array, required: true },
    /** Keys of the ticked rows */
    modelValue: { type: Array, required: true },
    title: String,
    text: String,
    /** "Select all" (over the rows shown), for long lists */
    selectAll: Boolean,
    pageSize: { type: Number, default: 200 },
    actionLabel: String,
    actionIcon: { type: String, default: 'play' },
    busy: Boolean,
  },
  emits: ['update:modelValue', 'confirm'],
  data() {
    return { limit: this.pageSize }
  },
  computed: {
    thumbs() { return this.rows.some((r) => r.cover) },
    selected() { return new Set(this.modelValue) },
    allOn() { return this.rows.length > 0 && this.rows.every((r) => this.selected.has(r.key)) },
    someOn() { return this.rows.some((r) => this.selected.has(r.key)) },
  },
  watch: {
    rows() { this.limit = this.pageSize },
  },
  methods: {
    on(row) { return this.selected.has(row.key) },
    toggle(key, on) {
      const rest = this.modelValue.filter((k) => k !== key)
      this.$emit('update:modelValue', on ? [...rest, key] : rest)
    },
    setAll(on) {
      const shown = new Set(this.rows.map((r) => r.key))
      const rest = this.modelValue.filter((k) => !shown.has(k))
      this.$emit('update:modelValue', on ? [...rest, ...shown] : rest)
    },
  },
}
</script>

<style scoped>
.head { margin-bottom: 14px; }
.head h2 { font-size: 18px; }
.head p { margin: 2px 0 0; font-size: 13px; }
.toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 0 0 8px; }
.check-all { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 550; cursor: pointer; }
.rows { list-style: none; margin: 0; padding: 4px; }
.rows li { display: flex; align-items: center; gap: 8px; padding-right: 8px; }
.rows li + li { border-top: 1px solid var(--border); }
.rows li.off :deep(.info) { opacity: 0.5; }
.row { flex: 1; }
.check { flex: none; width: 18px; height: 18px; margin: 0; }
.more { justify-content: center; padding: 8px !important; }
.nothing { padding: 24px 0; text-align: center; }
</style>
