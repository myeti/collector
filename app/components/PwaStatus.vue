<template>
  <!-- App-wide PWA status: new version waiting, offline mode -->
  <div class="pwa-status">
    <transition name="pop">
      <div v-if="pwa.updateReady" class="pill update glass">
        <vue-feather type="refresh-cw" size="14" />
        <span>{{ $t('pwa.update') }}</span>
        <button class="btn sm primary" @click="applyUpdate">{{ $t('pwa.reload') }}</button>
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

export default {
  name: 'PwaStatus',
  data: () => ({ pwa }),
  methods: { applyUpdate },
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
</style>
