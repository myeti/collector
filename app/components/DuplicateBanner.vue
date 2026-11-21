<template>
  <!-- Already in the collection: strict (same barcode / ISBN) or wide (same title and author) -->
  <transition name="fade">
    <div v-if="duplicate" class="dup" :class="duplicate.level" role="status">
      <vue-feather :type="duplicate.level === 'strict' ? 'copy' : 'help-circle'" size="16" class="ico" />
      <span class="grow">
        <strong>{{ $t(`duplicate.${duplicate.level}`) }}</strong>
        <span class="muted"> · {{ $t(`duplicate.${duplicate.level}Text`, { title: duplicate.title, by: duplicate.author ? $t('duplicate.by', { author: duplicate.author }) : '' }) }}</span>
      </span>
      <router-link class="btn sm" :to="`/item/${duplicate.id}`">{{ $t('lookup.seeIt') }}</router-link>
    </div>
  </transition>
</template>

<script>
export default {
  name: 'DuplicateBanner',
  props: { duplicate: { type: Object, default: null } },
}
</script>

<style scoped>
.dup { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: var(--r); margin-bottom: 12px; font-size: 13px; line-height: 1.4; }
.dup.strict { background: var(--accent-soft); border: 1px solid var(--accent); }
.dup.strict .ico { color: var(--accent-ink); }
.dup.wide { background: var(--surface); border: 1px dashed var(--border-strong); }
.dup.wide .ico { color: var(--muted); }
.ico { flex: none; }
</style>
