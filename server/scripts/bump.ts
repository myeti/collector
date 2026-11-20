// Usage: npm run bump [-- --patch | --minor | --major] [--no-commit]   (minor by default)
// 1. Updates the version in package.json, package-lock.json and the web app manifest.
// 2. Moves the "Unreleased" notes of CHANGELOG.md under the new version (dated), leaving a fresh "Unreleased".
// 3. Commits exactly those files as "Release vX.Y.Z" (other staged changes are left out).
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    patch: { type: 'boolean' }, minor: { type: 'boolean' }, major: { type: 'boolean' },
    'no-commit': { type: 'boolean' },
  },
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
  changelog: path.join(root, 'CHANGELOG.md'),
}
const exists = (file: string) => fs.access(file).then(() => true, () => false)

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

/** "## [Unreleased]\n<notes>" → "## [Unreleased]\n\n## [x.y.z] - YYYY-MM-DD\n<notes>" */
function releaseChangelog(text: string, version: string): { text: string; empty: boolean } {
  const heading = /^## \[Unreleased\][^\n]*\n/m
  const m = text.match(heading)
  if (!m || m.index === undefined) throw new Error('CHANGELOG.md has no "## [Unreleased]" section')
  const start = m.index + m[0].length
  const rest = text.slice(start)
  const end = rest.search(/^## \[/m)
  const notes = (end === -1 ? rest : rest.slice(0, end)).trim()
  const after = end === -1 ? '' : rest.slice(end)
  const date = new Date().toISOString().slice(0, 10)
  const body = notes || '_No notable changes._'
  return {
    text: `${text.slice(0, m.index)}## [Unreleased]\n\n## [${version}] - ${date}\n\n${body}\n${after ? `\n${after}` : ''}`,
    empty: !notes,
  }
}

const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim()

const pkg = await readJson(files.pkg)
const from = pkg.data.version
const to = next(from)

// Changelog first: if it is missing its "Unreleased" section, nothing has been changed yet.
let changelog: { text: string; empty: boolean } | null = null
if (await exists(files.changelog)) {
  try {
    changelog = releaseChangelog(await fs.readFile(files.changelog, 'utf8'), to)
  } catch (e: any) {
    console.error(`❌ ${e.message}`)
    process.exit(1)
  }
}

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

if (changelog) await fs.writeFile(files.changelog, changelog.text)

const touched = [files.pkg, ...(lock ? [files.lock] : []), files.manifest, ...(changelog ? [files.changelog] : [])]
console.log(`🏷  ${from} → ${to} (${level})`)
for (const file of touched) console.log(`   ${path.relative(root, file)}`)
if (!changelog) console.warn('⚠️  No CHANGELOG.md: release notes not updated')
else if (changelog.empty) console.warn('⚠️  "Unreleased" was empty: the release is noted as having no notable changes')

if (values['no-commit']) process.exit(0)
try {
  git('rev-parse', '--is-inside-work-tree')
} catch {
  console.warn('⚠️  Not a git repository: nothing committed')
  process.exit(0)
}
const relative = touched.map((f) => path.relative(root, f))
git('add', '--', ...relative)
// Pathspec commit: only the release files, whatever else is staged.
git('commit', '-m', `Release v${to}`, '--', ...relative)
console.log(`✔ Committed "Release v${to}" (${git('rev-parse', '--short', 'HEAD')})`)
