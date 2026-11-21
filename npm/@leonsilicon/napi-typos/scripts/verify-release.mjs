import { readFileSync } from 'node:fs'
import { setTimeout } from 'node:timers/promises'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const { name, napi, optionalDependencies, version } = manifest
const platforms = Object.entries(optionalDependencies ?? {})
if (platforms.length !== napi.targets.length || platforms.some(([, pin]) => pin !== version)) {
  throw new Error('Expected one optional dependency per target, all pinned to the release version')
}

async function verifyPackage(packageName) {
  const url = new URL(packageName.replace('/', '%2f'), 'https://registry.npmjs.org/')
  // npm scans new versions before making them installable.
  const deadline = Date.now() + 20 * 60_000
  while (Date.now() < deadline) {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { accept: 'application/vnd.npm.install-v1+json' },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined)
    if (response?.ok && (await response.json()).versions?.[version]) {
      return
    }
    const status = response?.status
    if (status !== undefined && !response.ok && status !== 404 && status !== 429 && status < 500) {
      throw new Error(`Registry reported HTTP ${status} for ${packageName}@${version}`)
    }
    await setTimeout(15_000)
  }
  throw new Error(`${packageName}@${version} was not available on npm after 20 minutes`)
}

await Promise.all([name, ...platforms.map(([packageName]) => packageName)].map(verifyPackage))
