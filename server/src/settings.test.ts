import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createSettingsStore } from './settings.js'

let dataDir: string
let file: string

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'repo-pulse-settings-'))
  file = join(dataDir, 'settings.json')
})

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

/**
 * The store warns about the file it decides not to read. A test that walks that
 * path captures the warning and asserts it instead of letting it print: the
 * suite's output stays clean AND the diagnostic stays pinned.
 */
function captureWarnings() {
  return vi.spyOn(console, 'warn').mockImplementation(() => {})
}

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

test('two writes in flight at once still leave one whole file', async () => {
  const store = createSettingsStore(file)

  // Same process, same file: only a temporary name unique PER WRITE keeps these
  // two from writing over each other's bytes before either rename lands.
  await Promise.all([
    store.set('alpha', { mainFolder: 'src/checkout' }),
    store.set('beta', { mainFolder: 'src/dashboard' }),
  ])

  expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
    version: 1,
    repos: { alpha: { mainFolder: 'src/checkout' }, beta: { mainFolder: 'src/dashboard' } },
  })
  // Nothing left over in the data directory: every temporary was renamed away.
  expect(readdirSync(dataDir)).toEqual(['settings.json'])
})

test('a file that is not valid JSON starts the store empty instead of failing', () => {
  writeFileSync(file, '{ not json')

  expect(() => createSettingsStore(file)).not.toThrow()
  expect(createSettingsStore(file).get('alpha')).toBeUndefined()
})

test('a file of another version is refused, not read as this one', () => {
  // A v2 whose entries changed shape would go through the entry-by-entry check
  // below and come out empty: the user's saved folders, gone without a word.
  writeFileSync(file, JSON.stringify({ version: 2, repos: { alpha: { mainFolder: 'src' } } }))
  const warn = captureWarnings()

  const store = createSettingsStore(file)

  expect(store.get('alpha')).toBeUndefined()
  // And it says so: silence here reads exactly like "you never saved anything".
  expect(warn).toHaveBeenCalledTimes(1)
  expect(warn.mock.calls[0]?.[0]).toContain(file)
})

test('a write that fails leaves memory as the disk has it', async () => {
  const nested = join(dataDir, 'data', 'settings.json')
  const store = createSettingsStore(nested)
  await store.set('alpha', { mainFolder: 'src' })

  // The data directory becomes a FILE: from here on every write fails, the way
  // a read-only or full disk does.
  rmSync(join(dataDir, 'data'), { recursive: true, force: true })
  writeFileSync(join(dataDir, 'data'), '')

  await expect(store.set('alpha', { mainFolder: 'src/checkout' })).rejects.toThrow()
  await expect(store.set('beta', { mainFolder: 'src/dashboard' })).rejects.toThrow()

  // The caller gets a 500 and the running server keeps serving what is actually
  // saved: memory must never run ahead of the file.
  expect(store.get('alpha')).toEqual({ mainFolder: 'src' })
  expect(store.get('beta')).toBeUndefined()
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
