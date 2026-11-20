<template>
  <div class="verify">
    <div v-if="!failed" class="stack center">
      <div class="portal" aria-hidden="true"><span></span><span></span><span></span></div>
      <p class="display big">{{ $t('verify.checking') }}</p>
    </div>
    <div v-else class="panel stack center">
      <vue-feather type="link-2" size="32" class="accent" />
      <p class="display big">{{ $t('verify.failed') }}</p>
      <router-link to="/login" class="btn primary">{{ $t('verify.again') }}</router-link>
    </div>
  </div>
</template>

<script>
import { api } from '../lib/api.js'
import { store } from '../lib/store.js'
import { pwa, clearPrivateCaches } from '../lib/pwa.js'

export default {
  name: 'VerifyView',
  data: () => ({ failed: false }),
  async mounted() {
    const token = this.$route.query.token
    if (!token) { this.failed = true; return }
    try {
      const started = Date.now()
      const { user } = await api.post('/auth/verify', { token, installed: pwa.installed })
      // Another account may have used this device: drop its cached data before showing ours.
      await clearPrivateCaches()
      store.setUser(user)
      store.openStartType()
      store.refreshStats()
      store.refreshLlm()
      // Let the portal spin a little: magic needs a moment.
      await new Promise((r) => setTimeout(r, Math.max(0, 900 - (Date.now() - started))))
      this.$router.replace(`/c/${store.type}`)
    } catch {
      this.failed = true
    }
  },
}
</script>

<style scoped>
.verify { min-height: 100dvh; display: grid; place-items: center; padding: 24px; }
.center { align-items: center; text-align: center; }
.big { font-size: 17px; margin: 0; }
.panel { max-width: 400px; }
.portal { position: relative; width: 80px; height: 80px; margin-bottom: 14px; }
.portal span { position: absolute; inset: 0; border-radius: 50%; border: 2px solid transparent; border-top-color: var(--accent); animation: spin 1.4s linear infinite; }
.portal span:nth-child(2) { inset: 10px; border-top-color: var(--accent-glow); animation-duration: 1s; animation-direction: reverse; }
.portal span:nth-child(3) { inset: 22px; border-top-color: #fff6c9; animation-duration: 0.7s; box-shadow: 0 0 30px var(--accent-glow); }
</style>
