<template>
  <!-- Vertical audio tape, drawn like the feather icons (24 grid, round strokes) -->
  <svg
    :width="tight ? (size * 18) / 22 : size" :height="size" :viewBox="tight ? '3 1 18 22' : '0 0 24 24'"
    fill="none" stroke="currentColor" :stroke-width="strokeWidth" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
    :class="{ neon }"
  >
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <circle cx="10" cy="8" r="2" />
    <circle cx="10" cy="16" r="2" />
    <path d="M12 8v8" />
    <path d="M20 6l-2.6.7a1.4 1.4 0 0 0-1.1 1.4v7.8a1.4 1.4 0 0 0 1.1 1.4L20 18" />
  </svg>
</template>

<script>
export default {
  name: 'AppLogo',
  props: {
    size: { type: [Number, String], default: 24 },
    strokeWidth: { type: [Number, String], default: 2 },
    // Crops the icon padding so the drawing itself is `size` tall.
    tight: Boolean,
    // Neon tube effect in the current accent color (switches on with a flicker, then breathes).
    neon: Boolean,
  },
}
</script>

<style scoped>
.neon {
  /* Bright core + layered halo; drop-shadow follows the strokes, unlike box-shadow */
  color: color-mix(in oklab, var(--accent) 72%, white);
  filter:
    drop-shadow(0 0 1px var(--accent))
    drop-shadow(0 0 4px var(--accent))
    drop-shadow(0 0 10px color-mix(in oklab, var(--accent-glow) 80%, transparent));
  animation: neon-on 0.9s steps(1, end) both, neon-breathe 4.5s ease-in-out 0.9s infinite;
}
@keyframes neon-on {
  0% { opacity: 0.15; }
  12% { opacity: 1; }
  18% { opacity: 0.3; }
  30% { opacity: 1; }
  38% { opacity: 0.55; }
  46%, 100% { opacity: 1; }
}
@keyframes neon-breathe {
  50% {
    filter:
      drop-shadow(0 0 1px var(--accent))
      drop-shadow(0 0 6px var(--accent))
      drop-shadow(0 0 16px color-mix(in oklab, var(--accent-glow) 90%, transparent));
  }
}
/* A glow reads poorly on light backgrounds: keep a faint halo only */
:root[data-theme='light'] .neon {
  color: var(--accent-ink);
  filter: drop-shadow(0 0 3px color-mix(in oklab, var(--accent) 45%, transparent));
  animation: neon-on 0.9s steps(1, end) both;
}
@media (prefers-color-scheme: light) {
  :root[data-theme='auto'] .neon {
    color: var(--accent-ink);
    filter: drop-shadow(0 0 3px color-mix(in oklab, var(--accent) 45%, transparent));
    animation: neon-on 0.9s steps(1, end) both;
  }
}
</style>
