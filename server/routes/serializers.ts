import { Family } from '../db.ts'
import { userPrefs } from '../../shared/media.js'

export async function serializeUser(user: any) {
  if (!user) return null
  const family: any = user.family_id ? await Family.findByPk(user.family_id) : null
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    locale: user.locale,
    theme: user.theme,
    prefs: userPrefs(user.prefs),
    family: family ? { id: family.id, name: family.name, owner_id: family.owner_id } : null,
  }
}

export function publicUser(u: any) {
  return u ? { id: u.id, name: u.name || u.email.split('@')[0], email: u.email } : null
}

export function serializeItem(item: any, me: any) {
  const json = item.toJSON()
  return {
    ...json,
    owner: publicUser(item.owner),
    mine: item.user_id === me.id,
  }
}
