<template>
  <teleport to="body">
    <div class="sheet-backdrop" @click.self="$emit('close')">
      <div class="sheet" :class="{ wide }" role="dialog" aria-modal="true" @keydown.esc="$emit('close')">
        <div class="grabber" aria-hidden="true"></div>
        <header v-if="title || $slots.header" class="sheet-head">
          <slot name="header"><h2 class="display">{{ title }}</h2></slot>
          <button class="icon-btn sm plain" :aria-label="$t('common.close')" @click="$emit('close')">
            <vue-feather type="x" size="18" />
          </button>
        </header>
        <div class="sheet-body"><slot /></div>
        <footer v-if="$slots.footer" class="sheet-foot"><slot name="footer" /></footer>
      </div>
    </div>
  </teleport>
</template>

<script>
export default {
  name: 'Sheet',
  props: { title: String, wide: Boolean },
  emits: ['close'],
  mounted() {
    this.onKey = (e) => e.key === 'Escape' && this.$emit('close')
    window.addEventListener('keydown', this.onKey)
    document.body.style.overflow = 'hidden'
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.onKey)
    document.body.style.overflow = ''
  },
}
</script>

<style scoped>
.sheet-backdrop {
  position: fixed; inset: 0; z-index: 500; display: flex; align-items: flex-end; justify-content: center;
  background: rgb(0 0 0 / 0.55); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(6px);
  animation: fadein 0.25s var(--ease);
}
.sheet {
  width: 100%; max-height: 92dvh; display: flex; flex-direction: column; border-radius: var(--r-lg) var(--r-lg) 0 0;
  background: var(--surface-solid); border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-lg); animation: slideup 0.45s var(--spring); padding-bottom: env(safe-area-inset-bottom, 0px);
}
.grabber { width: 32px; height: 4px; border-radius: var(--r); background: var(--border-strong); margin: 8px auto 0; }
.sheet-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 18px 2px; }
.sheet-head h2 { font-size: 18px; }
.sheet-body { padding: 12px 18px 18px; overflow-y: auto; }
.sheet-foot { padding: 12px 18px 14px; border-top: 1px solid var(--border); display: flex; gap: 10px; justify-content: flex-end; }
@media (min-width: 700px) {
  .sheet-backdrop { align-items: center; padding: 24px; }
  .sheet { max-width: 500px; border-radius: var(--r-lg); animation: zoomin 0.35s var(--spring); }
  .sheet.wide { max-width: 820px; }
  .grabber { display: none; }
  .sheet-head { padding-top: 16px; }
}
@keyframes fadein { from { opacity: 0; } }
@keyframes slideup { from { transform: translateY(100%); } }
@keyframes zoomin { from { opacity: 0; transform: scale(0.94) translateY(10px); } }
</style>
