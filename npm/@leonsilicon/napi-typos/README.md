# @leonsilicon/napi-typos

Native Node-API bindings for the [crate-ci/typos](https://github.com/crate-ci/typos) spellchecker.
The package manager installs the prebuilt addon for the current platform.

```js
import { checkText } from '@leonsilicon/napi-typos'

checkText('teh shield')
// [{ word: 'teh', line: 1, byteOffset: 0, corrections: ['the'] }]
```

Pass optional typos TOML as the second argument to set a locale, word exceptions, or ignore
patterns. The check uses the supplied configuration and reports one-based lines with zero-based
UTF-8 byte offsets within each line.

Prebuilds cover macOS, Windows, and Linux on x64 and arm64, including glibc and musl on Linux.
