<template>
  <!-- Tags as chips: Enter or a comma adds what is typed, Backspace in the empty field removes the last one -->
  <div class="tag-input input" :class="{ focused }" @click="$refs.field.focus()">
    <span v-for="t in modelValue" :key="t" class="tag">
      #{{ t }}
      <button type="button" class="x" :aria-label="$t('common.remove')" @click.stop="remove(t)"><vue-feather type="x" size="11" /></button>
    </span>
    <input
      :id="id" ref="field" v-model="text" class="field" :list="`${id}-list`" autocomplete="off" enterkeyhint="done"
      :maxlength="MAX_TAG_LENGTH" :placeholder="modelValue.length ? '' : placeholder" :disabled="modelValue.length >= MAX_TAGS"
      @keydown="onKey" @input="onInput" @focus="focused = true; $emit('focus')" @blur="focused = false; add()"
    />
    <datalist :id="`${id}-list`">
      <option v-for="s in available" :key="s" :value="s" />
    </datalist>
  </div>
</template>

<script>
import { normalizeTags, MAX_TAGS, MAX_TAG_LENGTH } from '../../shared/media.js'

export default {
  name: 'TagInput',
  props: {
    modelValue: { type: Array, default: () => [] },
    id: { type: String, required: true },
    /** Tags already used elsewhere, offered while typing */
    suggestions: { type: Array, default: () => [] },
    placeholder: String,
  },
  emits: ['update:modelValue', 'focus'],
  data: () => ({ text: '', focused: false, MAX_TAGS, MAX_TAG_LENGTH }),
  computed: {
    available() {
      const used = new Set(this.modelValue.map((t) => t.toLocaleLowerCase()))
      return this.suggestions.filter((s) => !used.has(s.toLocaleLowerCase()))
    },
  },
  methods: {
    /** Adds what is typed (several when pasted with commas), spelled like the same tag already in use. */
    add() {
      if (!this.text.trim()) return
      const known = new Map(this.suggestions.map((s) => [s.toLocaleLowerCase(), s]))
      const typed = normalizeTags(this.text).map((t) => known.get(t.toLocaleLowerCase()) || t)
      const next = normalizeTags([...this.modelValue, ...typed])
      this.text = ''
      if (next.length !== this.modelValue.length) this.$emit('update:modelValue', next)
    },
    remove(tag) {
      this.$emit('update:modelValue', this.modelValue.filter((t) => t !== tag))
    },
    onKey(e) {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault()
        this.add()
      } else if (e.key === 'Backspace' && !this.text && this.modelValue.length) {
        this.remove(this.modelValue[this.modelValue.length - 1])
      }
    },
    /** A suggestion picked from the list (or text pasted with commas) is added at once */
    onInput(e) {
      if (this.text.includes(',') || e.inputType === 'insertReplacementText' || (!e.inputType && this.text)) this.add()
    },
  },
}
</script>

<style scoped>
.tag-input { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; height: auto; min-height: var(--h-lg); padding: 5px 8px; cursor: text; }
.tag-input.focused {
  border-color: var(--accent-line);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 16%, transparent);
  background: var(--surface-2);
}
.tag {
  display: inline-flex; align-items: center; gap: 2px; height: 26px; padding: 0 4px 0 9px; border-radius: 13px;
  font-size: 12.5px; font-weight: 550; color: var(--accent-ink); background: var(--accent-soft); border: 1px solid var(--accent-line);
}
.x { display: grid; place-items: center; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 50%; background: none; color: inherit; opacity: 0.7; cursor: pointer; }
.x:hover { opacity: 1; background: color-mix(in oklab, var(--accent) 20%, transparent); }
.field { flex: 1; min-width: 120px; height: 28px; border: 0; outline: none; background: none; font-size: 14px; color: var(--text); padding: 0 4px; }
.field::placeholder { color: var(--faint); }
</style>
