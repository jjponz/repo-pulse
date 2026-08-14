import { expect, test } from 'vitest'
import { isNoise } from './noise.js'

test.each([
  'package-lock.json',
  'web/package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'poetry.lock',
  'Gemfile.lock',
  'go.sum',
  'web/assets/app.min.js',
  'web/assets/app.js.map',
  'dist/index.js',
  'server/dist/index.js',
  'build/output.txt',
  'vendor/lib/thing.rb',
])('"%s" is noise', (path) => {
  expect(isNoise(path)).toBe(true)
})

test.each([
  'src/index.ts',
  'server/src/analysis/index.ts',
  'web/src/App.tsx',
  'README.md',
  'package.json',
  'src/distribution.ts',
  'src/builder.ts',
  'src/vendors.ts',
])('"%s" is not noise', (path) => {
  expect(isNoise(path)).toBe(false)
})
