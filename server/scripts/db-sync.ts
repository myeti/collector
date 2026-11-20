// Usage: npm run db:sync [-- --alter]   (alter updates existing tables to match the models)
import { sequelize, syncDb } from '../db.ts'

const alter = process.argv.includes('--alter')
await syncDb({ alter })
console.log(`✅ Database schema synced${alter ? ' (alter)' : ''}`)
await sequelize.close()
