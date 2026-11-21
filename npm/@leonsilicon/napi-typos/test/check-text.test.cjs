const assert = require('node:assert/strict')
const { test } = require('node:test')
const { checkText } = require('../index.js')

test('reports typos, suggestions and line-relative UTF-8 offsets', () => {
  assert.deepEqual(checkText('Good spelling.\n盾 🙂 teh shield.'), [
    {
      word: 'teh',
      line: 2,
      byteOffset: Buffer.byteLength('盾 🙂 '),
      corrections: ['the'],
    },
  ])
})

test('honors the typos locale, word exceptions and ignored text', () => {
  const config = String.raw`
[default]
locale = "en-us"
extend-ignore-re = ['\]\([^\n)]*\)']
[default.extend-words]
teh = "teh"
`
  assert.deepEqual(checkText('teh [shield](organise) colour', config).map(({ word }) => word), ['colour'])
})

test('rejects malformed configuration and accepts empty input', () => {
  assert.throws(() => checkText('teh', '[default'))
  assert.deepEqual(checkText(''), [])
})
