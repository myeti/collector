// Usage: npm run db:sync [-- --alter]
// Without --alter: creates missing tables, adds missing columns and applies pending migrations (all done on every start too).
// --alter: then makes existing tables match the models exactly, dropping columns the models no longer have.
import { sequelize, syncDb } from '../db.ts'

const alter = process.argv.includes('--alter')
await syncDb({ alter })
console.log(`✅ Database schema synced${alter ? ' (alter)' : ''}`)
await sequelize.close()
