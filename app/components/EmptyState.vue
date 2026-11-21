<template>
  <!-- An icon in a glowing tile, a title, a line of text, then actions: nothing here (yet), or all done -->
  <div class="empty">
    <div class="orb"><vue-feather :type="icon" size="26" /></div>
    <h2 class="display">{{ title }}</h2>
    <p v-if="text">{{ text }}</p>
    <div v-if="$slots.default" class="row wrap center"><slot /></div>
    <slot name="after" />
  </div>
</template>

<script>
export default {
  name: 'EmptyState',
  props: {
    icon: { type: String, default: 'inbox' },
    title: { type: String, required: true },
    text: String,
  },
}
</script>

<style scoped>
.center { justify-content: center; }
</style>
