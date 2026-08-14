import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { createSettingsStore } from './settings.js'

let dataDir: string
let file: string

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'repo-pulse-settings-'))
  file = join(dataDir, 'settings.json')
})

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true })
})

test('a file that is not there starts the store empty', () => {
  expect(createSettingsStore(file).get('alpha')).toBeUndefined()
})

test('the first write creates the file, its directory and its version', async () => {
  // A data directory nobody has created yet: the first write makes it.
  const nested = join(dataDir, 'not-created-yet', 'settings.json')

  await createSettingsStore(nested).set('alpha', { mainFolder: 'src/checkout' })

  expect(JSON.parse(readFileSync(nested, 'utf8'))).toEqual({
    version: 1,
    repos: { alpha: { mainFolder: 'src/checkout' } },
  })
  // A new store over the same file reads it back: that is what a restart does.
  expect(createSettingsStore(nested).get('alpha')).toEqual({ mainFolder: 'src/checkout' })
})

test('a file that is not valid JSON starts the store empty instead of failing', () => {
  writeFileSync(file, '{ not json')

  expect(() => createSettingsStore(file)).not.toThrow()
  expect(createSettingsStore(file).get('alpha')).toBeUndefined()
})

test('an entry of the wrong shape is dropped and the rest survive', () => {
  writeFileSync(
    file,
    JSON.stringify({
      version: 1,
      repos: { alpha: { mainFolder: 'src' }, beta: { mainFolder: 42 }, gamma: null },
    }),
  )

  const store = createSettingsStore(file)

  expect(store.get('alpha')).toEqual({ mainFolder: 'src' })
  expect(store.get('beta')).toBeUndefined()
  expect(store.get('gamma')).toBeUndefined()
})
