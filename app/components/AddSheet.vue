<template>
  <Sheet :title="$t('add.title', { media: $t(`media.${type}`) })" @close="$emit('close')">
    <MediaSwitcher v-model="type" :types="types" :counts="false" class="types" />
    <div class="tiles">
      <button v-for="(o, i) in options" :key="o.id" class="tile" :style="{ animationDelay: `${i * 60}ms` }" @click="go(o)">
        <span class="tile-ico"><vue-feather :type="o.icon" size="17" /></span>
        <span class="grow">
          <strong>{{ $t(`add.${o.id}`) }}</strong>
          <small>{{ $t(o.text) }}</small>
        </span>
        <vue-feather type="chevron-right" size="16" class="chev" />
      </button>
    </div>
  </Sheet>
</template>

<script>
import Sheet from './Sheet.vue'
import MediaSwitcher from './MediaSwitcher.vue'
import { store } from '../lib/store.js'

export default {
  name: 'AddSheet',
  components: { Sheet, MediaSwitcher },
  emits: ['close'],
  data: () => ({ type: store.type }),
  computed: {
    types() {
      return store.enabledTypes.includes(this.type) ? store.enabledTypes : [...store.enabledTypes, this.type]
    },
    options() {
      return [
        { id: 'scan', icon: 'maximize', text: 'add.scanText', to: `/add/${this.type}/scan` },
        { id: 'photo', icon: 'camera', text: store.llmEnabled ? 'add.photoText' : 'add.photoNoAi', to: `/add/${this.type}/photo` },
        // Several items in one photo: only with an AI configured
        ...(store.llmEnabled ? [{ id: 'bulk', icon: 'layers', text: 'add.bulkText', to: `/bulk/${this.type}` }] : []),
        { id: 'search', icon: 'globe', text: 'add.searchText', to: `/add/${this.type}/search` },
        { id: 'manual', icon: 'edit-3', text: 'add.manualText', to: `/new/${this.type}` },
      ]
    },
  },
  watch: {
    type(t) { store.applyAccent(t) },
  },
  beforeUnmount() { store.applyAccent() },
  methods: {
    go(o) {
      store.draft = null
      store.setType(this.type)
      this.$emit('close')
      this.$router.push(o.to)
    },
  },
}
</script>

<style scoped>
.types { margin-bottom: 14px; }
.tiles { display: grid; gap: 6px; }
.tile {
  display: flex; align-items: center; gap: 12px; text-align: left; padding: 10px 12px; border-radius: var(--r-md);
  border: 1px solid var(--border); background: var(--surface); transition: all 0.25s var(--ease);
  animation: rise 0.5s var(--spring) both;
}
.tile:hover { border-color: var(--accent-line); background: var(--surface-2); }
.tile:active { transform: scale(0.98); }
.tile strong { display: block; font-size: 13.5px; font-weight: 600; }
.tile small { display: block; color: var(--faint); font-size: 12px; line-height: 1.35; margin-top: 1px; }
.tile-ico {
  width: 36px; height: 36px; border-radius: var(--r); display: grid; place-items: center; flex: none; color: var(--accent-ink);
  background: color-mix(in oklab, var(--accent) 16%, transparent); box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--accent) 30%, transparent);
}
.chev { color: var(--faint); transition: transform 0.25s var(--spring); }
.tile:hover .chev { transform: translateX(3px); color: var(--accent-ink); }
@keyframes rise { from { opacity: 0; transform: translateY(12px); } }
</style>
