import fs from 'node:fs/promises'
import { readFileSync, createReadStream } from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * Builds app/sw.js into dist/sw.js with a unique build id (so browsers see a new version on every deploy)
 * and the list of this build's scripts and styles to pre-cache.
 */
function serviceWorker() {
  return {
    name: 'collector-service-worker',
    apply: 'build',
    async generateBundle(_options, bundle) {
      const precache = Object.keys(bundle).filter((f) => /\.(js|css)$/.test(f)).map((f) => `/${f}`)
      const source = (await fs.readFile('app/sw.js', 'utf8'))
        .replace('__BUILD_ID__', Date.now().toString(36))
        .replace('__PRECACHE__', JSON.stringify(precache))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

/**
 * The ISBN text reader's OCR (tesseract.js): its worker, engine (3 builds: plain, SIMD, relaxed SIMD; the worker
 * picks the one the device supports) and English model, served by Collector under /ocr/<version>/ instead of a CDN.
 * Copied next to the build, not pre-cached (about 7 MB, downloaded on first use only).
 */
const OCR_VERSION = JSON.parse(readFileSync('node_modules/tesseract.js/package.json', 'utf8')).version
const OCR_FILES = {
  'worker.min.js': 'node_modules/tesseract.js/dist/worker.min.js',
  'core/tesseract-core-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js',
  'core/tesseract-core-simd-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'core/tesseract-core-relaxedsimd-lstm.wasm.js': 'node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'lang/eng.traineddata.gz': 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
}

function ocrAssets() {
  const prefix = `/ocr/${OCR_VERSION}/`
  return {
    name: 'collector-ocr-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = req.url?.startsWith(prefix) && OCR_FILES[req.url.slice(prefix.length).split('?')[0]]
        if (!file) return next()
        res.setHeader('Content-Type', file.endsWith('.gz') ? 'application/octet-stream' : 'text/javascript')
        createReadStream(file).pipe(res)
      })
    },
    async writeBundle() {
      for (const [name, file] of Object.entries(OCR_FILES)) {
        const target = path.resolve('dist', prefix.slice(1), name)
        await fs.mkdir(path.dirname(target), { recursive: true })
        await fs.copyFile(file, target)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  // Same .env as the API (PORT), not only VITE_* variables.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const api = `http://localhost:${env.PORT || 3000}`

  const { version } = JSON.parse(readFileSync('package.json', 'utf8'))

  return {
    root: 'app',
    // Shown on the login screen and in settings (npm run bump updates it).
    define: { __APP_VERSION__: JSON.stringify(version), __OCR_VERSION__: JSON.stringify(OCR_VERSION) },
    publicDir: 'public',
    // HTTPS for phones: see server/scripts/dev-https.ts (npm run dev:https).
    plugins: [vue(), serviceWorker(), ocrAssets()],
    server: {
      host: true, // listen on the LAN too (phones, tablets)
      port: 5173,
      // Fail instead of silently moving to 5174: the API prints LAN links with this port.
      strictPort: true,
      proxy: { '/api': api, '/uploads': api },
    },
    build: { outDir: '../dist', emptyOutDir: true },
  }
})
