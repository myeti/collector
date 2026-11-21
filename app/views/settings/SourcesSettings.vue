<template>
  <div>
    <!-- Metadata sources -->
    <section class="panel">
      <div class="panel-head">
        <div class="panel-title"><vue-feather type="database" size="12" /> {{ $t('settings.apis') }}</div>
        <button class="btn sm" :disabled="!available.length" @click="adding = true">
          <vue-feather type="plus" size="13" /> {{ $t('settings.addSource') }}
        </button>
      </div>
      <p class="muted intro">{{ $t('settings.apisIntro') }}</p>

      <transition-group name="list" tag="div" class="sources">
        <div v-for="c in active" :key="c.id" class="src" :class="{ open: expanded === c.id, pending: !c.enabled }">
          <button class="src-head" :disabled="!c.keys.length" @click="toggle(c)">
            <span class="status" :class="{ on: c.enabled }"></span>
            <span class="src-name">{{ c.name }}</span>
            <span class="media-icons">
              <vue-feather v-for="m in c.media" :key="m" :type="m === '*' ? 'globe' : MEDIA[m].icon" size="12" />
            </span>
            <span class="grow"></span>
            <span class="caps hide-sm">
              <span v-for="cap in c.capabilities" :key="cap" class="badge">{{ $t(`settings.capabilities.${cap}`) }}</span>
            </span>
            <span v-if="!c.keys.length" class="badge success">{{ $t('settings.free') }}</span>
            <span v-else-if="configured(c)" class="badge accent"><vue-feather type="key" size="10" /> {{ $t('settings.keySet') }}</span>
            <span v-else-if="c.keysOptional" class="badge">{{ $t('settings.optionalKey') }}</span>
            <vue-feather v-if="c.keys.length" type="chevron-down" size="14" class="chev" />
          </button>

          <form v-if="expanded === c.id" class="src-body" @submit.prevent="saveKeys(c)">
            <div v-for="(k, i) in c.keys" :key="k.id" class="field">
              <label :for="`k-${k.id}`">{{ k.label }}</label>
              <input
                :id="`k-${k.id}`" :ref="i === 0 ? 'firstKey' : undefined" v-model.trim="keyDrafts[k.id]" class="input mono"
                type="password" autocomplete="off" :placeholder="s.keys[k.id] || $t('settings.keyPlaceholder')"
              />
            </div>
            <div class="row">
              <a :href="c.docs" target="_blank" rel="noopener" class="btn ghost sm"><vue-feather type="external-link" size="12" /> {{ $t('settings.getKey') }}</a>
              <span class="grow"></span>
              <button v-if="configured(c)" type="button" class="btn ghost sm danger" @click="removeKeys(c)">{{ $t('settings.removeSource') }}</button>
              <button v-else type="button" class="btn ghost sm" @click="cancel(c)">{{ $t('common.cancel') }}</button>
              <button class="btn sm primary" :disabled="!c.keys.some((k) => keyDrafts[k.id])">{{ $t('common.save') }}</button>
            </div>
          </form>
        </div>
      </transition-group>
    </section>

    <!-- LLM -->
    <section class="panel">
      <div class="panel-head">
        <div class="panel-title"><vue-feather type="cpu" size="12" /> {{ $t('settings.llm') }}</div>
        <span class="badge" :class="s.llm.enabled ? 'success' : ''">{{ s.llm.enabled ? $t('settings.active') : $t('settings.inactive') }}</span>
      </div>
      <p class="muted intro">{{ $t('settings.llmIntro') }}</p>
      <form class="form-grid" @submit.prevent="saveLlm">
        <div class="field full">
          <label for="s-provider">{{ $t('settings.provider') }}</label>
          <select id="s-provider" v-model="llm.provider" class="select">
            <option v-for="p in s.providers" :key="p.id" :value="p.id">{{ $te(`settings.providerNames.${p.id}`) ? $t(`settings.providerNames.${p.id}`) : p.name }}</option>
          </select>
        </div>
        <div class="field full">
          <label for="s-base">{{ $t('settings.baseUrl') }}<span v-if="!provider?.baseUrl" class="faint"> · {{ $t('common.optional') }}</span></label>
          <input
            id="s-base" v-model.trim="llm.baseUrl" class="input mono" :required="provider?.baseUrl"
            :placeholder="provider?.baseUrl ? 'http://localhost:11434/v1' : ''"
          />
          <span class="hint">{{ provider?.baseUrl ? $t('settings.baseUrlCompatible') : $t('settings.baseUrlHint') }}</span>
        </div>
        <div class="field">
          <label for="s-key">{{ $t('settings.apiKey') }}</label>
          <input id="s-key" v-model.trim="llm.apiKey" class="input mono" type="password" autocomplete="off" :placeholder="s.llm.apiKey || $t('settings.keyPlaceholder')" />
        </div>
        <div class="field">
          <label for="s-model">{{ $t('settings.model') }}</label>
          <input id="s-model" v-model.trim="llm.model" class="input mono" required :placeholder="provider?.example || ''" />
          <span class="hint">{{ $t('settings.modelHint') }}</span>
        </div>
        <div class="full row wrap">
          <span v-if="testResult" class="test" :class="testResult.ok ? 'ok' : 'ko'">
            <vue-feather :type="testResult.ok ? 'check-circle' : 'x-circle'" size="13" />
            {{ testResult.ok ? $t('settings.testOk', { ms: testResult.ms }) : $t('settings.testFail', { error: testResult.error }) }}
          </span>
          <span class="grow"></span>
          <button type="button" class="btn sm" :disabled="!s.llm.enabled || testing" @click="testLlm">
            <vue-feather :type="testing ? 'loader' : 'activity'" size="13" :class="{ spin: testing }" /> {{ $t('settings.test') }}
          </button>
          <button class="btn sm primary">{{ $t('common.save') }}</button>
        </div>
      </form>
    </section>

    <Sheet v-if="adding" :title="$t('settings.addSource')" @close="adding = false">
      <p class="muted intro">{{ $t('settings.addSourceText') }}</p>
      <div class="chips media-filter">
        <button class="chip" :class="{ on: !media }" @click="media = ''">{{ $t('common.all') }}</button>
        <button v-for="m in MEDIA_TYPES.filter((t) => t !== 'custom')" :key="m" class="chip" :class="{ on: media === m }" @click="media = m">
          <vue-feather :type="MEDIA[m].icon" size="12" /> {{ $t(`media.${m}`) }}
        </button>
      </div>
      <div v-if="filteredAvailable.length" class="catalog">
        <button v-for="c in filteredAvailable" :key="c.id" class="cat-item" @click="pick(c)">
          <span class="cat-icons">
            <vue-feather v-for="m in c.media" :key="m" :type="m === '*' ? 'globe' : MEDIA[m].icon" size="13" />
          </span>
          <span class="grow">
            <strong>{{ c.name }}</strong>
            <small>{{ c.capabilities.map((cap) => $t(`settings.capabilities.${cap}`)).join(' · ') }}</small>
          </span>
          <vue-feather type="plus" size="15" class="faint" />
        </button>
      </div>
      <p v-else class="muted center">{{ $t('settings.allActive') }}</p>
    </Sheet>
  </div>
</template>

<script>
import Sheet from '../../components/Sheet.vue'
import { api } from '../../lib/api.js'
import { toast, toastError } from '../../lib/toast.js'
import { settings, applySettings } from '../../lib/settings.js'
import { MEDIA, MEDIA_TYPES } from '../../../shared/media.js'

const llmForm = (s) => ({ provider: s.llm.provider, baseUrl: s.llm.baseUrl, model: s.llm.model, apiKey: '' })

export default {
  name: 'SourcesSettings',
  components: { Sheet },
  data: () => ({
    llm: llmForm(settings.s),
    keyDrafts: {},
    media: '',
    adding: false,
    expanded: null,
    // Sources picked from the catalog whose key is not saved yet.
    pending: [],
    testing: false,
    testResult: null,
    MEDIA,
    MEDIA_TYPES,
  }),
  computed: {
    s() { return settings.s },
    provider() { return this.s.providers?.find((p) => p.id === this.llm.provider) },
    active() { return this.s.connectors.filter((c) => c.enabled || this.pending.includes(c.id)) },
    available() { return this.s.connectors.filter((c) => !c.enabled && !this.pending.includes(c.id)) },
    filteredAvailable() {
      return this.media ? this.available.filter((c) => c.media.includes(this.media) || c.media.includes('*')) : this.available
    },
  },
  methods: {
    apply(s) {
      applySettings(s)
      this.pending = this.pending.filter((id) => !s.connectors.find((c) => c.id === id)?.enabled)
    },
    configured(c) { return c.keys.some((k) => this.s.keys[k.id]) },
    toggle(c) { this.expanded = this.expanded === c.id ? null : c.id },
    pick(c) {
      this.pending.push(c.id)
      this.expanded = c.id
      this.adding = false
      this.$nextTick(() => this.$refs.firstKey?.[0]?.focus?.() ?? this.$refs.firstKey?.focus?.())
    },
    cancel(c) {
      this.pending = this.pending.filter((id) => id !== c.id)
      this.expanded = null
    },
    async saveLlm() {
      const body = { provider: this.llm.provider, baseUrl: this.llm.baseUrl, model: this.llm.model }
      if (this.llm.apiKey) body.apiKey = this.llm.apiKey
      try {
        this.apply(await api.patch('/settings/llm', body))
        this.llm = llmForm(this.s)
        this.testResult = null
        toast(this.$t('settings.saved'))
      } catch (e) {
        toastError(e)
      }
    },
    async testLlm() {
      this.testing = true
      this.testResult = null
      try {
        this.testResult = await api.post('/settings/llm/test')
      } catch (e) {
        this.testResult = { ok: false, error: e.human }
      } finally {
        this.testing = false
      }
    },
    async saveKeys(c) {
      const keys = {}
      for (const k of c.keys) if (this.keyDrafts[k.id]) keys[k.id] = this.keyDrafts[k.id]
      try {
        this.apply(await api.patch('/settings/keys', { keys }))
        for (const id of Object.keys(keys)) this.keyDrafts[id] = ''
        this.expanded = null
        toast(this.$t('settings.keySaved'), { icon: 'key' })
      } catch (e) {
        toastError(e)
      }
    },
    async removeKeys(c) {
      try {
        this.apply(await api.patch('/settings/keys', { keys: Object.fromEntries(c.keys.map((k) => [k.id, null])) }))
        this.expanded = null
        toast(this.$t('settings.keyRemoved'), { icon: 'trash-2', type: 'info' })
      } catch (e) {
        toastError(e)
      }
    },
  },
}
</script>

<style scoped>
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.panel-head .panel-title { margin: 0; }
.intro { margin: 0 0 14px; font-size: 12.5px; line-height: 1.5; }
.test { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; }
.test.ok { color: var(--success); }
.test.ko { color: var(--danger); }

.sources { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: var(--r-md); overflow: hidden; position: relative; }
.src + .src { border-top: 1px solid var(--border); }
.src.open { background: var(--surface); }
.src.pending .src-name { color: var(--muted); }
.src-head {
  width: 100%; display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; border: 0; background: none;
  text-align: left; transition: background 0.15s;
}
.src-head:not(:disabled):hover { background: var(--surface-2); }
.src-head:disabled { cursor: default; opacity: 1; }
.src-name { font-weight: 600; font-size: 13px; }
.status { width: 7px; height: 7px; border-radius: 50%; background: var(--faint); flex: none; }
.status.on { background: var(--success); box-shadow: 0 0 8px var(--success); }
.media-icons { display: flex; gap: 4px; color: var(--faint); }
.caps { display: flex; gap: 4px; }
.chev { color: var(--faint); transition: transform 0.25s var(--ease); }
.open .chev { transform: rotate(180deg); }
.src-body { display: flex; flex-direction: column; gap: 10px; padding: 4px 12px 12px; animation: reveal 0.25s var(--ease); }
@keyframes reveal { from { opacity: 0; transform: translateY(-4px); } }

.media-filter { margin-bottom: 12px; }
.catalog { display: flex; flex-direction: column; gap: 4px; }
.cat-item {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--r); border: 1px solid var(--border);
  background: var(--surface); text-align: left; transition: all 0.15s;
}
.cat-item:hover { border-color: var(--accent-line); background: var(--surface-2); }
.cat-item strong { display: block; font-size: 13px; font-weight: 600; }
.cat-item small { display: block; font-size: 11.5px; color: var(--faint); }
.cat-icons { width: 30px; height: 30px; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; gap: 2px; background: var(--accent-soft); color: var(--accent-ink); flex: none; }
.center { text-align: center; }
@media (max-width: 600px) { .hide-sm { display: none !important; } }
</style>
