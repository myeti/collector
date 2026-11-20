<template>
  <router-link
    :to="`/item/${item.id}`"
    class="card-item"
    :class="[`t-${item.type}`, item.type === 'music' ? 'square' : 'tall']"
    @pointermove="tilt"
    @pointerleave="reset"
  >
    <div ref="art" class="art">
      <CoverImage :src="item.cover" :title="item.title" :type="item.type" />
      <span class="shine" aria-hidden="true"></span>
      <!-- Consumed: a "completed" bar along the bottom edge, like a fully watched episode -->
      <span v-if="item.consumed" class="done" :title="$t(`consumed.${item.type}`)" :aria-label="$t(`consumed.${item.type}`)"></span>
      <span v-if="!item.mine && item.owner" class="owner" :style="{ background: personColor(item.owner.id) }" :title="item.owner.name">{{ initial(item.owner) }}</span>
    </div>
    <div class="meta">
      <!-- {title} / {saga} #{volume} / {author} -->
      <div class="title clamp-2" :title="item.title">{{ item.title }}</div>
      <MetaLine v-if="item.saga || item.volume" class="saga" :groups="sagaGroups" />
      <div class="sub truncate">{{ creator || '\u00a0' }}</div>
    </div>
  </router-link>
</template>

<script>
import CoverImage from './CoverImage.vue'
import MetaLine from './MetaLine.vue'
import { personColor, initial } from '../lib/people.js'
import { metaGroups, creator } from '../lib/format.js'

export default {
  name: 'ItemCard',
  components: { CoverImage, MetaLine },
  props: { item: { type: Object, required: true } },
  computed: {
    sagaGroups() { return metaGroups(this.item, { author: false, year: false }) },
    creator() { return creator(this.item) },
  },
  methods: {
    personColor,
    initial,
    tilt(e) {
      if (e.pointerType !== 'mouse') return
      const el = this.$refs.art
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5
      const y = (e.clientY - r.top) / r.height - 0.5
      el.style.transform = `perspective(700px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) translateY(-4px)`
      el.style.setProperty('--mx', `${(x + 0.5) * 100}%`)
      el.style.setProperty('--my', `${(y + 0.5) * 100}%`)
    },
    reset() {
      if (this.$refs.art) this.$refs.art.style.transform = ''
    },
  },
}
</script>

<style scoped>
.card-item { display: flex; flex-direction: column; gap: 7px; min-width: 0; outline-offset: 3px; }
.art {
  position: relative; border-radius: var(--r-xs) var(--r) var(--r) var(--r-xs); overflow: hidden; aspect-ratio: 2 / 3;
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.05) inset, var(--shadow);
  transition: transform 0.35s var(--ease), box-shadow 0.35s var(--ease); will-change: transform;
}
.square .art { aspect-ratio: 1; border-radius: var(--r-sm); }
.t-movie .art, .t-game .art { border-radius: var(--r-sm); }
.t-book .art::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 6%; z-index: 2; pointer-events: none;
  background: linear-gradient(90deg, rgb(0 0 0 / 0.22), rgb(255 255 255 / 0.1) 40%, transparent);
}
.card-item:hover .art { box-shadow: 0 18px 36px -16px var(--accent-glow), 0 0 0 1px var(--accent-line); }
.shine {
  position: absolute; inset: 0; opacity: 0; transition: opacity 0.3s; pointer-events: none; z-index: 3;
  background: radial-gradient(circle at var(--mx, 50%) var(--my, 0%), rgb(255 255 255 / 0.3), transparent 55%);
  mix-blend-mode: soft-light;
}
.card-item:hover .shine { opacity: 1; }
.done {
  position: absolute; left: 0; right: 0; bottom: 0; height: 3px; z-index: 4; background: var(--accent);
  box-shadow: 0 0 8px var(--accent), 0 0 2px var(--accent);
  transform-origin: left; animation: fill 0.6s var(--ease) both;
}
/* Keep the owner badge clear of the bar */
.done ~ .owner { bottom: 9px; }
.owner {
  position: absolute; z-index: 4; bottom: 6px; right: 6px; width: 20px; height: 20px; border-radius: var(--r-xs);
  display: grid; place-items: center; font-size: 10.5px; font-weight: 700; color: #fff;
  box-shadow: 0 0 0 1.5px rgb(10 10 12 / 0.55), 0 2px 6px rgb(0 0 0 / 0.35);
}
.meta { min-width: 0; }
.title { font-weight: 600; font-size: 13px; line-height: 1.3; }
.saga { font-size: 11.5px; color: var(--accent-ink); }
.sub { font-size: 11.5px; color: var(--faint); }
@media (max-width: 600px) {
  .title { font-size: 12px; }
  .sub, .saga { font-size: 11px; }
  .card-item { gap: 5px; }
}
@keyframes fill { from { transform: scaleX(0); } }
</style>
