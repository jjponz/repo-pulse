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
  expect(createSettingsStore(file).mainFolderOf('alpha')).toBeUndefined()
})

test('the first write creates the file, its directory and its version', async () => {
  // A data directory nobody has created yet: the first write makes it.
  const nested = join(dataDir, 'not-created-yet', 'settings.json')

  await createSettingsStore(nested).setMainFolder('alpha', 'src/checkout')

  expect(JSON.parse(readFileSync(nested, 'utf8'))).toEqual({
    version: 1,
    repos: { alpha: { mainFolder: 'src/checkout' } },
  })
  // A new store over the same file reads it back: that is what a restart does.
  expect(createSettingsStore(nested).mainFolderOf('alpha')).toBe('src/checkout')
})

test('two writes in flight at once still leave one whole file', async () => {
  const store = createSettingsStore(file)

  // Same process, same file: only a temporary name unique PER WRITE keeps these
  // two from writing over each other's bytes before either rename lands.
  await Promise.all([
    store.setMainFolder('alpha', 'src/checkout'),
    store.setMainFolder('beta', 'src/dashboard'),
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
  expect(createSettingsStore(file).mainFolderOf('alpha')).toBeUndefined()
})

test('a file of another version is refused, not read as this one', () => {
  // A v2 whose entries changed shape would go through the entry-by-entry check
  // below and come out empty: the user's saved folders, gone without a word.
  writeFileSync(file, JSON.stringify({ version: 2, repos: { alpha: { mainFolder: 'src' } } }))
  const warn = captureWarnings()

  const store = createSettingsStore(file)

  expect(store.mainFolderOf('alpha')).toBeUndefined()
  // And it says so: silence here reads exactly like "you never saved anything".
  expect(warn).toHaveBeenCalledTimes(1)
  expect(warn.mock.calls[0]?.[0]).toContain(file)
})

test('a write that fails leaves memory as the disk has it', async () => {
  const nested = join(dataDir, 'data', 'settings.json')
  const store = createSettingsStore(nested)
  await store.setMainFolder('alpha', 'src')

  // The data directory becomes a FILE: from here on every write fails, the way
  // a read-only or full disk does.
  rmSync(join(dataDir, 'data'), { recursive: true, force: true })
  writeFileSync(join(dataDir, 'data'), '')

  await expect(store.setMainFolder('alpha', 'src/checkout')).rejects.toThrow()
  await expect(store.setMainFolder('beta', 'src/dashboard')).rejects.toThrow()

  // The caller gets a 500 and the running server keeps serving what is actually
  // saved: memory must never run ahead of the file.
  expect(store.mainFolderOf('alpha')).toBe('src')
  expect(store.mainFolderOf('beta')).toBeUndefined()
})

test('a saved root is not the same as nothing saved', async () => {
  // '' is a legal main folder — the root of the clone — and it is falsy, so it
  // is one `||` away from being read as "nothing saved" and silently turning
  // into the auto-detected folder. `heatTree` gets told these two apart.
  const store = createSettingsStore(file)
  await store.setMainFolder('alpha', '')

  expect(store.mainFolderOf('alpha')).toBe('')
  expect(store.mainFolderOf('beta')).toBeUndefined()
  // And it survives a restart as '', not as undefined.
  expect(createSettingsStore(file).mainFolderOf('alpha')).toBe('')
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

  expect(store.mainFolderOf('alpha')).toBe('src')
  expect(store.mainFolderOf('beta')).toBeUndefined()
  expect(store.mainFolderOf('gamma')).toBeUndefined()
})
