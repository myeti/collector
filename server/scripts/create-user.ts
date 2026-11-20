// Usage: npm run create:user -- <email> [--name "Jane Doe"] [--locale fr]
import { parseArgs } from 'node:util'
import { User, sequelize, syncDb } from '../db.ts'
import { isEmail } from '../lib/guard.ts'

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { name: { type: 'string' }, locale: { type: 'string' } },
})

const email = positionals[0]?.trim().toLowerCase()
if (!email || !isEmail(email)) {
  console.error('Usage: npm run create:user -- <email> [--name "Jane Doe"] [--locale en|fr]')
  process.exit(1)
}
if (values.locale && !['en', 'fr'].includes(values.locale)) {
  console.error('--locale must be "en" or "fr"')
  process.exit(1)
}

await syncDb()
const [user, created]: [any, boolean] = await User.findOrCreate({
  where: { email },
  defaults: { email, name: values.name || null, locale: values.locale || 'en' },
})
if (created) console.log(`✨ User created: ${user.email} (${user.id})`)
else console.log(`ℹ️  User already exists: ${user.email} (${user.id})`)
await sequelize.close()
