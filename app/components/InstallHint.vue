<template>
  <div v-if="visible" class="install" :class="{ flat }">
    <AppLogo class="mark" neon tight :size="30" :stroke-width="1.4" />
    <div class="grow">
      <strong>{{ $t('pwa.installTitle') }}</strong>
      <p v-if="ios">
        <i18n-t keypath="pwa.iosText" tag="span">
          <template #share><vue-feather type="share" size="13" class="share" /></template>
        </i18n-t>
      </p>
      <p v-else>{{ $t('pwa.installText') }}</p>
    </div>
    <button v-if="!ios" class="btn sm primary" @click="install">{{ $t('pwa.install') }}</button>
    <button v-if="dismissible" class="icon-btn sm plain" :aria-label="$t('pwa.dismiss')" :title="$t('pwa.dismiss')" @click="dismiss">
      <vue-feather type="x" size="14" />
    </button>
  </div>
</template>

<script>
import AppLogo from './AppLogo.vue'
import { pwa, canInstall, isIosSafari, promptInstall } from '../lib/pwa.js'

const KEY = 'collector.installHint'

export default {
  name: 'InstallHint',
  components: { AppLogo },
  props: {
    /** Library banner: can be dismissed (remembered on this device). Settings: always shown when installable. */
    dismissible: Boolean,
    flat: Boolean,
  },
  data() {
    let dismissed = false
    try { dismissed = this.dismissible && localStorage.getItem(KEY) === 'dismissed' } catch {}
    return { pwa, dismissed }
  },
  computed: {
    ios() { return isIosSafari() && !this.pwa.promptEvent },
    visible() {
      // canInstall() reads the reactive pwa state: the hint appears as soon as the browser offers installation.
      return !this.dismissed && canInstall()
    },
  },
  methods: {
    async install() {
      if (await promptInstall()) this.dismissed = true
    },
    dismiss() {
      this.dismissed = true
      try { localStorage.setItem(KEY, 'dismissed') } catch {}
    },
  },
}
</script>

<style scoped>
.install {
  display: flex; align-items: center; gap: 12px; padding: 10px 10px 10px 12px; border-radius: var(--r-lg);
  border: 1px solid var(--accent-line); background: var(--accent-soft); animation: rise 0.45s var(--spring) both;
}
.install.flat { background: transparent; border-color: var(--border); }
.install strong { display: block; font-size: 13.5px; font-weight: 600; }
.install p { margin: 1px 0 0; font-size: 12px; color: var(--muted); }
.share { vertical-align: -2px; color: var(--accent-ink); }
.mark { flex: none; }
@keyframes rise { from { opacity: 0; transform: translateY(-6px); } }
</style>
