import { Router } from 'express'
import { Family, FamilyInvite, User, sequelize } from '../db.ts'
import { badRequest, forbidden, notFound, HttpError } from '../lib/http.ts'
import { throttled, isEmail } from '../lib/guard.ts'
import { publicUser, serializeUser } from './serializers.ts'

export const familyRouter = Router()

async function state(user: any) {
  const family: any = user.family_id
    ? await Family.findByPk(user.family_id, { include: [{ model: User, as: 'members' }] })
    : null
  const sent = family
    ? await FamilyInvite.findAll({ where: { family_id: family.id }, include: [{ model: User, as: 'invitee' }] })
    : []
  const received = await FamilyInvite.findAll({
    where: { invitee_id: user.id },
    include: [{ model: Family, as: 'family' }, { model: User, as: 'inviter' }],
  })
  return {
    family: family && {
      id: family.id,
      name: family.name,
      owner_id: family.owner_id,
      members: family.members.map(publicUser).sort((a: any, b: any) =>
        (b.id === family.owner_id ? 1 : 0) - (a.id === family.owner_id ? 1 : 0) || a.name.localeCompare(b.name)),
    },
    invites: {
      sent: sent.map((i: any) => ({ id: i.id, invitee: publicUser(i.invitee), created_at: i.created_at })),
      received: received.map((i: any) => ({
        id: i.id, family: { id: i.family.id, name: i.family.name }, inviter: publicUser(i.inviter), created_at: i.created_at,
      })),
    },
    user: await serializeUser(user),
  }
}

async function requireOwner(user: any) {
  const family: any = user.family_id && (await Family.findByPk(user.family_id))
  if (!family) throw notFound('no_family')
  if (family.owner_id !== user.id) throw forbidden('not_family_owner')
  return family
}

familyRouter.get('/', async (req: any, res) => res.json(await state(req.user)))

familyRouter.post('/', async (req: any, res) => {
  if (req.user.family_id) throw badRequest('already_in_family')
  const name = String(req.body?.name || '').trim()
  if (!name) throw badRequest('name_required')
  const family: any = await Family.create({ name, owner_id: req.user.id })
  await req.user.update({ family_id: family.id })
  res.status(201).json(await state(req.user))
})

familyRouter.patch('/', async (req: any, res) => {
  const family = await requireOwner(req.user)
  const name = String(req.body?.name || '').trim()
  if (!name) throw badRequest('name_required')
  await family.update({ name })
  res.json(await state(req.user))
})

familyRouter.post('/invites', async (req: any, res) => {
  const family = await requireOwner(req.user)
  // Invites reveal whether an email has an account: keep that probing slow.
  if (throttled(`invite:${req.user.id}`, 20)) throw new HttpError(429, 'too_many_requests')
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!isEmail(email)) throw badRequest('invalid_email')
  const invitee: any = await User.findOne({ where: { email } })
  // Accounts only exist through the CLI, so tell the owner plainly when nobody matches.
  if (!invitee) throw notFound('user_not_found')
  if (invitee.id === req.user.id || invitee.family_id === family.id) throw badRequest('already_member')
  await FamilyInvite.findOrCreate({
    where: { family_id: family.id, invitee_id: invitee.id },
    defaults: { inviter_id: req.user.id },
  })
  res.status(201).json(await state(req.user))
})

familyRouter.delete('/invites/:id', async (req: any, res) => {
  const invite: any = await FamilyInvite.findByPk(req.params.id)
  if (!invite) throw notFound()
  const family: any = await Family.findByPk(invite.family_id)
  // The invitee declines, or the family owner revokes.
  if (invite.invitee_id !== req.user.id && family?.owner_id !== req.user.id) throw forbidden()
  await invite.destroy()
  res.json(await state(req.user))
})

familyRouter.post('/invites/:id/accept', async (req: any, res) => {
  const invite: any = await FamilyInvite.findByPk(req.params.id)
  if (!invite || invite.invitee_id !== req.user.id) throw notFound()
  if (req.user.family_id) {
    const current: any = await Family.findByPk(req.user.family_id)
    if (current?.owner_id === req.user.id) throw badRequest('owner_must_leave_first')
  }
  await sequelize.transaction(async (transaction) => {
    await req.user.update({ family_id: invite.family_id }, { transaction })
    await FamilyInvite.destroy({ where: { invitee_id: req.user.id }, transaction })
  })
  res.json(await state(req.user))
})

/** Leave the family, or (owner only) remove someone. An owner leaving hands over or dissolves. */
familyRouter.delete('/members/:userId', async (req: any, res) => {
  const family: any = req.user.family_id && (await Family.findByPk(req.user.family_id))
  if (!family) throw notFound('no_family')
  const target: any = await User.findByPk(req.params.userId)
  if (!target || target.family_id !== family.id) throw notFound()
  const self = target.id === req.user.id
  if (!self && family.owner_id !== req.user.id) throw forbidden('not_family_owner')

  await sequelize.transaction(async (transaction) => {
    await target.update({ family_id: null }, { transaction })
    if (target.id === family.owner_id) {
      const heir: any = await User.findOne({ where: { family_id: family.id }, order: [['created_at', 'ASC']], transaction })
      if (heir) await family.update({ owner_id: heir.id }, { transaction })
      else {
        await FamilyInvite.destroy({ where: { family_id: family.id }, transaction })
        await family.destroy({ transaction })
      }
    }
  })
  await req.user.reload()
  res.json(await state(req.user))
})

familyRouter.delete('/', async (req: any, res) => {
  const family = await requireOwner(req.user)
  await sequelize.transaction(async (transaction) => {
    await User.update({ family_id: null }, { where: { family_id: family.id }, transaction })
    await FamilyInvite.destroy({ where: { family_id: family.id }, transaction })
    await family.destroy({ transaction })
  })
  await req.user.reload()
  res.json(await state(req.user))
})
