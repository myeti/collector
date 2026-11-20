<template>
  <div class="item-page">
    <div v-if="item" class="backdrop" aria-hidden="true">
      <img v-if="item.cover" :src="item.cover" alt="" />
    </div>

    <div class="page">
      <div class="page-head">
        <button class="icon-btn" :aria-label="$t('common.back')" @click="back"><vue-feather type="arrow-left" size="16" /></button>
        <div class="grow"></div>
        <template v-if="item?.mine">
          <router-link class="btn" :to="`/item/${item.id}/edit`"><vue-feather type="edit-2" size="14" /> {{ $t('common.edit') }}</router-link>
          <button class="icon-btn danger-hover" :aria-label="$t('common.delete')" @click="remove"><vue-feather type="trash-2" size="15" /></button>
        </template>
      </div>

      <div v-if="!item" class="hero">
        <div class="skeleton art-sk"></div>
        <div class="stack grow"><div class="skeleton" style="height: 40px; width: 70%"></div><div class="skeleton" style="height: 20px; width: 40%"></div></div>
      </div>

      <template v-else>
        <div class="hero">
          <div class="art" :class="{ sq: item.type === 'music' }" @pointermove="tilt" @pointerleave="untilt" ref="art">
            <CoverImage :src="item.cover" :title="item.title" :type="item.type" />
            <span class="shine"></span>
          </div>

          <div class="info">
            <div class="row wrap chips-top">
              <span class="badge accent"><vue-feather :type="MEDIA[item.type].icon" size="12" /> {{ categoryLabel || $t(`media.${item.type}`) }}</span>
              <span v-if="item.format" class="badge">{{ $t(`format.${item.format}`) }}</span>
              <span v-if="item.genre" class="badge">{{ genreLabel }}</span>
            </div>
            <h1 class="display title">{{ item.title }}</h1>
            <p v-if="item.original_title && item.original_title !== item.title" class="muted orig">{{ item.original_title }}</p>
            <p v-if="byline" class="byline">{{ byline }}</p>
            <p v-if="item.saga" class="saga"><vue-feather type="bookmark" size="14" /> {{ item.saga }}<template v-if="item.volume"> · {{ $t('fields.volume') }} {{ item.volume }}</template></p>

            <div class="actions">
              <button
                ref="consumedBtn"
                class="consumed-btn"
                :class="{ on: item.consumed }"
                :disabled="!item.mine"
                @click="toggleConsumed"
              >
                <span class="tick"><vue-feather type="check" size="13" stroke-width="3" /></span>
                {{ item.consumed ? $t(`consumed.${item.type}`) : $t(`consumed.mark.${item.type}`) }}
              </button>
              <div v-if="item.condition" class="condition" :title="$t('fields.condition')">
                <span v-for="(c, i) in CONDITIONS" :key="c" class="pip" :class="{ on: i <= CONDITIONS.indexOf(item.condition) }"></span>
                <span class="muted">{{ $t(`condition.${item.condition}`) }}</span>
              </div>
            </div>

            <p v-if="!item.mine" class="owner muted">
              <span class="owner-av" :style="{ background: personColor(item.owner?.id) }">{{ initial(item.owner) }}</span>
              {{ $t('item.ownedBy', { name: item.owner?.name }) }}
            </p>
          </div>
        </div>

        <div class="panel details">
          <div class="panel-title"><vue-feather type="info" size="14" /> {{ $t('item.details') }}</div>
          <dl>
            <template v-for="d in details" :key="d.key">
              <dt>{{ d.label }}</dt>
              <dd :class="{ mono: d.mono }">{{ d.value }}</dd>
            </template>
          </dl>
          <template v-if="item.comment">
            <hr class="divider" />
            <p class="comment">{{ item.comment }}</p>
          </template>
          <p class="faint added">{{ $t('item.addedOn', { date: new Date(item.created_at).toLocaleDateString($i18n.locale, { dateStyle: 'long' }) }) }}</p>
        </div>
      </template>

      <!-- Just added from an add flow: chain the next one -->
      <div v-if="item && anotherMode" class="another">
        <router-link class="btn primary lg" :to="`/add/${item.type}/${anotherMode}`" replace>
          <vue-feather :type="anotherMode === 'scan' ? 'maximize' : anotherMode === 'photo' ? 'camera' : 'globe'" size="16" />
          {{ $t(`item.another.${anotherMode}`) }}
        </router-link>
      </div>
    </div>
  </div>
</template>

<script>
import CoverImage from '../components/CoverImage.vue'
import { api } from '../lib/api.js'
import { store } from '../lib/store.js'
import { toast, toastError } from '../lib/toast.js'
import { sparkle, vibrate } from '../lib/sparkle.js'
import { MEDIA, CONDITIONS } from '../../shared/media.js'
import { personColor, initial } from '../lib/people.js'

export default {
  name: 'ItemView',
  components: { CoverImage },
  data: () => ({ item: null, MEDIA, CONDITIONS }),
  computed: {
    anotherMode() {
      const from = this.$route.query.from
      return ['scan', 'search', 'photo'].includes(from) ? from : null
    },
    categoryLabel() {
      const i = this.item
      if (!i.category) return ''
      return this.$te(`category.${i.type}.${i.category}`) ? this.$t(`category.${i.type}.${i.category}`) : i.category
    },
    genreLabel() {
      const i = this.item
      return this.$te(`genre.${i.type}.${i.genre}`) ? this.$t(`genre.${i.type}.${i.genre}`) : i.genre
    },
    byline() {
      const i = this.item
      return [i.author, i.type === 'movie' ? i.director : null].filter(Boolean).join(' · ')
    },
    details() {
      const i = this.item
      const t = (k) => this.$t(`fields.${k}`)
      const rows = [
        ['release_date', this.formatDate(i.release_date)],
        ['director', i.director],
        ['editor', i.editor, this.$te(`fields.editorBy.${i.type}`) ? this.$t(`fields.editorBy.${i.type}`) : t('editor')],
        ['label', i.label],
        ['isbn', i.isbn, null, true],
        ['barcode', i.barcode !== i.isbn ? i.barcode : null, null, true],
        ...Object.entries(i.extra || {}).map(([k, v]) => [k, v, k]),
      ]
      return rows.filter((r) => r[1]).map(([key, value, label, mono]) => ({ key, value, label: label || t(key), mono }))
    },
  },
  async mounted() {
    try {
      const { item } = await api.get(`/items/${this.$route.params.id}`)
      this.item = item
      store.setType(item.type)
    } catch (e) {
      toastError(e)
      this.$router.replace('/')
    }
  },
  methods: {
    personColor,
    initial,
    back() {
      if (window.history.state?.back) this.$router.back()
      else this.$router.push(`/c/${this.item?.type || store.type}`)
    },
    formatDate(d) {
      if (!d) return null
      if (d.length === 4) return d
      const [y, m, day] = d.split('-').map(Number)
      const date = new Date(y, m - 1, day || 1)
      return date.toLocaleDateString(this.$i18n.locale, day ? { dateStyle: 'long' } : { year: 'numeric', month: 'long' })
    },
    async toggleConsumed() {
      const value = !this.item.consumed
      this.item.consumed = value
      if (value) {
        sparkle(this.$refs.consumedBtn)
        vibrate([10, 40, 20])
      }
      try {
        await api.patch(`/items/${this.item.id}/consumed`, { consumed: value })
        store.refreshStats()
      } catch (e) {
        this.item.consumed = !value
        toastError(e)
      }
    },
    async remove() {
      if (!confirm(this.$t('item.deleteConfirm', { title: this.item.title }))) return
      try {
        await api.delete(`/items/${this.item.id}`)
        toast(this.$t('item.deleted'), { icon: 'trash-2', type: 'info' })
        store.refreshStats()
        this.$router.replace(`/c/${this.item.type}`)
      } catch (e) {
        toastError(e)
      }
    },
    tilt(e) {
      if (e.pointerType !== 'mouse') return
      const el = this.$refs.art
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5
      const y = (e.clientY - r.top) / r.height - 0.5
      el.style.transform = `perspective(900px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg)`
      el.style.setProperty('--mx', `${(x + 0.5) * 100}%`)
      el.style.setProperty('--my', `${(y + 0.5) * 100}%`)
    },
    untilt() { this.$refs.art.style.transform = '' },
  },
}
</script>

<style scoped>
.item-page { position: relative; }
.backdrop { position: absolute; inset: 0 0 auto; height: 380px; overflow: hidden; z-index: -1; mask-image: linear-gradient(to bottom, #000 10%, transparent); -webkit-mask-image: linear-gradient(to bottom, #000 10%, transparent); }
.backdrop img { width: 100%; height: 100%; object-fit: cover; filter: blur(70px) saturate(1.3); opacity: 0.22; transform: scale(1.3); }
.page { max-width: 920px; }
.hero { display: grid; grid-template-columns: minmax(0, 220px) minmax(0, 1fr); gap: 32px; align-items: start; margin-bottom: 20px; }
.art {
  position: relative; aspect-ratio: 2 / 3; border-radius: var(--r-xs) var(--r-md) var(--r-md) var(--r-xs); overflow: hidden;
  box-shadow: 0 30px 60px -28px var(--accent-glow), 0 14px 30px -16px rgb(0 0 0 / 0.6);
  transition: transform 0.5s var(--ease); animation: arrive 0.7s var(--spring);
}
.art.sq { aspect-ratio: 1; border-radius: var(--r); }
.art-sk { width: 100%; aspect-ratio: 2 / 3; }
.shine { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at var(--mx, 30%) var(--my, 10%), rgb(255 255 255 / 0.25), transparent 50%); mix-blend-mode: soft-light; }
.info { display: flex; flex-direction: column; gap: 8px; padding-top: 2px; }
.title { font-size: clamp(24px, 3.6vw, 34px); line-height: 1.1; }
.orig { margin: -2px 0 0; font-style: italic; font-size: 13px; }
.byline { margin: 0; font-size: 15px; font-weight: 550; color: var(--muted); }
.saga { margin: 0; color: var(--accent-ink); display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 13px; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin-top: 8px; }
.consumed-btn {
  display: inline-flex; align-items: center; gap: 8px; height: var(--h); padding: 0 12px 0 5px; border-radius: var(--r);
  border: 1px solid var(--border-strong); background: var(--surface); font-weight: 600; font-size: 13px; transition: all 0.3s var(--spring);
}
.consumed-btn .tick { width: 24px; height: 24px; border-radius: var(--r-sm); display: grid; place-items: center; border: 1.5px dashed var(--border-strong); color: transparent; transition: all 0.3s var(--spring); }
.consumed-btn:hover:not(:disabled) .tick { border-color: var(--accent); color: var(--accent-ink); }
.consumed-btn.on { border-color: var(--accent-line); background: var(--accent-soft); color: var(--accent-ink); }
.consumed-btn.on .tick { border: 0; background: var(--accent); color: var(--on-accent); transform: rotate(-360deg); }
.consumed-btn:active:not(:disabled) { transform: scale(0.96); }
.consumed-btn:disabled { cursor: default; }
.condition { display: flex; align-items: center; gap: 3px; font-size: 12px; }
.pip { width: 14px; height: 4px; border-radius: 2px; background: var(--surface-2); }
.pip.on { background: var(--accent); }
.condition .muted { margin-left: 6px; }
.owner { display: flex; align-items: center; gap: 7px; margin: 0; font-size: 12.5px; }
.owner-av { width: 20px; height: 20px; border-radius: var(--r-xs); display: grid; place-items: center; font-size: 10.5px; font-weight: 700; color: #fff; }
.danger-hover:hover { color: var(--danger); border-color: var(--danger); }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 8px 20px; margin: 0; }
dt { color: var(--faint); font-size: 12.5px; }
dd { margin: 0; font-weight: 550; font-size: 13.5px; overflow-wrap: anywhere; }
.comment { white-space: pre-wrap; margin: 0; line-height: 1.6; font-size: 13.5px; color: var(--muted); }
.added { font-size: 11.5px; margin: 14px 0 0; }
.another {
  position: sticky; bottom: calc(var(--bottom-nav) + 12px + var(--safe-bottom)); display: flex; justify-content: center;
  margin-top: 16px; z-index: 5; animation: rise 0.45s var(--spring) both; animation-delay: 0.3s;
}
.another .btn { box-shadow: 0 12px 30px -10px var(--accent-glow); min-width: 220px; }
@media (min-width: 900px) { .another { bottom: 16px; } }
@media (max-width: 600px) { .another .btn { width: 100%; } }
@keyframes rise { from { opacity: 0; transform: translateY(12px); } }
@keyframes arrive { from { opacity: 0; transform: translateY(14px) rotate(-2deg) scale(0.96); } }
@media (max-width: 700px) {
  .hero { grid-template-columns: 1fr; gap: 18px; justify-items: center; text-align: center; }
  .art { width: min(46vw, 190px); }
  .info { align-items: center; }
  .actions { justify-content: center; }
}
</style>
