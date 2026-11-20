<template>
  <!-- One line of metadata: names truncate, volume / year never do -->
  <div class="meta-line">
    <template v-for="(group, gi) in groups" :key="gi">
      <span v-if="gi" class="keep sep">·</span>
      <span v-for="(part, pi) in group" :key="pi" :class="part.shrink ? 'shrink' : 'keep'" :title="part.shrink ? part.text : undefined">{{ part.text }}</span>
    </template>
  </div>
</template>

<script>
export default {
  name: 'MetaLine',
  props: { groups: { type: Array, required: true } },
}
</script>

<style scoped>
.meta-line { display: flex; gap: 0.3em; min-width: 0; white-space: nowrap; }
.shrink { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.keep { flex: none; }
</style>
