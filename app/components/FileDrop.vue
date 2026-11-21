<template>
  <!-- A file from the device: dropped (desktop), taken with the camera, or chosen -->
  <div class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="onDrop">
    <div v-if="icon" class="orb"><vue-feather :type="icon" size="24" /></div>
    <slot />
    <div class="buttons">
      <label v-if="camera" class="btn primary lg">
        <vue-feather type="aperture" size="16" /> {{ $t('photo.take') }}
        <input type="file" :accept="accept" capture="environment" hidden @change="onPick" />
      </label>
      <label class="btn" :class="camera ? 'ghost sm' : 'primary'">
        <vue-feather v-if="!camera" type="file-text" size="15" /> {{ chooseLabel || $t('photo.choose') }}
        <input type="file" :accept="accept" hidden @change="onPick" />
      </label>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FileDrop',
  props: {
    accept: { type: String, default: 'image/*' },
    /** Photos: "Take a photo" with the camera, then "or choose an image" */
    camera: Boolean,
    icon: String,
    chooseLabel: String,
  },
  emits: ['file'],
  data: () => ({ over: false }),
  methods: {
    onDrop(e) {
      this.over = false
      const file = e.dataTransfer.files?.[0]
      if (file) this.$emit('file', file)
    },
    onPick(e) {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (file) this.$emit('file', file)
    },
  },
}
</script>

<style scoped>
.drop {
  display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 28px 18px; border-radius: var(--r-lg);
  border: 1.5px dashed var(--border-strong); background: var(--surface); transition: all 0.3s var(--ease);
}
.drop.over { border-color: var(--accent); background: var(--accent-soft); transform: scale(1.01); }
.drop :slotted(p) { max-width: 380px; margin: 0; font-size: 13px; }
.orb {
  width: 56px; height: 56px; border-radius: var(--r-lg); display: grid; place-items: center; color: var(--accent-ink);
  background: var(--accent-soft); border: 1px solid var(--accent-line); animation: float 4s ease-in-out infinite;
}
.buttons { display: flex; flex-direction: column; align-items: center; gap: 8px; }
</style>
