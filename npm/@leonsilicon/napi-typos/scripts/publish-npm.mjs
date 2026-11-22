import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { setTimeout } from 'node:timers/promises'

const registry = 'https://registry.npmjs.org'
const licenses = ['LICENSE-APACHE', 'LICENSE-MIT']
const manifest = JSON.parse(await readFile('package.json', 'utf8'))
const { name, napi, optionalDependencies, version } = manifest
const platformPackages = Object.entries(optionalDependencies ?? {}).map(([packageName, pin]) => {
  const suffix = packageName.slice(name.length + 1)
  if (!packageName.startsWith(`${name}-`) || !/^[a-z0-9-]+$/.test(suffix) || pin !== version) {
    throw new Error(`Unexpected optional dependency ${packageName}@${pin}`)
  }
  return { name: packageName, directory: join('npm', suffix) }
})
if (platformPackages.length !== napi.targets.length) {
  throw new Error('Expected one optional dependency per native target')
}
const packages = [...platformPackages, { name, directory: '.' }]
const output = process.argv[2]
if (!output || process.env.GITHUB_REF_NAME !== `v${version}`) {
  throw new Error('Publishing requires a matching release tag and a tarball output directory')
}

async function lookupPackageVersion(packageName, waiting = false) {
  const response = await fetch(`${registry}/${encodeURIComponent(packageName)}`, {
    cache: 'no-store',
    headers: { accept: 'application/vnd.npm.install-v1+json' },
    signal: AbortSignal.timeout(10_000),
  }).catch((error) => {
    if (!waiting) throw error
  })
  if (response?.ok) return (await response.json()).versions?.[version]
  if (!response || response.status === 404) return undefined
  if (waiting && (response.status === 429 || response.status >= 500)) return undefined
  throw new Error(`Registry reported HTTP ${response.status} for ${packageName}@${version}`)
}

async function downloadVerifiedTarball(packageName, filename) {
  // The registry can list a new version before its tarball is downloadable.
  const deadline = Date.now() + 20 * 60_000
  let dist
  while (Date.now() < deadline) {
    dist ??= (await lookupPackageVersion(packageName, true))?.dist
    if (dist) {
      const url = new URL(dist.tarball)
      if (url.origin !== registry || !url.pathname.endsWith(`/-/${filename}`)) {
        throw new Error(`Unexpected npm tarball URL for ${packageName}@${version}`)
      }
      const response = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(60_000),
      }).catch(() => undefined)
      if (response?.ok) {
        const body = await response.arrayBuffer().catch(() => undefined)
        if (body) {
          const bytes = Buffer.from(body)
          const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
          if (integrity !== dist.integrity) throw new Error(`Integrity mismatch for ${filename}`)
          return bytes
        }
      } else if (response && response.status !== 404 && response.status !== 429 && response.status < 500) {
        throw new Error(`Could not download ${filename} (HTTP ${response.status})`)
      }
    }
    await setTimeout(15_000)
  }
  throw new Error(`${filename} was not available to download from npm after 20 minutes`)
}

const published = await Promise.all(packages.map(({ name }) => lookupPackageVersion(name)))
const distTag = version.includes('-') ? 'next' : 'latest'
for (const [index, { name, directory }] of packages.entries()) {
  if (published[index]) {
    console.log(`${name}@${version} is already on npm`)
    continue
  }
  execFileSync(
    'npm',
    ['publish', resolve(directory), '--workspaces=false', '--ignore-scripts', '--access', 'public', '--tag', distTag],
    { stdio: 'inherit', timeout: 120_000 },
  )
}

await mkdir(output, { recursive: true })
const checksums = await Promise.all(packages.map(async ({ name }) => {
  const filename = `${name.split('/').at(-1)}-${version}.tgz`
  const bytes = await downloadVerifiedTarball(name, filename)
  await writeFile(join(output, filename), bytes)
  console.log(`Verified npm tarball ${filename}`)
  return `${createHash('sha256').update(bytes).digest('hex')}  ${filename}`
}))
for (const filename of licenses) {
  await copyFile(filename, join(output, filename))
  const hash = createHash('sha256').update(await readFile(filename)).digest('hex')
  checksums.push(`${hash}  ${filename}`)
}
await writeFile(join(output, 'SHA256SUMS'), checksums.sort().join('\n') + '\n')
