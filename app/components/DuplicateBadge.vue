<template>
  <!-- Same levels as DuplicateBanner, for lists (photo, search, import) -->
  <span v-if="duplicate" class="badge dup" :class="duplicate.level" :title="$t(`duplicate.${duplicate.level}Text`, { title: duplicate.title, by: duplicate.author ? $t('duplicate.by', { author: duplicate.author }) : '' })">
    <vue-feather :type="duplicate.level === 'strict' ? 'copy' : 'help-circle'" size="10" /> {{ $t(`duplicate.${duplicate.level}`) }}
  </span>
</template>

<script>
export default {
  name: 'DuplicateBadge',
  props: { duplicate: { type: Object, default: null } },
}
</script>

<style scoped>
.dup { display: inline-flex; align-items: center; gap: 3px; }
.dup.strict { background: color-mix(in oklab, var(--success) 14%, transparent); color: var(--success); border-color: transparent; }
.dup.wide { background: transparent; color: var(--muted); border: 1px dashed var(--border-strong); }
</style>
