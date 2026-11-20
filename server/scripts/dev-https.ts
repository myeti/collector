// Usage: npm run dev:https  (phones need HTTPS for the camera)
//
// Vite's own HTTPS server always speaks HTTP/2, which Chrome on Android handles badly with a self-signed
// certificate (ERR_TOO_MANY_RETRIES). Here Vite runs in middleware mode behind a plain HTTPS (HTTP/1.1) server.
import https from 'node:https'
import path from 'node:path'
import { createServer } from 'vite'
import { getCertificate } from '@vitejs/plugin-basic-ssl'

const PORT = 5173

// Same self-signed certificate across restarts (phones only need to accept it once).
const pem = await getCertificate(path.resolve('node_modules/.vite/basic-ssl'))
const server = https.createServer({ key: pem, cert: pem })

const vite = await createServer({
  appType: 'spa',
  server: {
    // Proxy (/api, /uploads) and the HMR websocket both attach to our server.
    middlewareMode: { server },
    ws: { server },
  },
})
server.on('request', vite.middlewares)

server.listen(PORT, '0.0.0.0', () => {
  console.log(`  ➜  HTTPS (HTTP/1.1): https://localhost:${PORT}/ — accept the self-signed certificate once per device`)
})
