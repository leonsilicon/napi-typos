import { readFileSync } from 'node:fs'
import { setTimeout } from 'node:timers/promises'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const { name, napi, optionalDependencies, version } = manifest
const platforms = Object.entries(optionalDependencies ?? {})
if (platforms.length !== napi.targets.length || platforms.some(([, pin]) => pin !== version)) {
  throw new Error('Expected one optional dependency per target, all pinned to the release version')
}

async function verifyPackage(packageName) {
  const url = new URL(`${encodeURIComponent(packageName)}/${encodeURIComponent(version)}`, 'https://registry.npmjs.org/')
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (response.ok) {
      return
    }
    if (response.status !== 404) {
      throw new Error(`Registry reported HTTP ${response.status} for ${packageName}@${version}`)
    }
    await setTimeout(5_000)
  }
  throw new Error(`Missing ${packageName}@${version} on npm`)
}

await Promise.all([name, ...platforms.map(([packageName]) => packageName)].map(verifyPackage))
