import { Sequelize, DataTypes, Op } from 'sequelize'
import type { Model, ModelStatic } from 'sequelize'
import { config } from './config.ts'
import { MIGRATIONS } from './migrations/index.ts'
import { CONDITIONS, MEDIA_TYPES } from '../shared/media.js'

export const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
  host: config.db.host,
  port: config.db.port,
  dialect: 'postgres',
  logging: false,
  define: { underscored: true, createdAt: 'created_at', updatedAt: 'updated_at' },
})

type AnyModel = ModelStatic<Model<any, any>>

const id = { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true }

export const User: AnyModel = sequelize.define('user', {
  id,
  email: {
    type: DataTypes.STRING, allowNull: false, unique: true,
    set(this: any, v: string) { this.setDataValue('email', String(v).trim().toLowerCase()) },
  },
  name: { type: DataTypes.STRING },
  locale: { type: DataTypes.STRING(5), defaultValue: 'en' },
  theme: { type: DataTypes.STRING(10), defaultValue: 'auto' },
  family_id: { type: DataTypes.UUID },
  // Encrypted JSON blob: { keys: { tmdb: '…', … }, llm: { baseUrl, apiKey, model } }
  secrets: { type: DataTypes.TEXT },
  // Bumped by "sign out of all devices": session tokens carry it and must match.
  session_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  // UI preferences: { types: enabled collections, startType: collection opened on startup }
  prefs: { type: DataTypes.JSONB, defaultValue: {} },
})

export const Family: AnyModel = sequelize.define('family', {
  id,
  name: { type: DataTypes.STRING, allowNull: false },
  owner_id: { type: DataTypes.UUID, allowNull: false },
})

export const FamilyInvite: AnyModel = sequelize.define('family_invite', {
  id,
  family_id: { type: DataTypes.UUID, allowNull: false },
  inviter_id: { type: DataTypes.UUID, allowNull: false },
  invitee_id: { type: DataTypes.UUID, allowNull: false },
}, { indexes: [{ unique: true, fields: ['family_id', 'invitee_id'] }] })

export const MagicToken: AnyModel = sequelize.define('magic_token', {
  id,
  token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  user_id: { type: DataTypes.UUID, allowNull: false },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  used_at: { type: DataTypes.DATE },
  // 6-digit code sent with the link (for installed apps that cannot receive the link, e.g. iOS home-screen apps)
  code_hash: { type: DataTypes.STRING(64) },
  code_attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
})

export const Item: AnyModel = sequelize.define('item', {
  id,
  type: { type: DataTypes.ENUM(...MEDIA_TYPES), allowNull: false },
  // Common (see COMMON_FIELDS in shared/media.js for what each holds per media type)
  title: { type: DataTypes.STRING(512), allowNull: false },
  author: { type: DataTypes.STRING(512) }, // author, artist, director, studio
  editor: { type: DataTypes.STRING(255) }, // publisher, label, studio, brand
  cover: { type: DataTypes.STRING(1024) },
  genre: { type: DataTypes.STRING(128) },
  category: { type: DataTypes.STRING(128) }, // music, movies, custom
  format: { type: DataTypes.STRING(32) }, // book kind, music / movie medium, game platform
  saga: { type: DataTypes.STRING(255) },
  volume: { type: DataTypes.STRING(32) },
  release_date: { type: DataTypes.STRING(10) }, // 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'
  condition: { type: DataTypes.ENUM(...CONDITIONS) },
  barcode: { type: DataTypes.STRING(32) },
  consumed: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
  digitalized: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false }, // digital copy, not a physical one
  description: { type: DataTypes.TEXT }, // synopsis from metadata sources
  comment: { type: DataTypes.TEXT }, // the user's own note
  user_id: { type: DataTypes.UUID, allowNull: false },
  // Book
  isbn: { type: DataTypes.STRING(13) },
  // Free key/value pairs (custom items, extra metadata)
  extra: { type: DataTypes.JSONB, defaultValue: {} },
}, {
  indexes: [
    { fields: ['user_id', 'type'] },
    { fields: ['barcode'] },
    { fields: ['isbn'] },
  ],
})

User.belongsTo(Family, { foreignKey: 'family_id', as: 'family', onDelete: 'SET NULL' })
Family.hasMany(User, { foreignKey: 'family_id', as: 'members' })
Family.belongsTo(User, { foreignKey: 'owner_id', as: 'owner', constraints: false })
FamilyInvite.belongsTo(Family, { foreignKey: 'family_id', as: 'family', onDelete: 'CASCADE' })
FamilyInvite.belongsTo(User, { foreignKey: 'inviter_id', as: 'inviter', onDelete: 'CASCADE' })
FamilyInvite.belongsTo(User, { foreignKey: 'invitee_id', as: 'invitee', onDelete: 'CASCADE' })
MagicToken.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' })
Item.belongsTo(User, { foreignKey: 'user_id', as: 'owner', onDelete: 'CASCADE' })

/** True when the `unaccent` extension is available: "asterix" then finds "Astérix". */
export let hasUnaccent = false

export async function syncDb(options: { alter?: boolean } = {}) {
  await sequelize.authenticate()
  try {
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS unaccent')
    hasUnaccent = true
  } catch {
    console.warn('⚠️  Postgres extension "unaccent" unavailable: search will be accent-sensitive.')
  }
  // Order matters: data moves (migrations) before anything could drop the columns they read
  await sequelize.sync()
  await addMissingColumns()
  await runMigrations()
  if (options.alter) await sequelize.sync({ alter: true })
}

/** Applies the migrations not applied yet (server/migrations), each in its own transaction, recorded in "migrations". */
async function runMigrations() {
  await sequelize.query('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())')
  const [rows]: any = await sequelize.query('SELECT name FROM migrations')
  const applied = new Set(rows.map((r: any) => r.name))
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue
    await sequelize.transaction(async (transaction: any) => {
      const query = (sql: string, replacements?: Record<string, any>) => sequelize.query(sql, { replacements, transaction })
      const columns = async (table: string) => {
        const [cols]: any = await query('SELECT column_name FROM information_schema.columns WHERE table_name = :table', { table })
        return new Set<string>(cols.map((c: any) => c.column_name))
      }
      await migration.up({ query, columns })
      await query('INSERT INTO migrations (name) VALUES (:name)', { name: migration.name })
    })
    console.log(`🛠  Database: migration ${migration.name} applied`)
  }
}

/**
 * New fields in an update: adds the columns the models have and the tables lack. sync() alone creates missing
 * tables but leaves existing ones as they are. Additive only: never drops, renames or changes a column, so it is
 * safe on every start (unlike sync({ alter }), which also drops columns the models no longer define).
 */
async function addMissingColumns() {
  const qi = sequelize.getQueryInterface()
  for (const model of Object.values(sequelize.models) as any[]) {
    const table = model.getTableName()
    const existing = await qi.describeTable(table)
    for (const [name, attribute] of Object.entries(model.getAttributes()) as [string, any][]) {
      const column = attribute.field || name
      if (existing[column]) continue
      await qi.addColumn(table, column, attribute)
      console.log(`🛠  Database: added column ${table}.${column}`)
    }
  }
}


/** Ids of every user whose collection `user` can see (self + family members). */
export async function visibleUserIds(user: any): Promise<string[]> {
  if (!user.family_id) return [user.id]
  const members = await User.findAll({ where: { family_id: user.family_id }, attributes: ['id'] })
  return members.map((m: any) => m.id)
}

export { Op }
