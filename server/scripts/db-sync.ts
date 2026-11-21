// Usage: npm run db:sync [-- --alter]
// Without --alter: creates missing tables and adds missing columns (never removes anything; also done on every start).
// --alter: makes existing tables match the models exactly, dropping columns the models no longer have.
import { sequelize, syncDb } from '../db.ts'

const alter = process.argv.includes('--alter')
await syncDb({ alter })
console.log(`✅ Database schema synced${alter ? ' (alter)' : ''}`)
await sequelize.close()
