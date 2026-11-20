<template>
  <div class="toasts" aria-live="polite">
    <transition-group name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast glass" :class="t.type" @click="dismiss(t.id)">
        <vue-feather :type="t.icon" size="16" />
        <span>{{ t.message }}</span>
      </div>
    </transition-group>
  </div>
</template>

<script>
import { toasts, dismiss } from '../lib/toast.js'

export default {
  name: 'Toasts',
  data: () => ({ toasts }),
  methods: { dismiss },
}
</script>

<style scoped>
.toasts {
  position: fixed; z-index: 900; left: 50%; transform: translateX(-50%); top: calc(14px + env(safe-area-inset-top, 0px));
  display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; width: min(92vw, 420px);
}
.toast {
  pointer-events: auto; display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: var(--r-md);
  font-size: 13px; font-weight: 550; box-shadow: var(--shadow-lg); cursor: pointer; max-width: 100%;
  background: color-mix(in oklab, var(--surface-solid) 88%, transparent);
}
.toast.success :deep(i) { color: var(--success); }
.toast.error { border-color: color-mix(in oklab, var(--danger) 50%, transparent); }
.toast.error :deep(i) { color: var(--danger); }
.toast.info :deep(i) { color: var(--accent-ink); }
.toast-enter-active { transition: all 0.5s var(--spring); }
.toast-leave-active { transition: all 0.25s var(--ease); }
.toast-enter-from { opacity: 0; transform: translateY(-20px) scale(0.9); }
.toast-leave-to { opacity: 0; transform: scale(0.9); }
</style>
