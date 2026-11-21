<template>
  <!-- App-wide status: new version waiting, offline mode, covers being fetched -->
  <div class="pwa-status">
    <transition name="pop">
      <div v-if="pwa.updateReady" class="pill update glass">
        <vue-feather type="refresh-cw" size="14" />
        <span>{{ $t('pwa.update') }}</span>
        <button class="btn sm primary" @click="applyUpdate">{{ $t('pwa.reload') }}</button>
      </div>
    </transition>
    <transition name="pop">
      <div v-if="coverJob.running" class="pill covers glass" role="status">
        <span class="ring" :style="{ '--p': coverJob.total ? coverJob.done / coverJob.total : 0 }"></span>
        <span>{{ $t('covers.running', { done: coverJob.done, total: coverJob.total }) }}<span class="faint"> · {{ $t('covers.found', coverJob.found) }}</span></span>
        <button class="icon-btn sm plain" :disabled="coverJob.stopping" :title="$t('covers.stop')" :aria-label="$t('covers.stop')" @click="stopCovers">
          <vue-feather :type="coverJob.stopping ? 'loader' : 'x'" size="13" :class="{ spin: coverJob.stopping }" />
        </button>
      </div>
    </transition>
    <transition name="pop">
      <div v-if="!pwa.online" class="pill offline glass">
        <vue-feather type="wifi-off" size="13" />
        <span>{{ $t('pwa.offline') }}</span>
      </div>
    </transition>
  </div>
</template>

<script>
import { pwa, applyUpdate } from '../lib/pwa.js'
import { coverJob, stopCovers } from '../lib/covers.js'

export default {
  name: 'PwaStatus',
  data: () => ({ pwa, coverJob }),
  methods: { applyUpdate, stopCovers },
}
</script>

<style scoped>
.pwa-status {
  position: fixed; z-index: 800; left: 50%; transform: translateX(-50%); top: calc(10px + env(safe-area-inset-top, 0px));
  display: flex; flex-direction: column; align-items: center; gap: 6px; pointer-events: none; width: max-content; max-width: calc(100vw - 24px);
}
.pill {
  pointer-events: auto; display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 550;
  box-shadow: var(--shadow-lg); border-radius: var(--r-lg);
}
.update { padding: 6px 6px 6px 12px; }
.update > :first-child { color: var(--accent-ink); }
.offline { padding: 6px 12px; color: var(--muted); }
.covers { padding: 4px 4px 4px 10px; }
/* Progress as a small ring in the accent color */
.ring {
  width: 14px; height: 14px; border-radius: 50%; flex: none;
  background: conic-gradient(var(--accent) calc(var(--p) * 360deg), var(--surface-2) 0);
  -webkit-mask: radial-gradient(circle, transparent 3.5px, #000 4px); mask: radial-gradient(circle, transparent 3.5px, #000 4px);
  filter: drop-shadow(0 0 3px var(--accent-glow));
}
</style>
