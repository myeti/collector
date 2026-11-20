<template>
  <div class="cover" :class="[`t-${type}`, { loaded, failed: !src || failed }]" :style="fallback.style">
    <img v-if="src && !failed" :src="src" :alt="title" loading="lazy" decoding="async" @load="loaded = true" @error="failed = true" />
    <div v-if="!src || failed" class="ph">
      <vue-feather :type="icon" :size="small ? 14 : 18" class="ph-ico" />
      <span v-if="!small" class="ph-initials display">{{ fallback.initials }}</span>
      <span v-if="!small" class="ph-title">{{ title }}</span>
    </div>
    <span v-if="type === 'music'" class="disc" aria-hidden="true"></span>
  </div>
</template>

<script>
import { placeholder } from '../lib/cover.js'
import { MEDIA } from '../../shared/media.js'

export default {
  name: 'CoverImage',
  props: { src: String, title: { type: String, default: '' }, type: { type: String, default: 'book' }, small: Boolean },
  data: () => ({ loaded: false, failed: false }),
  computed: {
    fallback() {
      const p = placeholder(this.title, this.type)
      return { style: !this.src || this.failed ? { background: p.background } : {}, initials: p.initials }
    },
    icon() { return MEDIA[this.type]?.icon || 'box' },
  },
  watch: { src() { this.loaded = false; this.failed = false } },
}
</script>

<style scoped>
.cover {
  position: relative; overflow: hidden; border-radius: inherit; width: 100%; height: 100%;
  background: var(--surface-2);
}
.cover:not(.loaded):not(.failed) { background: linear-gradient(100deg, var(--surface) 30%, var(--surface-2) 50%, var(--surface) 70%); background-size: 300% 100%; animation: shimmer 1.6s linear infinite; }
img { width: 100%; height: 100%; object-fit: cover; opacity: 0; transform: scale(1.04); transition: opacity 0.5s var(--ease), transform 0.8s var(--ease); }
.loaded img { opacity: 1; transform: none; }
.ph { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; padding: 12% 10%; color: rgb(255 255 255 / 0.92); }
.ph::after { content: ''; position: absolute; inset: 0; background: linear-gradient(160deg, rgb(255 255 255 / 0.18), transparent 40%); }
.ph-ico { opacity: 0.7; }
.ph-initials { font-size: clamp(20px, 28cqi, 56px); line-height: 1; opacity: 0.95; }
.ph-title { font-size: clamp(9px, 9cqi, 12px); font-weight: 600; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; opacity: 0.85; }
.small .ph { padding: 0; align-items: center; justify-content: center; }
.cover { container-type: inline-size; }
</style>
