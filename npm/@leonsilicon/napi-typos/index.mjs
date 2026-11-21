import { createRequire } from 'node:module'

const binding = createRequire(import.meta.url)('./index.cjs')
export const { checkText, __napiBindingTarget } = binding
