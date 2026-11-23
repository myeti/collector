import { Router } from 'express'
import { readFileSync } from 'node:fs'
import { Item } from '../db.ts'
import { exportArchive } from '../lib/archive.ts'
import { HttpError } from '../lib/http.ts'
import { throttled } from '../lib/guard.ts'

export const exportRouter = Router()
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))

/** The user's own items as a Collector archive (.zip), with their covers unless ?covers=0. */
exportRouter.get('/', async (req: any, res) => {
  if (throttled(`export:${req.user.id}`, 20)) throw new HttpError(429, 'too_many_requests')
  const items = await Item.findAll({ where: { user_id: req.user.id }, order: [['type', 'ASC'], ['title', 'ASC']] })
  const covers = req.query.covers !== '0'
  const date = new Date().toISOString().slice(0, 10)
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="collector-${date}.zip"`)
  res.setHeader('Cache-Control', 'no-store')
  const stream = exportArchive(items, { covers, version })
  stream.on('error', () => res.destroy())
  stream.pipe(res)
})
