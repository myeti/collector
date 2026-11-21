<template>
  <!-- Waiting on the sources or the AI: orbiting sparkles, or the photo being scanned -->
  <div class="loading">
    <div v-if="image" class="shot"><img :src="image" alt="" /><span class="beam"></span></div>
    <div v-else class="oracle" aria-hidden="true"><span>✦</span><span>✧</span><span>✦</span></div>
    <p v-if="text" class="display">{{ text }}</p>
    <p v-if="hint" class="faint hint">{{ hint }}</p>
  </div>
</template>

<script>
export default {
  name: 'LoadingState',
  props: { text: String, hint: String, image: String },
}
</script>

<style scoped>
.loading { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 36px 16px; text-align: center; }
.loading .display { font-size: 16px; margin: 6px 0 0; }
.hint { font-size: 12px; margin: 0; }
.oracle { position: relative; width: 70px; height: 70px; }
.oracle span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 20px; color: var(--accent); text-shadow: 0 0 16px var(--accent-glow); animation: orbit 1.6s linear infinite; }
.oracle span:nth-child(2) { animation-delay: -0.53s; color: #fff6c9; font-size: 16px; }
.oracle span:nth-child(3) { animation-delay: -1.06s; color: var(--accent-glow); font-size: 22px; }
@keyframes orbit { from { transform: rotate(0) translateX(24px) rotate(0); } to { transform: rotate(360deg) translateX(24px) rotate(-360deg); } }
.shot { position: relative; width: min(100%, 420px); aspect-ratio: 4 / 3; border-radius: var(--r-lg); overflow: hidden; box-shadow: 0 24px 50px -20px var(--accent-glow); background: var(--surface); }
.shot img { width: 100%; height: 100%; object-fit: cover; }
.beam {
  position: absolute; left: 0; right: 0; height: 30%; top: -30%;
  background: linear-gradient(to bottom, transparent, color-mix(in oklab, var(--accent) 40%, transparent), transparent);
  border-bottom: 2px solid var(--accent); box-shadow: 0 6px 18px var(--accent-glow); animation: beam 2.2s ease-in-out infinite;
}
@keyframes beam { to { top: 100%; } }
@media (prefers-reduced-motion: reduce) { .oracle span, .beam { animation: none; } }
</style>
