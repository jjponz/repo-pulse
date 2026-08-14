import { expect, test } from 'vitest'
import { esRuido } from './ruido.js'

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
  'build/salida.txt',
  'vendor/lib/cosa.rb',
])('«%s» es ruido', (ruta) => {
  expect(esRuido(ruta)).toBe(true)
})

test.each([
  'src/index.ts',
  'server/src/analysis/index.ts',
  'web/src/App.tsx',
  'README.md',
  'package.json',
  'src/distribucion.ts',
  'src/builder.ts',
  'src/vendors.ts',
])('«%s» no es ruido', (ruta) => {
  expect(esRuido(ruta)).toBe(false)
})
