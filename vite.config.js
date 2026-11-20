import fs from 'node:fs/promises'
import { readFileSync } from 'node:fs'
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

export default defineConfig(({ mode }) => {
  // Same .env as the API (PORT), not only VITE_* variables.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const api = `http://localhost:${env.PORT || 3000}`

  const { version } = JSON.parse(readFileSync('package.json', 'utf8'))

  return {
    root: 'app',
    // Shown on the login screen and in settings (npm run bump updates it).
    define: { __APP_VERSION__: JSON.stringify(version) },
    publicDir: 'public',
    // HTTPS for phones: see server/scripts/dev-https.ts (npm run dev:https).
    plugins: [vue(), serviceWorker()],
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
