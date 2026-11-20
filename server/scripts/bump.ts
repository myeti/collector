// Usage: npm run bump [-- --patch | --minor | --major]   (minor by default)
// Updates the version in package.json, package-lock.json and the web app manifest.
import fs from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: { patch: { type: 'boolean' }, minor: { type: 'boolean' }, major: { type: 'boolean' } },
})
const levels = (['major', 'minor', 'patch'] as const).filter((l) => values[l])
if (levels.length > 1) {
  console.error('Pick a single level: --patch, --minor or --major')
  process.exit(1)
}
const level = levels[0] || 'minor'

const root = path.resolve(import.meta.dirname, '../..')
const files = {
  pkg: path.join(root, 'package.json'),
  lock: path.join(root, 'package-lock.json'),
  manifest: path.join(root, 'app/public/manifest.webmanifest'),
}

/** Reads JSON and remembers its indentation, to write it back unchanged. */
async function readJson(file: string) {
  const text = await fs.readFile(file, 'utf8')
  const indent = text.match(/\n([ \t]+)"/)?.[1] || '  '
  return { data: JSON.parse(text), indent }
}

async function writeJson(file: string, { data, indent }: { data: any; indent: string }) {
  await fs.writeFile(file, `${JSON.stringify(data, null, indent)}\n`)
}

function next(version: string) {
  const m = version.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!m) throw new Error(`Unsupported version "${version}"`)
  const [major, minor, patch] = m.slice(1).map(Number)
  if (level === 'major') return `${major + 1}.0.0`
  if (level === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

const pkg = await readJson(files.pkg)
const from = pkg.data.version
const to = next(from)

pkg.data.version = to
await writeJson(files.pkg, pkg)

const lock = await readJson(files.lock).catch(() => null)
if (lock) {
  lock.data.version = to
  if (lock.data.packages?.['']) lock.data.packages[''].version = to
  await writeJson(files.lock, lock)
}

// Not a standard manifest member (browsers ignore it), kept in sync for reference.
const manifest = await readJson(files.manifest)
manifest.data = { ...manifest.data, version: to }
await writeJson(files.manifest, manifest)

console.log(`🏷  ${from} → ${to} (${level})`)
for (const [name, file] of Object.entries(files)) if (name !== 'lock' || lock) console.log(`   ${path.relative(root, file)}`)
