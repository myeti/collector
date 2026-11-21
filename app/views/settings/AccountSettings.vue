<template>
  <div>
    <!-- Profile -->
    <section class="panel">
      <div class="panel-title"><vue-feather type="user" size="12" /> {{ $t('settings.profile') }}</div>
      <div class="form-grid">
        <div class="field">
          <label for="s-name">{{ $t('settings.name') }}</label>
          <input id="s-name" v-model.trim="name" class="input" :placeholder="s.user.email" @change="saveProfile({ name })" />
        </div>
        <div class="field">
          <span class="label">{{ $t('settings.language') }}</span>
          <div class="segmented block">
            <button v-for="l in LOCALES" :key="l.id" :class="{ on: s.user.locale === l.id }" @click="saveProfile({ locale: l.id })">{{ l.flag }} {{ l.label }}</button>
          </div>
        </div>
        <div class="field full">
          <span class="label">{{ $t('settings.theme') }}</span>
          <div class="segmented block">
            <button v-for="t in themes" :key="t.id" :class="{ on: s.user.theme === t.id }" @click="saveProfile({ theme: t.id })">
              <vue-feather :type="t.icon" size="13" /> {{ $t(`settings.themes.${t.id}`) }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Application (PWA) -->
    <section v-if="pwa.installed || installable" class="panel">
      <div class="panel-title"><vue-feather type="smartphone" size="12" /> {{ $t('settings.app') }}</div>
      <p v-if="pwa.installed" class="installed"><vue-feather type="check-circle" size="14" /> {{ $t('pwa.installed') }}</p>
      <InstallHint v-else flat />
    </section>

    <!-- Collections (UI only) -->
    <section class="panel">
      <div class="panel-title"><vue-feather type="layers" size="12" /> {{ $t('settings.collections') }}</div>
      <p class="muted intro">{{ $t('settings.collectionsIntro') }}</p>
      <div class="collections">
        <button
          v-for="t in MEDIA_TYPES" :key="t" class="coll" :class="{ on: prefs.types.includes(t) }" :style="{ '--c': ACCENTS[t].color }"
          :disabled="prefs.types.length === 1 && prefs.types.includes(t)" :aria-pressed="prefs.types.includes(t)" @click="toggleType(t)"
        >
          <vue-feather :type="MEDIA[t].icon" size="15" class="coll-ico" />
          <span class="grow">{{ $t(`media.${t}`) }}</span>
          <span class="check"><vue-feather type="check" size="11" stroke-width="3" /></span>
        </button>
      </div>
      <div class="field start">
        <span class="label">{{ $t('settings.startType') }}</span>
        <div class="segmented accent block">
          <button v-for="t in prefs.types" :key="t" :class="{ on: prefs.startType === t }" @click="saveProfile({ startType: t })">
            <vue-feather :type="MEDIA[t].icon" size="13" /> <span class="hide-xs">{{ $t(`media.${t}`) }}</span>
          </button>
        </div>
      </div>
    </section>

    <FamilyPanel />
  </div>
</template>

<script>
import FamilyPanel from '../../components/FamilyPanel.vue'
import InstallHint from '../../components/InstallHint.vue'
import { pwa, canInstall } from '../../lib/pwa.js'
import { ACCENTS } from '../../lib/store.js'
import { settings, saveProfile } from '../../lib/settings.js'
import { LOCALES } from '../../i18n/index.js'
import { MEDIA, MEDIA_TYPES, userPrefs } from '../../../shared/media.js'

export default {
  name: 'AccountSettings',
  components: { FamilyPanel, InstallHint },
  data: () => ({
    name: settings.s?.user?.name || '',
    LOCALES,
    MEDIA,
    MEDIA_TYPES,
    ACCENTS,
    pwa,
    themes: [{ id: 'auto', icon: 'monitor' }, { id: 'light', icon: 'sun' }, { id: 'dark', icon: 'moon' }],
  }),
  computed: {
    s() { return settings.s },
    prefs() { return userPrefs(this.s.user.prefs) },
    installable() { return canInstall() },
  },
  methods: {
    saveProfile,
    toggleType(t) {
      const on = this.prefs.types.includes(t)
      const types = on ? this.prefs.types.filter((x) => x !== t) : [...this.prefs.types, t]
      if (types.length) saveProfile({ types })
    },
  },
}
</script>

<style scoped>
.intro { margin: 0 0 14px; font-size: 12.5px; line-height: 1.5; }
.installed { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 13px; color: var(--success); }
.collections { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; margin-bottom: 14px; }
.coll {
  display: flex; align-items: center; gap: 9px; height: 38px; padding: 0 10px; border-radius: var(--r); border: 1px solid var(--border);
  background: transparent; color: var(--faint); font-weight: 550; font-size: 13px; text-align: left; transition: all 0.2s var(--ease);
}
.coll:hover { border-color: var(--border-strong); color: var(--muted); }
.coll.on { color: var(--text); border-color: color-mix(in oklab, var(--c) 45%, transparent); background: color-mix(in oklab, var(--c) 10%, transparent); }
.coll.on .coll-ico { color: var(--c); }
.coll:disabled { cursor: not-allowed; }
.check {
  width: 16px; height: 16px; border-radius: var(--r-xs); display: grid; place-items: center; border: 1px solid var(--border-strong);
  color: transparent; transition: all 0.25s var(--spring);
}
.coll.on .check { background: var(--c); border-color: transparent; color: #fff; transform: scale(1.05); }
.start .segmented button { gap: 5px; }
@media (max-width: 420px) { .hide-xs { display: none; } }
</style>
