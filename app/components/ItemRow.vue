<template>
  <!-- One item in a list: [lead] cover · title / [saga #volume] / author · … · year / badges [end].
       Same lines as the grid cards, per media type (itemLines).
       Library list, photo and search selections, import preview, review queue. -->
  <component :is="as" class="item-row">
    <slot name="lead" />
    <span v-if="thumb" class="thumb" :class="{ sq: item.type === 'music' }">
      <CoverImage :src="item.cover" :title="item.title" :type="item.type" small />
      <slot name="thumb" />
    </span>
    <span class="grow info">
      <span class="title clamp-2" :title="item.title">{{ item.title }}</span>
      <MetaLine v-if="lines.saga.length" class="saga" :groups="lines.saga" />
      <MetaLine v-if="lines.meta.length" class="muted meta" :groups="lines.meta" />
      <span v-if="$slots.badges" class="badges"><slot name="badges" /></span>
    </span>
    <slot name="end" />
  </component>
</template>

<script>
import CoverImage from './CoverImage.vue'
import MetaLine from './MetaLine.vue'
import { itemLines } from '../lib/format.js'

export default {
  name: 'ItemRow',
  components: { CoverImage, MetaLine },
  props: {
    /** The item's fields, with its type */
    item: { type: Object, required: true },
    /** Element to render: div, label (with a checkbox), button, router-link… */
    as: { type: String, default: 'div' },
    thumb: Boolean,
  },
  computed: {
    lines() { return itemLines(this.item) },
  },
}
</script>

<style scoped>
.item-row { display: flex; align-items: center; gap: 12px; padding: 7px 8px; border-radius: var(--r); text-align: left; transition: background 0.15s; min-width: 0; }
button.item-row { width: 100%; border: 0; background: none; color: inherit; }
a.item-row:hover, button.item-row:hover, label.item-row:hover { background: var(--surface-2); }
label.item-row { cursor: pointer; }
.thumb { position: relative; flex: none; width: 38px; aspect-ratio: 2 / 3; border-radius: var(--r-xs); overflow: hidden; background: var(--surface-2); }
.thumb.sq { aspect-ratio: 1; }
.info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.title { font-weight: 600; font-size: 13.5px; line-height: 1.3; }
.meta { font-size: 12px; }
.saga { font-size: 12px; color: var(--accent-ink); }
.badges { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
.badges :deep(.badge) { font-size: 10.5px; line-height: 17px; padding: 0 6px; }
</style>
