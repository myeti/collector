<template>
  <section id="family" class="panel">
    <div class="panel-head">
      <div class="panel-title"><vue-feather type="users" size="12" /> {{ $t('family.title') }}</div>
      <button v-if="isOwner && !renaming" class="btn ghost sm" @click="startRename"><vue-feather type="edit-2" size="12" /> {{ $t('family.rename') }}</button>
    </div>

    <div v-if="!state" class="skeleton" style="height: 80px"></div>

    <template v-else>
      <!-- Invitations received -->
      <div v-for="inv in state.invites.received" :key="inv.id" class="invite">
        <span class="ico"><vue-feather type="gift" size="15" /></span>
        <div class="grow">
          <strong>{{ $t('family.received') }}</strong>
          <div class="muted small">{{ $t('family.receivedText', { name: inv.inviter.name, family: inv.family.name }) }}</div>
        </div>
        <button class="btn ghost sm" @click="call('delete', `/family/invites/${inv.id}`)">{{ $t('family.decline') }}</button>
        <button class="btn primary sm" @click="accept(inv, $event)">{{ $t('family.accept') }}</button>
      </div>

      <!-- No family yet -->
      <template v-if="!family">
        <p class="muted intro">{{ $t('family.intro') }}</p>
        <form class="row line-form" @submit.prevent="create">
          <input v-model.trim="name" class="input grow" :placeholder="$t('family.namePlaceholder')" required />
          <button class="btn primary" :disabled="!name || busy">{{ $t('family.create') }}</button>
        </form>
      </template>

      <!-- Family -->
      <template v-else>
        <div class="fam-head">
          <div class="avatars" aria-hidden="true">
            <span v-for="(m, i) in family.members.slice(0, 5)" :key="m.id" class="av" :style="{ background: personColor(m.id), zIndex: 10 - i }">{{ initial(m) }}</span>
          </div>
          <form v-if="renaming" class="row grow" @submit.prevent="rename">
            <input ref="rename" v-model.trim="name" class="input" />
            <button class="btn sm primary">{{ $t('common.save') }}</button>
          </form>
          <strong v-else class="display fam-name grow truncate">{{ family.name }}</strong>
        </div>
        <p class="muted intro">{{ $t('family.intro') }}</p>

        <ul class="members">
          <li v-for="m in family.members" :key="m.id" class="member">
            <span class="av" :style="{ background: personColor(m.id) }">{{ initial(m) }}</span>
            <div class="grow">
              <div class="truncate"><strong>{{ m.name }}</strong><span v-if="m.id === store.user.id" class="faint"> ({{ $t('family.you') }})</span></div>
              <div class="faint small truncate">{{ m.email }}</div>
            </div>
            <span v-if="m.id === family.owner_id" class="badge accent"><vue-feather type="star" size="10" /> {{ $t('family.owner') }}</span>
            <button
              v-else-if="isOwner" class="btn ghost sm danger"
              @click="confirm($t('family.removeConfirm', { name: m.name })) && call('delete', `/family/members/${m.id}`)"
            >{{ $t('family.removeMember') }}</button>
          </li>
          <li v-for="inv in state.invites.sent" :key="inv.id" class="member">
            <span class="av pending"><vue-feather type="clock" size="13" /></span>
            <div class="grow truncate muted">{{ inv.invitee.email }}</div>
            <span class="badge">{{ $t('family.pending') }}</span>
            <button v-if="isOwner" class="btn ghost sm" @click="call('delete', `/family/invites/${inv.id}`)">{{ $t('family.revoke') }}</button>
          </li>
        </ul>

        <template v-if="isOwner">
          <form class="row line-form" @submit.prevent="invite">
            <div class="input-wrap grow">
              <span class="lead"><vue-feather type="user-plus" size="15" /></span>
              <input v-model.trim="email" type="email" class="input" :placeholder="$t('family.invite')" required />
            </div>
            <button class="btn" :disabled="!email || busy">{{ $t('family.inviteSend') }}</button>
          </form>
          <p class="hint">{{ $t('family.inviteHint') }}</p>
        </template>

        <div class="row wrap actions">
          <button class="btn ghost sm danger" @click="leave"><vue-feather type="log-out" size="13" /> {{ $t('family.leave') }}</button>
          <button v-if="isOwner" class="btn ghost sm danger" @click="dissolve"><vue-feather type="trash-2" size="13" /> {{ $t('family.dissolve') }}</button>
        </div>
      </template>
    </template>
  </section>
</template>

<script>
import { api } from '../lib/api.js'
import { store } from '../lib/store.js'
import { toast, toastError } from '../lib/toast.js'
import { sparkle } from '../lib/sparkle.js'
import { personColor, initial } from '../lib/people.js'

export default {
  name: 'FamilyPanel',
  data: () => ({ store, state: null, name: '', email: '', busy: false, renaming: false }),
  computed: {
    family() { return this.state?.family },
    isOwner() { return this.family?.owner_id === store.user.id },
  },
  async mounted() {
    try {
      this.apply(await api.get('/family'))
    } catch (e) {
      toastError(e)
    }
  },
  methods: {
    confirm(msg) { return window.confirm(msg) },
    apply(state) {
      this.state = state
      if (state.user) store.setUser(state.user)
      store.refreshStats()
    },
    async call(method, url, body) {
      this.busy = true
      try {
        this.apply(await api[method](url, body))
        return true
      } catch (e) {
        toastError(e)
        return false
      } finally {
        this.busy = false
      }
    },
    async create(e) {
      if (await this.call('post', '/family', { name: this.name })) {
        this.name = ''
        sparkle(e.target.querySelector('button'))
      }
    },
    startRename() {
      this.name = this.family.name
      this.renaming = true
      this.$nextTick(() => this.$refs.rename?.focus())
    },
    async rename() {
      if (this.name && (await this.call('patch', '/family', { name: this.name }))) this.renaming = false
      this.name = ''
    },
    async invite() {
      if (await this.call('post', '/family/invites', { email: this.email })) {
        toast(this.$t('family.invited'), { icon: 'send' })
        this.email = ''
      }
    },
    async accept(inv, e) {
      const btn = e.currentTarget
      if (await this.call('post', `/family/invites/${inv.id}/accept`)) sparkle(btn, { count: 24 })
    },
    leave() {
      if (this.confirm(this.$t('family.leaveConfirm', { family: this.family.name }))) this.call('delete', `/family/members/${store.user.id}`)
    },
    dissolve() {
      if (this.confirm(this.$t('family.dissolveConfirm', { family: this.family.name }))) this.call('delete', '/family')
    },
    initial,
    personColor,
  },
}
</script>

<style scoped>
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; min-height: 28px; }
.panel-head .panel-title { margin: 0; }
.intro { margin: 0 0 12px; font-size: 12.5px; line-height: 1.5; }
.small { font-size: 11.5px; }
.invite {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px; margin-bottom: 12px; border-radius: var(--r-md);
  border: 1px solid var(--accent-line); background: var(--accent-soft); font-size: 13px;
}
.invite .ico { width: 30px; height: 30px; border-radius: var(--r-sm); display: grid; place-items: center; background: var(--accent); color: var(--on-accent); flex: none; }
.fam-head { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.fam-name { font-size: 17px; }
.avatars { display: flex; padding-left: 6px; }
.avatars .av { margin-left: -6px; border: 2px solid var(--bg); }
.members { list-style: none; margin: 0 0 12px; padding: 0; border: 1px solid var(--border); border-radius: var(--r-md); }
.member { display: flex; align-items: center; gap: 10px; padding: 7px 10px; font-size: 13px; }
.member + .member { border-top: 1px solid var(--border); }
.av { width: 28px; height: 28px; border-radius: var(--r-sm); display: grid; place-items: center; color: #fff; font-weight: 700; flex: none; font-size: 11.5px; }
.av.pending { background: var(--surface-2); color: var(--muted); }
.line-form { margin-bottom: 4px; }
.actions { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border); }
@media (max-width: 560px) {
  .line-form { flex-direction: column; align-items: stretch; }
  .line-form > * { flex: none; }
}
</style>
