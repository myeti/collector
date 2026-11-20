import { Router } from 'express'
import multer from 'multer'
import { storeImage } from '../lib/images.ts'
import { badRequest, HttpError } from '../lib/http.ts'
import { throttled } from '../lib/guard.ts'

export const uploadsRouter = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

uploadsRouter.post('/', upload.single('file'), async (req: any, res) => {
  if (throttled(`upload:${req.user.id}`, 120)) throw new HttpError(429, 'too_many_requests')
  if (!req.file) throw badRequest('file_required')
  if (!String(req.file.mimetype).startsWith('image/')) throw badRequest('not_an_image')
  res.status(201).json({ cover: await storeImage(req.file.buffer, req.user.id) })
})
