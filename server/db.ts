import { Sequelize, DataTypes, Op } from 'sequelize'
import type { Model, ModelStatic } from 'sequelize'
import { config } from './config.ts'
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
  // Common
  title: { type: DataTypes.STRING(512), allowNull: false },
  original_title: { type: DataTypes.STRING(512) },
  author: { type: DataTypes.STRING(512) },
  cover: { type: DataTypes.STRING(1024) },
  genre: { type: DataTypes.STRING(128) },
  category: { type: DataTypes.STRING(128) },
  release_date: { type: DataTypes.STRING(10) }, // 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'
  condition: { type: DataTypes.ENUM(...CONDITIONS) },
  barcode: { type: DataTypes.STRING(32) },
  consumed: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
  comment: { type: DataTypes.TEXT },
  user_id: { type: DataTypes.UUID, allowNull: false },
  // Book / game
  editor: { type: DataTypes.STRING(255) },
  isbn: { type: DataTypes.STRING(13) },
  saga: { type: DataTypes.STRING(255) },
  volume: { type: DataTypes.STRING(32) },
  // Music
  label: { type: DataTypes.STRING(255) },
  // Music / movie
  format: { type: DataTypes.STRING(32) },
  // Movie
  director: { type: DataTypes.STRING(255) },
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
  await sequelize.sync({ alter: options.alter })
}


/** Ids of every user whose collection `user` can see (self + family members). */
export async function visibleUserIds(user: any): Promise<string[]> {
  if (!user.family_id) return [user.id]
  const members = await User.findAll({ where: { family_id: user.family_id }, attributes: ['id'] })
  return members.map((m: any) => m.id)
}

export { Op }
