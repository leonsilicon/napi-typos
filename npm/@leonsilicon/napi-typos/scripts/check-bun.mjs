import { deepStrictEqual } from 'node:assert'
import { checkText } from '@leonsilicon/napi-typos'

deepStrictEqual(checkText('teh shield'), [
  { word: 'teh', line: 1, byteOffset: 0, corrections: ['the'] },
])
