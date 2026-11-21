<template>
  <div class="auth">
    <div class="lang">
      <button v-for="l in LOCALES" :key="l.id" class="chip" :class="{ on: $i18n.locale === l.id }" @click="setLocale(l.id)">
        {{ l.id.toUpperCase() }}
      </button>
    </div>

    <main class="hero">
      <!-- 1. Mark -->
      <div class="brand">
        <span class="halo" aria-hidden="true"></span>
        <AppLogo neon tight :size="54" :stroke-width="1.4" />
        <h1 class="neon-title">{{ $t('app.name') }}</h1>
      </div>

      <!-- 2. One line, the last word cycles through the collections in their colors -->
      <i18n-t keypath="login.sentence" tag="p" class="sentence">
        <template #media>
          <span class="word-slot">
            <transition name="word" mode="out-in">
              <span :key="type" class="word" :style="{ color: ACCENTS[type].color }">{{ $t(`login.words.${type}`) }}</span>
            </transition>
          </span>
        </template>
      </i18n-t>

      <!-- 3. Form -->
      <transition name="swap" mode="out-in">
        <form v-if="!sent" key="form" class="form" @submit.prevent="submit">
          <label class="field-pill" :class="{ focus: focused }">
            <span class="sr-only">{{ $t('login.email') }}</span>
            <vue-feather type="mail" size="16" class="lead" />
            <input
              ref="email" v-model.trim="email" type="email" autocomplete="email" inputmode="email" required
              :placeholder="$t('login.emailPlaceholder')" @focus="focused = true" @blur="focused = false"
            />
            <button class="go" :disabled="loading || !valid" :aria-label="$t('login.submit')" :title="$t('login.submit')">
              <vue-feather :type="loading ? 'loader' : 'arrow-right'" size="18" :class="{ spin: loading }" />
            </button>
          </label>
        </form>

        <div v-else key="sent" class="sent">
          <div class="envelope"><vue-feather type="mail" size="20" /></div>
          <div>
            <strong>{{ $t('login.sentTitle') }}</strong>
            <p>{{ $t('login.sentText', { email }) }}</p>
          </div>

          <!-- Code from the email: needed by installed apps that cannot receive the link (iOS home screen) -->
          <form class="code" @submit.prevent="verifyCode">
            <label for="login-code">{{ $t('login.codeLabel') }}</label>
            <input
              id="login-code" ref="code" :value="code" class="code-input" :class="{ error: codeError }"
              inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000000" :disabled="verifying"
              @input="onCode"
            />
            <span v-if="codeError" class="code-error">{{ codeError }}</span>
          </form>

          <button class="btn ghost sm" @click="reset">{{ $t('login.another') }}</button>
        </div>
      </transition>
    </main>

    <p class="version">v{{ version }}</p>
  </div>
</template>

<script>
import { api } from '../lib/api.js'
import AppLogo from '../components/AppLogo.vue'
import { toastError } from '../lib/toast.js'
import { LOCALES, setLocale } from '../i18n/index.js'
import { ACCENTS, store } from '../lib/store.js'
import { pwa, clearPrivateCaches } from '../lib/pwa.js'

const CYCLE = ['book', 'music', 'movie', 'videogame']

export default {
  name: 'LoginView',
  components: { AppLogo },
  data: () => ({
    email: '', loading: false, sent: false, focused: false, type: CYCLE[0], LOCALES, ACCENTS,
    attempt: null, code: '', verifying: false, codeError: '',
    version: __APP_VERSION__,
  }),
  computed: {
    // Same linear-time check as the server (server/lib/guard.ts).
    valid() { return this.email.length <= 254 && /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(this.email) },
  },
  mounted() {
    this.$refs.email?.focus()
    store.applyAccent(this.type)
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // The whole page (logo glow, button, background) follows the cycling word.
      this.timer = setInterval(() => {
        this.type = CYCLE[(CYCLE.indexOf(this.type) + 1) % CYCLE.length]
        store.applyAccent(this.type)
      }, 2600)
    }
  },
  beforeUnmount() {
    clearInterval(this.timer)
    store.applyAccent()
  },
  methods: {
    setLocale,
    async submit() {
      if (!this.valid) return
      this.loading = true
      try {
        const { attempt } = await api.post('/auth/magic-link', { email: this.email, locale: this.$i18n.locale })
        this.attempt = attempt
        this.code = ''
        this.codeError = ''
        this.sent = true
        this.$nextTick(() => setTimeout(() => this.$refs.code?.focus(), 300))
      } catch (e) {
        toastError(e)
      } finally {
        this.loading = false
      }
    },
    onCode(e) {
      // Digits only ("440 426" pasted from the email works too), submitted as soon as complete.
      this.code = e.target.value.replace(/\D/g, '').slice(0, 6)
      e.target.value = this.code
      this.codeError = ''
      if (this.code.length === 6) this.verifyCode()
    },
    async verifyCode() {
      if (this.code.length !== 6 || this.verifying) return
      this.verifying = true
      try {
        const { user } = await api.post('/auth/verify-code', { attempt: this.attempt, code: this.code, installed: pwa.installed })
        // Another account may have used this device: drop its cached data before showing ours.
        await clearPrivateCaches()
        store.setUser(user)
        store.openStartType()
        store.refreshStats()
        this.$router.replace(`/c/${store.type}`)
      } catch (e) {
        this.codeError = e.human
        this.code = ''
        this.$nextTick(() => this.$refs.code?.focus())
      } finally {
        this.verifying = false
      }
    },
    reset() {
      this.sent = false
      this.$nextTick(() => this.$refs.email?.focus())
    },
  },
}
</script>

<style scoped>
.auth { position: relative; min-height: 100dvh; display: grid; place-items: center; padding: 24px 20px; overflow: hidden; }
.version {
  position: absolute; left: 0; right: 0; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); margin: 0; text-align: center;
  font-size: 11px; color: var(--faint); letter-spacing: 0.04em; font-variant-numeric: tabular-nums;
}
.lang { position: absolute; top: 16px; right: 16px; display: flex; gap: 4px; z-index: 2; }
.lang .chip { height: 26px; padding: 0 8px; font-size: 11px; }

.hero { width: 100%; max-width: 380px; display: flex; flex-direction: column; align-items: center; text-align: center; }

/* 1. Mark */
.brand { position: relative; display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
.brand h1 { font-size: 42px; }
.halo {
  position: absolute; left: -60px; top: 50%; width: 200px; height: 200px; transform: translateY(-50%); z-index: -1; border-radius: 50%;
  background: radial-gradient(closest-side, color-mix(in oklab, var(--accent-glow) 55%, transparent), transparent);
  filter: blur(30px); opacity: 0.7;
  animation: halo 6s ease-in-out infinite alternate;
}
@keyframes halo { to { transform: translateY(-50%) scale(1.15); opacity: 0.9; } }

/* 2. Sentence */
.sentence { margin: 0 0 34px; font-size: 17px; color: var(--muted); line-height: 1.4; }
.word-slot { display: inline-block; }
.word { display: inline-block; font-weight: 650; text-shadow: 0 0 18px currentColor; transition: color 0.6s var(--ease); }
.word-enter-active { transition: opacity 0.35s var(--ease), transform 0.45s var(--spring), filter 0.35s; }
.word-leave-active { transition: opacity 0.2s ease-in, transform 0.2s ease-in, filter 0.2s; }
.word-enter-from { opacity: 0; transform: translateY(60%); filter: blur(4px); }
.word-leave-to { opacity: 0; transform: translateY(-60%); filter: blur(4px); }

/* 3. Form: one pill, the arrow lives inside */
.form { width: 100%; }
.field-pill {
  display: flex; align-items: center; gap: 8px; height: 52px; padding: 0 6px 0 16px; border-radius: var(--r-lg);
  background: color-mix(in oklab, var(--surface-solid) 85%, transparent); border: 1px solid var(--border-strong);
  backdrop-filter: blur(16px); cursor: text;
  transition: border-color 0.3s, box-shadow 0.4s;
}
.field-pill.focus { border-color: var(--accent-line); box-shadow: 0 0 0 4px color-mix(in oklab, var(--accent) 14%, transparent), 0 18px 40px -20px var(--accent-glow); }
.field-pill .lead { color: var(--faint); flex: none; transition: color 0.3s; }
.field-pill.focus .lead { color: var(--accent); }
.field-pill input { flex: 1; min-width: 0; height: 100%; border: 0; outline: none; background: none; font-size: 15px; }
.field-pill input::placeholder { color: var(--faint); }
.go {
  width: 40px; height: 40px; flex: none; border: 0; border-radius: var(--r); display: grid; place-items: center;
  color: var(--on-accent); background: var(--accent); box-shadow: 0 8px 20px -8px var(--accent-glow);
  transition: transform 0.2s var(--spring), opacity 0.2s;
}
.go:hover:not(:disabled) { transform: translateX(2px); }
.go:disabled { opacity: 0.35; box-shadow: none; cursor: default; }

/* Sent */
.sent {
  width: 100%; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 18px; border-radius: var(--r-lg);
  border: 1px solid var(--accent-line); background: var(--accent-soft);
}
.sent strong { font-size: 15px; }
.sent p { margin: 2px 0 0; font-size: 13px; color: var(--muted); overflow-wrap: anywhere; }
.code { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px; margin: 6px 0 2px; }
.code label { font-size: 12px; color: var(--muted); }
.code-input {
  width: 100%; max-width: 230px; height: 52px; border-radius: var(--r-lg); border: 1px solid var(--accent-line); outline: none;
  background: color-mix(in oklab, var(--surface-solid) 85%, transparent); text-align: center;
  font-family: var(--font-neon); font-size: 28px; letter-spacing: 0.35em; padding-left: 0.35em;
  color: color-mix(in oklab, var(--accent) 22%, white);
  text-shadow: 0 0 2px var(--accent), 0 0 12px color-mix(in oklab, var(--accent) 70%, transparent);
  transition: border-color 0.2s, box-shadow 0.3s;
}
.code-input::placeholder { color: var(--faint); text-shadow: none; letter-spacing: 0.35em; }
.code-input:focus { box-shadow: 0 0 0 4px color-mix(in oklab, var(--accent) 16%, transparent), 0 14px 34px -16px var(--accent-glow); }
.code-input.error { border-color: var(--danger); animation: shake 0.35s; }
.code-error { font-size: 12px; color: var(--danger); }
@keyframes shake { 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
.envelope {
  width: 40px; height: 40px; border-radius: var(--r-md); display: grid; place-items: center;
  color: var(--on-accent); background: var(--accent); animation: float 3s ease-in-out infinite;
}
.swap-enter-active, .swap-leave-active { transition: opacity 0.25s var(--ease), transform 0.3s var(--ease); }
.swap-enter-from { opacity: 0; transform: translateY(8px) scale(0.98); }
.swap-leave-to { opacity: 0; transform: translateY(-6px); }

@media (max-width: 420px) {
  .brand h1 { font-size: 34px; }
  .sentence { font-size: 16px; }
}
</style>
