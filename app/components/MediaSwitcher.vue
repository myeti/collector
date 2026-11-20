<template>
  <div ref="root" class="switcher" :class="{ vertical }" role="tablist">
    <span class="indicator" :style="indicator" aria-hidden="true"></span>
    <button
      v-for="type in types"
      :key="type"
      :ref="(el) => (buttons[type] = el)"
      role="tab"
      :aria-selected="type === modelValue"
      :class="{ on: type === modelValue }"
      :style="{ '--c': ACCENTS[type].color }"
      @click="$emit('update:modelValue', type)"
    >
      <span class="ico"><vue-feather :type="MEDIA[type].icon" :size="vertical ? 16 : 15" /></span>
      <span class="lbl">{{ $t(`media.${type}`) }}</span>
      <span v-if="counts" class="count">{{ store.stats[type]?.count || 0 }}</span>
    </button>
  </div>
</template>

<script>
import { MEDIA, MEDIA_TYPES } from '../../shared/media.js'
import { ACCENTS, store } from '../lib/store.js'

export default {
  name: 'MediaSwitcher',
  props: {
    modelValue: { type: String, required: true },
    vertical: Boolean,
    counts: { type: Boolean, default: true },
    types: { type: Array, default: () => MEDIA_TYPES },
  },
  emits: ['update:modelValue'],
  data: () => ({ MEDIA, ACCENTS, store, buttons: {}, indicator: { opacity: 0 } }),
  watch: {
    modelValue() { this.$nextTick(this.place) },
    types() { this.$nextTick(this.place) },
    '$i18n.locale'() { this.$nextTick(this.place) },
  },
  mounted() {
    this.place()
    this.ro = new ResizeObserver(() => this.place())
    this.ro.observe(this.$refs.root)
  },
  beforeUnmount() { this.ro?.disconnect() },
  methods: {
    place() {
      const el = this.buttons[this.modelValue]
      if (!el) return
      this.indicator = {
        opacity: 1,
        width: `${el.offsetWidth}px`,
        height: `${el.offsetHeight}px`,
        transform: `translate(${el.offsetLeft}px, ${el.offsetTop}px)`,
        '--c': ACCENTS[this.modelValue].color,
      }
      if (!this.vertical) el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
    },
  },
}
</script>

<style scoped>
.switcher {
  position: relative; display: flex; gap: 2px; padding: 3px; border-radius: var(--r-md); background: var(--surface);
  border: 1px solid var(--border); overflow-x: auto; scrollbar-width: none; max-width: 100%;
}
.switcher::-webkit-scrollbar { display: none; }
.indicator {
  position: absolute; top: 0; left: 0; border-radius: var(--r); pointer-events: none;
  background: color-mix(in oklab, var(--c) 16%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--c) 40%, transparent);
  transition: transform 0.4s var(--spring), width 0.4s var(--spring), height 0.3s, background 0.4s, box-shadow 0.4s;
}
button {
  position: relative; z-index: 1; display: flex; align-items: center; gap: 7px; height: 30px; padding: 0 10px;
  border: 0; background: none; border-radius: var(--r); color: var(--muted); font-weight: 550; font-size: 13px; white-space: nowrap;
  transition: color 0.25s; flex: none;
}
button:hover { color: var(--text); }
button.on { color: var(--text); }
button.on .ico { color: var(--c); }
:root[data-theme='light'] button.on .ico { color: color-mix(in oklab, var(--c) 65%, #18181b); }
.ico { display: grid; flex: none; transition: transform 0.35s var(--spring), color 0.25s; }
button.on .ico { transform: scale(1.08); }
.count {
  font-size: 10.5px; font-weight: 650; padding: 0 5px; border-radius: var(--r-xs); background: var(--surface-2); color: var(--faint);
  font-variant-numeric: tabular-nums; line-height: 17px;
}
button.on .count { background: color-mix(in oklab, var(--c) 24%, transparent); color: var(--text); }

.vertical { flex-direction: column; padding: 0; gap: 1px; border: 0; background: none; border-radius: 0; }
.vertical .indicator { border-radius: var(--r); }
.vertical button { height: 34px; width: 100%; padding: 0 10px; font-size: 13.5px; gap: 10px; }
.vertical .lbl { flex: 1; text-align: left; }
.vertical button:not(.on):hover { background: var(--surface-2); }
</style>
