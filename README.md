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

GitHub Actions builds and tests all eight targets. Push a `v<version>` tag matching
the version in the package manifest to publish the platform packages and the main
package to npm. After all nine tarballs are installable, the workflow verifies their
registry checksums and publishes them to the matching GitHub release with `SHA256SUMS`.
Rerun a failed release job to resume after any packages already published to npm.
Package versions can advance independently of the bundled upstream spellchecker.

The workflow uses the repository's `NPM_TOKEN` Actions secret. Use a granular npm
token with write access to the `@leonsilicon` scope and **Bypass 2FA** enabled.
To use npm trusted publishing, configure `leonsilicon/napi-typos` and `publish.yml`
for the main package and all eight platform packages.
