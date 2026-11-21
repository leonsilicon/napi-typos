# napi-typos

[Package and API documentation](npm/@leonsilicon/napi-typos/README.md).

## Development

```sh
vp install
cd npm/@leonsilicon/napi-typos
cargo fetch --locked
bun run build
bun run test
```

## Releases

GitHub Actions builds and tests all eight targets. A pushed `v<version>` tag matching
the npm package version runs NAPI-RS publishing for the platform packages and then the
main package. The workflow checks that all nine versions resolve on npm.

For the first release, set the repository's `NPM_TOKEN` Actions secret to a granular npm
publishing token with write access to the `@leonsilicon` scope. Subsequent releases can
use npm trusted publishing by configuring `leonsilicon/napi-typos` and `publish.yml` for
the main package and all eight platform packages.
